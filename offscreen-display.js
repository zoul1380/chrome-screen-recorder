// Offscreen document for handling getDisplayMedia
// This runs in a separate context for security and API access

let mediaRecorder = null;
let recordedChunks = [];
let stream = null;
let formatConverter = null;
let currentFormat = 'webm';

// Initialize format converter
function initFormatConverter() {
  if (!formatConverter) {
    formatConverter = new SimpleFormatConverter();
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.target !== 'offscreen') {
    return;
  }
  if (request.action === 'start-display-media') {
    currentFormat = request.format || 'webm';
    startDisplayMedia()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }

  if (request.action === 'stop-recording') {
    stopRecording(request.format || 'webm')
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

    mediaRecorder = new MediaRecorder(stream, options);

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
    
    throw new Error(`Failed to start display media: ${error.message}`);
  }
}

async function stopRecording(format = 'webm') {
  try {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      currentFormat = format;
      // Stop the recorder - this will trigger the onstop event
      mediaRecorder.stop();
      
      // Stop all tracks
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      
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
    const webmBlob = new Blob(recordedChunks, {
      type: 'video/webm'
    });

    if (webmBlob.size === 0) {
      throw new Error("Recording blob is empty");
    }    // Handle format conversion if needed
    if (currentFormat === 'webm') {
      // No conversion needed, use original WebM
      const blobUrl = URL.createObjectURL(webmBlob);
      sendRecordingData(blobUrl, webmBlob.size, 'webm');
    } else if (currentFormat === 'webm-h264') {
      // Convert to WebM with H.264 codec for better compatibility
      convertToWebMH264(webmBlob);
    } else {
      // Convert to requested format
      convertAndSendRecording(webmBlob, currentFormat);
    }

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

async function convertAndSendRecording(webmBlob, targetFormat) {
  try {
    // Initialize converter if needed
    initFormatConverter();
    
    // Send progress update
    chrome.runtime.sendMessage({
      action: 'conversion-progress',
      status: 'Converting to ' + targetFormat.toUpperCase() + '...',
      progress: 0
    });

    let convertedBlob;    if (targetFormat === 'gif') {
      // Use optimized settings for GIF
      convertedBlob = await formatConverter.convertToGIF(webmBlob, {
        width: 480,
        fps: 12,
        quality: 'medium'
      }, (progress) => {
        chrome.runtime.sendMessage({
          action: 'conversion-progress',
          status: 'Converting to GIF...',
          progress: Math.round(progress * 100)
        });
      });
    } else {
      throw new Error(`Unsupported format: ${targetFormat}`);
    }

    // Send converted file
    const blobUrl = URL.createObjectURL(convertedBlob);
    sendRecordingData(blobUrl, convertedBlob.size, targetFormat);

    chrome.runtime.sendMessage({
      action: 'conversion-progress',
      status: 'Conversion complete!',
      progress: 100
    });

  } catch (error) {
    chrome.runtime.sendMessage({
      action: 'recording-data-url',
      blobUrl: null,
      size: 0,
      error: `Conversion failed: ${error.message}`
    });
  }
}

async function convertToWebMH264(webmBlob) {
  try {
    // Send progress update
    chrome.runtime.sendMessage({
      action: 'conversion-progress',
      status: 'Converting to WebM (H.264)...',
      progress: 0
    });

    // Initialize converter if needed
    initFormatConverter();
    
    const convertedBlob = await formatConverter.convertToWebMH264(webmBlob, (progress) => {
      chrome.runtime.sendMessage({
        action: 'conversion-progress',
        status: 'Converting to WebM (H.264)...',
        progress: Math.round(progress * 100)
      });
    });

    // Send converted file
    const blobUrl = URL.createObjectURL(convertedBlob);
    sendRecordingData(blobUrl, convertedBlob.size, 'webm');

    chrome.runtime.sendMessage({
      action: 'conversion-progress',
      status: 'Conversion complete!',
      progress: 100
    });

  } catch (error) {
    chrome.runtime.sendMessage({
      action: 'recording-data-url',
      blobUrl: null,
      size: 0,
      error: `H.264 conversion failed: ${error.message}`
    });
  }
}

function sendRecordingData(blobUrl, size, format) {
  chrome.runtime.sendMessage({
    action: 'recording-data-url',
    blobUrl: blobUrl,
    size: size,
    format: format
  });
}
