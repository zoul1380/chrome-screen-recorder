// Offscreen document for handling getDisplayMedia
// This runs in a separate context for security and API access

let mediaRecorder = null;
let recordedChunks = [];
let stream = null;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.target !== 'offscreen') {
    return;
  }

  if (request.action === 'start-display-media') {
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
