// Offscreen document for handling getDisplayMedia
// This runs in a separate context for security and API access

let mediaRecorder = null;
let recordedChunks = [];
let stream = null;
let watermarkSettings = null;
let watermarkImageData = null;
let canvas = null;
let canvasCtx = null;
let compositeStream = null;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.target !== 'offscreen') {
    return;
  }
  if (request.action === 'start-display-media') {
    watermarkSettings = request.watermarkSettings;
    watermarkImageData = request.watermarkImageData;
    startDisplayMedia()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }

  if (request.action === 'stop-recording') {
    stopRecording()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function startDisplayMedia() {
  try {
    // Request screen sharing - this will show the permission dialog
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        mediaSource: 'screen',
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 }
      },
      audio: false
    });

    // Validate stream has video tracks
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      throw new Error("No video tracks available in stream");
    }

    let recordingStream = stream;

    // Apply watermark if enabled
    if (watermarkSettings && watermarkSettings.enabled) {
      recordingStream = await applyWatermark(stream);
    }

    // Setup MediaRecorder
    recordedChunks = [];
    
    const options = {
      mimeType: 'video/webm;codecs=vp8,vp9',
      videoBitsPerSecond: 2500000 // 2.5 Mbps
    };

    // Fallback if codec not supported
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm';
    }

    mediaRecorder = new MediaRecorder(recordingStream, options);

    // Handle data collection
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    // Handle stop event
    mediaRecorder.onstop = () => {
      handleRecordingComplete();
    };

    // Handle errors
    mediaRecorder.onerror = (event) => {
      throw new Error(`MediaRecorder error: ${event.error}`);
    };

    // Start recording with data collection every 100ms
    mediaRecorder.start(100);

    // Listen for user stopping the screen share
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    });

    return { success: true };

  } catch (error) {
    // Clean up on error
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    
    cleanupWatermark();
    
    throw new Error(`Failed to start display media: ${error.message}`);
  }
}

async function stopRecording() {
  try {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      // Stop the recorder - this will trigger the onstop event
      mediaRecorder.stop();
      
      // Stop all tracks
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      
      // Clean up watermark resources
      cleanupWatermark();
      
      return { success: true };
    } else {
      throw new Error("No active recording to stop");
    }
  } catch (error) {
    throw new Error(`Failed to stop recording: ${error.message}`);
  }
}

function handleRecordingComplete() {
  try {
    if (recordedChunks.length === 0) {
      throw new Error("No data recorded");
    }

    // Create blob from recorded chunks
    const blob = new Blob(recordedChunks, {
      type: 'video/webm'
    });

    if (blob.size === 0) {
      throw new Error("Recording blob is empty");
    }

    // Use Blob URL approach for large files
    const blobUrl = URL.createObjectURL(blob);

    // Send blob URL to background script
    chrome.runtime.sendMessage({
      action: 'recording-data-url',
      blobUrl: blobUrl,
      size: blob.size
    });

    // Clean up
    recordedChunks = [];
    mediaRecorder = null;

  } catch (error) {
    chrome.runtime.sendMessage({
      action: 'recording-data-url',
      blobUrl: null,
      size: 0,
      error: error.message
    });
  }
}

async function applyWatermark(originalStream) {
  try {
    const videoTrack = originalStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    
    // Create canvas for compositing
    canvas = document.createElement('canvas');
    canvas.width = settings.width || 1920;
    canvas.height = settings.height || 1080;
    canvasCtx = canvas.getContext('2d');
    
    // Create video element to draw the original stream
    const video = document.createElement('video');
    video.srcObject = originalStream;
    video.autoplay = true;
    video.muted = true;
    
    // Wait for video to be ready
    await new Promise((resolve) => {
      video.addEventListener('loadedmetadata', resolve);
    });
    
    // Draw frames with watermark
    const drawFrame = () => {
      if (video.readyState >= 2) { // HAVE_CURRENT_DATA
        // Draw original video frame
        canvasCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Draw watermark
        drawWatermark();
      }
      
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        requestAnimationFrame(drawFrame);
      }
    };
    
    // Start drawing loop
    requestAnimationFrame(drawFrame);
    
    // Get stream from canvas
    compositeStream = canvas.captureStream(30);
    
    return compositeStream;
    
  } catch (error) {
    throw new Error(`Failed to apply watermark: ${error.message}`);
  }
}

function drawWatermark() {
  if (!watermarkSettings || !watermarkSettings.enabled) return;
  
  const { type, position, opacity = 0.8 } = watermarkSettings;
  
  // Save context state
  canvasCtx.save();
  canvasCtx.globalAlpha = opacity;
  
  // Calculate position coordinates
  const { x, y } = getWatermarkPosition(position);
  
  try {
    if (type === 'text') {
      drawTextWatermark(x, y);
    } else if (type === 'image') {
      drawImageWatermark(x, y);
    } else if (type === 'timestamp') {
      drawTimestampWatermark(x, y);
    }
  } catch (error) {
    // Silent fail for watermark errors to not interrupt recording
  }
  
  // Restore context state
  canvasCtx.restore();
}

function drawTextWatermark(x, y) {
  const { text = 'Screen Recording', color = '#ffffff' } = watermarkSettings;
  
  const fontSize = Math.max(16, canvas.width / 60); // Responsive font size
  canvasCtx.font = `${fontSize}px Arial, sans-serif`;
  canvasCtx.fillStyle = color;
  canvasCtx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  canvasCtx.lineWidth = 2;
  
  // Add text stroke for better visibility
  canvasCtx.strokeText(text, x, y);
  canvasCtx.fillText(text, x, y);
}

function drawImageWatermark(x, y) {
  if (!watermarkImageData) return;
  
  // Create image if not already created
  if (!this.watermarkImage) {
    this.watermarkImage = new Image();
    this.watermarkImage.src = watermarkImageData;
  }
  
  if (this.watermarkImage.complete) {
    const maxSize = Math.min(canvas.width, canvas.height) / 8; // Max 1/8 of screen
    const aspectRatio = this.watermarkImage.width / this.watermarkImage.height;
    
    let drawWidth, drawHeight;
    if (aspectRatio > 1) {
      drawWidth = maxSize;
      drawHeight = maxSize / aspectRatio;
    } else {
      drawHeight = maxSize;
      drawWidth = maxSize * aspectRatio;
    }
    
    canvasCtx.drawImage(this.watermarkImage, x, y, drawWidth, drawHeight);
  }
}

function drawTimestampWatermark(x, y) {
  const now = new Date();
  const timestamp = now.toLocaleString();
  
  const fontSize = Math.max(14, canvas.width / 80);
  canvasCtx.font = `${fontSize}px monospace`;
  canvasCtx.fillStyle = '#ffffff';
  canvasCtx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  canvasCtx.lineWidth = 1;
  
  canvasCtx.strokeText(timestamp, x, y);
  canvasCtx.fillText(timestamp, x, y);
}

function getWatermarkPosition(position) {
  const padding = 20;
  let x = padding, y = padding;
  
  switch (position) {
    case 'top-left':
      x = padding;
      y = padding + 30; // Add space for text height
      break;
    case 'top-right':
      x = canvas.width - 200 - padding; // Approximate text width
      y = padding + 30;
      break;
    case 'bottom-left':
      x = padding;
      y = canvas.height - padding;
      break;
    case 'bottom-right':
      x = canvas.width - 200 - padding;
      y = canvas.height - padding;
      break;
    case 'center':
      x = canvas.width / 2 - 100; // Center approximately
      y = canvas.height / 2;
      break;
    default:
      x = canvas.width - 200 - padding; // Default to top-right
      y = padding + 30;
  }
  
  return { x, y };
}

function cleanupWatermark() {
  if (compositeStream) {
    compositeStream.getTracks().forEach(track => track.stop());
    compositeStream = null;
  }
  
  if (canvas) {
    canvas = null;
    canvasCtx = null;
  }
  
  watermarkSettings = null;
  watermarkImageData = null;
}
