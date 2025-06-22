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
    chrome.runtime.sendMessage({
      action: 'debug-info',
      info: `Starting display media capture with watermark settings: ${JSON.stringify(watermarkSettings)}`
    });
    
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

    chrome.runtime.sendMessage({
      action: 'debug-info',
      info: `Original stream created with ${videoTracks.length} video tracks`
    });    let recordingStream = stream;    // Apply watermark if enabled - using simplified approach
    if (watermarkSettings && watermarkSettings.enabled) {
      try {
        chrome.runtime.sendMessage({
          action: 'debug-info',
          info: 'Applying simplified watermark to stream...'
        });
        recordingStream = await applySimpleWatermark(stream);
        
        if (!recordingStream || recordingStream.getVideoTracks().length === 0) {
          throw new Error("Failed to create watermarked stream");
        }
        
        chrome.runtime.sendMessage({
          action: 'debug-info',
          info: `Watermarked stream created with ${recordingStream.getVideoTracks().length} video tracks`
        });
      } catch (watermarkError) {
        chrome.runtime.sendMessage({
          action: 'debug-info',
          info: `Watermark failed, using original stream: ${watermarkError.message}`
        });
        // Fall back to original stream if watermark fails
        recordingStream = stream;
        cleanupWatermark();
      }
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
      chrome.runtime.sendMessage({
        action: 'debug-info',
        info: 'Using fallback mimeType: video/webm'
      });
    }

    mediaRecorder = new MediaRecorder(recordingStream, options);

    chrome.runtime.sendMessage({
      action: 'debug-info',
      info: `MediaRecorder created with mimeType: ${options.mimeType}`
    });

    // Handle data collection
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
        chrome.runtime.sendMessage({
          action: 'debug-info',
          info: `Data chunk received: ${event.data.size} bytes, total chunks: ${recordedChunks.length}`
        });
      }
    };

    // Handle stop event
    mediaRecorder.onstop = () => {
      chrome.runtime.sendMessage({
        action: 'debug-info',
        info: `Recording stopped, processing ${recordedChunks.length} chunks`
      });
      handleRecordingComplete();
    };

    // Handle errors
    mediaRecorder.onerror = (event) => {
      chrome.runtime.sendMessage({
        action: 'debug-info',
        info: `MediaRecorder error: ${event.error}`
      });
      throw new Error(`MediaRecorder error: ${event.error}`);
    };

    // Start recording with data collection every 100ms
    mediaRecorder.start(100);
    
    chrome.runtime.sendMessage({
      action: 'debug-info',
      info: 'MediaRecorder started'
    });

    // Listen for user stopping the screen share
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      chrome.runtime.sendMessage({
        action: 'debug-info',
        info: 'Screen share ended by user'
      });
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    });

    return { success: true };

  } catch (error) {
    chrome.runtime.sendMessage({
      action: 'debug-info',
      info: `startDisplayMedia error: ${error.message}`
    });
    
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
    
    chrome.runtime.sendMessage({
      action: 'debug-info',
      info: `Applying watermark - canvas size: ${settings.width}x${settings.height}`
    });
    
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
    video.playsInline = true;
    
    // Add video to document to ensure it plays properly
    video.style.position = 'absolute';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    document.body.appendChild(video);
    
    // Wait for video to be ready and actually playing
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Video failed to load within 10 seconds'));
      }, 10000);
      
      video.addEventListener('loadedmetadata', () => {
        chrome.runtime.sendMessage({
          action: 'debug-info',
          info: `Video metadata loaded - dimensions: ${video.videoWidth}x${video.videoHeight}`
        });
      });
      
      video.addEventListener('canplay', () => {
        clearTimeout(timeout);
        chrome.runtime.sendMessage({
          action: 'debug-info',
          info: `Video can play - starting watermark composition`
        });
        resolve();
      });
      
      video.addEventListener('error', (e) => {
        clearTimeout(timeout);
        reject(new Error(`Video error: ${e.message}`));
      });
    });
    
    // Ensure video is actually playing
    await video.play();
    
    let frameCount = 0;
    
    // Draw frames with watermark
    const drawFrame = () => {
      if (video.readyState >= 2 && !video.paused && !video.ended) {
        // Draw original video frame
        canvasCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Draw watermark
        drawWatermark();
        
        frameCount++;
        if (frameCount % 30 === 0) { // Log every 30 frames (roughly every second)
          chrome.runtime.sendMessage({
            action: 'debug-info',
            info: `Watermark frames rendered: ${frameCount}`
          });
        }
      }
      
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        requestAnimationFrame(drawFrame);
      }
    };
    
    // Start drawing loop
    requestAnimationFrame(drawFrame);
    
    // Get stream from canvas with proper frame rate
    compositeStream = canvas.captureStream(30);
    
    chrome.runtime.sendMessage({
      action: 'debug-info',
      info: `Canvas stream created with ${compositeStream.getVideoTracks().length} video tracks`
    });
    
    return compositeStream;
    
  } catch (error) {
    chrome.runtime.sendMessage({
      action: 'debug-info',
      info: `Watermark application failed: ${error.message}`
    });
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
  // Remove video element from DOM if it exists
  const videos = document.querySelectorAll('video[style*="-9999px"]');
  videos.forEach(video => {
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
    video.remove();
  });
  
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
  
  chrome.runtime.sendMessage({
    action: 'debug-info',
    info: 'Watermark resources cleaned up'
  });
}

async function applySimpleWatermark(originalStream) {
  return new Promise((resolve, reject) => {
    try {
      const videoTrack = originalStream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      
      chrome.runtime.sendMessage({
        action: 'debug-info',
        info: `Simple watermark - canvas size: ${settings.width}x${settings.height}`
      });
      
      // Create canvas for compositing
      canvas = document.createElement('canvas');
      canvas.width = settings.width || 1920;
      canvas.height = settings.height || 1080;
      canvasCtx = canvas.getContext('2d');
      
      // Create video element
      const video = document.createElement('video');
      video.srcObject = originalStream;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.style.display = 'none';
      
      let isReady = false;
      
      // Simple ready check
      video.onloadeddata = () => {
        chrome.runtime.sendMessage({
          action: 'debug-info',
          info: 'Video data loaded, starting watermark rendering'
        });
        
        isReady = true;
        startSimpleWatermarkLoop();
      };
      
      // Error handling
      video.onerror = (e) => {
        chrome.runtime.sendMessage({
          action: 'debug-info',
          info: `Video error in simple watermark: ${e.message}`
        });
        reject(new Error(`Video error: ${e.message}`));
      };
      
      // Timeout fallback
      setTimeout(() => {
        if (!isReady) {
          chrome.runtime.sendMessage({
            action: 'debug-info',
            info: 'Simple watermark timeout, using original stream'
          });
          resolve(originalStream);
        }
      }, 3000);
      
      function startSimpleWatermarkLoop() {
        try {
          // Draw first frame to test
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            canvasCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
            drawSimpleWatermark();
            
            // Get stream from canvas
            compositeStream = canvas.captureStream(30);
            
            if (compositeStream && compositeStream.getVideoTracks().length > 0) {
              chrome.runtime.sendMessage({
                action: 'debug-info',
                info: 'Simple watermark stream created successfully'
              });
              
              // Start continuous drawing
              requestAnimationFrame(drawVideoFrame);
              resolve(compositeStream);
            } else {
              throw new Error('Failed to create canvas stream');
            }
          } else {
            // Try again after a short delay
            setTimeout(startSimpleWatermarkLoop, 100);
          }
        } catch (error) {
          chrome.runtime.sendMessage({
            action: 'debug-info',
            info: `Simple watermark loop error: ${error.message}`
          });
          resolve(originalStream);
        }
      }
      
      function drawVideoFrame() {
        try {
          if (video.readyState >= 2 && mediaRecorder && mediaRecorder.state === 'recording') {
            canvasCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
            drawSimpleWatermark();
            requestAnimationFrame(drawVideoFrame);
          }
        } catch (error) {
          // Silent fail to not break recording
          chrome.runtime.sendMessage({
            action: 'debug-info',
            info: `Frame draw error: ${error.message}`
          });
        }
      }
      
    } catch (error) {
      chrome.runtime.sendMessage({
        action: 'debug-info',
        info: `Simple watermark setup error: ${error.message}`
      });
      reject(error);
    }
  });
}

function drawSimpleWatermark() {
  if (!watermarkSettings || !watermarkSettings.enabled || !canvasCtx) return;
  
  try {
    canvasCtx.save();
    canvasCtx.globalAlpha = watermarkSettings.opacity || 0.8;
    
    const position = watermarkSettings.position || 'top-right';
    const { x, y } = getSimpleWatermarkPosition(position);
    
    if (watermarkSettings.type === 'text') {
      const text = watermarkSettings.text || 'Screen Recording';
      const color = watermarkSettings.color || '#ffffff';
      
      const fontSize = Math.max(20, canvas.width / 50);
      canvasCtx.font = `bold ${fontSize}px Arial, sans-serif`;
      canvasCtx.fillStyle = color;
      canvasCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      canvasCtx.lineWidth = 3;
      
      // Draw text with outline
      canvasCtx.strokeText(text, x, y);
      canvasCtx.fillText(text, x, y);
      
    } else if (watermarkSettings.type === 'timestamp') {
      const timestamp = new Date().toLocaleString();
      
      const fontSize = Math.max(16, canvas.width / 80);
      canvasCtx.font = `${fontSize}px monospace`;
      canvasCtx.fillStyle = '#ffffff';
      canvasCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      canvasCtx.lineWidth = 2;
      
      canvasCtx.strokeText(timestamp, x, y);
      canvasCtx.fillText(timestamp, x, y);
    }
    
    canvasCtx.restore();
    
  } catch (error) {
    // Silent fail for watermark drawing errors
  }
}

function getSimpleWatermarkPosition(position) {
  const padding = 30;
  let x = padding, y = padding + 40;
  
  switch (position) {
    case 'top-left':
      x = padding;
      y = padding + 40;
      break;
    case 'top-right':
      x = canvas.width - 250 - padding;
      y = padding + 40;
      break;
    case 'bottom-left':
      x = padding;
      y = canvas.height - padding - 10;
      break;
    case 'bottom-right':
      x = canvas.width - 250 - padding;
      y = canvas.height - padding - 10;
      break;
    case 'center':
      x = canvas.width / 2 - 125;
      y = canvas.height / 2;
      break;
    default:
      x = canvas.width - 250 - padding;
      y = padding + 40;
  }
  
  return { x, y };
}
