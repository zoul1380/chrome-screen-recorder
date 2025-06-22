// Offscreen document for handling getDisplayMedia
// This runs in a separate context for security and API access

let mediaRecorder = null;
let recordedChunks = [];
let stream = null;
let formatConverter = null;
let currentFormat = 'webm';
let recordingMimeType = 'video/webm';
let dataRequestInterval = null;

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
    }    // Setup MediaRecorder
    recordedChunks = [];
      // Try different codec options for better compatibility and duration metadata
    let options = null;
    
    // Try VP8 first (most reliable for duration metadata)
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      options = {
        mimeType: 'video/webm;codecs=vp8',
        videoBitsPerSecond: 2500000
      };
    }
    // Try VP9 (better compression but sometimes problematic duration)
    else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      options = {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000
      };
    }
    // Final fallback to basic WebM
    else if (MediaRecorder.isTypeSupported('video/webm')) {
      options = {
        mimeType: 'video/webm',
        videoBitsPerSecond: 2500000
      };
    }
    else {
      throw new Error('WebM recording not supported in this browser');
    }mediaRecorder = new MediaRecorder(stream, options);
    
    // Store the actual MIME type used
    recordingMimeType = options.mimeType;

    // Handle data collection
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };    // Handle stop event
    mediaRecorder.onstop = () => {
      // Add a small delay to ensure all data is collected
      setTimeout(() => {
        try {
          handleRecordingComplete();
        } catch (error) {
          chrome.runtime.sendMessage({
            action: 'recording-data-url',
            blobUrl: null,
            size: 0,
            error: `Error in recording completion: ${error.message}`
          });
        }
      }, 100);
    };
    
    // Handle recording state changes
    mediaRecorder.onstart = () => {
      chrome.runtime.sendMessage({
        action: 'RECORDING_STATUS',
        status: 'Recording started successfully',
        type: 'success'
      });
    };

    // Handle errors
    mediaRecorder.onerror = (event) => {
      throw new Error(`MediaRecorder error: ${event.error}`);
    };    // Start recording with timeslice for better duration metadata
    mediaRecorder.start(1000); // 1 second timeslice for better metadata
    
    // Also request data every 2 seconds as backup
    dataRequestInterval = setInterval(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.requestData();
      } else {
        clearInterval(dataRequestInterval);
        dataRequestInterval = null;
      }
    }, 2000);

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
      
      // Clear the data request interval
      if (dataRequestInterval) {
        clearInterval(dataRequestInterval);
        dataRequestInterval = null;
      }
      
      // Request final data before stopping
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.requestData();
        
        // Give a small delay for data to be collected
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Stop the recorder - this will trigger the onstop event
        mediaRecorder.stop();
      }
      
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
    // Clean up interval on error
    if (dataRequestInterval) {
      clearInterval(dataRequestInterval);
      dataRequestInterval = null;
    }
    throw new Error(`Failed to stop recording: ${error.message}`);
  }
}

function handleRecordingComplete() {
  // Handle async WebM processing
  processRecording().catch(error => {
    chrome.runtime.sendMessage({
      action: 'recording-data-url',
      blobUrl: null,
      size: 0,
      error: error.message
    });
  });
}

async function processRecording() {
  if (recordedChunks.length === 0) {
    throw new Error("No data recorded - chunks array is empty");
  }

  // Debug information
  const totalSize = recordedChunks.reduce((total, chunk) => total + chunk.size, 0);
  chrome.runtime.sendMessage({
    action: 'RECORDING_STATUS',
    status: `Processing ${recordedChunks.length} chunks (${(totalSize/1024/1024).toFixed(2)} MB)`,
    type: 'info'
  });

  // Create blob from recorded chunks with the actual MIME type used
  let webmBlob = new Blob(recordedChunks, {
    type: recordingMimeType
  });

  if (webmBlob.size === 0) {
    throw new Error("Recording blob is empty after creation");
  }
  // Clear chunks to free memory
  recordedChunks = [];

  // Send WebM blob directly - duration validation will be done in results page
  chrome.runtime.sendMessage({
    action: 'RECORDING_STATUS',
    status: `WebM created: ${(webmBlob.size/1024/1024).toFixed(2)} MB`,
    type: 'success'
  });
  // Handle format conversion if needed
  if (currentFormat === 'webm') {
    // No conversion needed, send WebM directly  
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