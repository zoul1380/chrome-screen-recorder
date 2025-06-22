// Background script using getDisplayMedia approach
// This should reliably show the permission dialog

let isRecording = false;

// Note: chrome.action.onClicked is NOT used when popup is defined in manifest
// The popup handles all user interactions directly

async function startRecording(tab, format = 'webm') {
  try {
    // Check if tab is recordable
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      showNotification("Cannot record this page. Please navigate to a regular website and try again.");
      return;
    }

    // Create offscreen document
    await ensureOffscreenDocument();

    // Send message to offscreen to start getDisplayMedia
    const result = await chrome.runtime.sendMessage({
      target: 'offscreen',
      action: 'start-display-media',
      format: format
    });

    if (result.success) {
      isRecording = true;
      showNotification("🔴 Recording started! Click the extension icon again to stop.");
      
      // Update badge
      chrome.action.setBadgeText({ text: "REC" });
      chrome.action.setBadgeBackgroundColor({ color: "#ff0000" });
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    showNotification(`Error: ${error.message}`);
  }
}

async function stopRecording(format = 'webm') {
  try {
    const result = await chrome.runtime.sendMessage({
      target: 'offscreen',
      action: 'stop-recording',
      format: format
    });

    if (result.success) {
      isRecording = false;
      showNotification("⏹️ Recording stopped! Processing download...");
      chrome.action.setBadgeText({ text: "" });
    } else {
      throw new Error(result.error);
    }

  } catch (error) {
    showNotification(`Error stopping: ${error.message}`);
    isRecording = false;
    chrome.action.setBadgeText({ text: "" });
  }
}

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: 'offscreen-display.html',
      reasons: ['DISPLAY_MEDIA'],
      justification: 'Recording screen using getDisplayMedia'
    });
  }
}

// Handle messages from offscreen and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle popup messages
  if (request.action === 'get-status') {
    sendResponse({ isRecording: isRecording, success: true });
    return true;
  }
  
  if (request.action === 'get-recording-data') {
    sendResponse({ data: globalThis.recordingData || null, success: true });
    return true;
  }
  
  if (request.action === 'record-another') {
    // Clear stored data and potentially open popup
    globalThis.recordingData = null;
    sendResponse({ success: true });
    return true;
  }
    if (request.action === 'start-recording') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        await startRecording(tabs[0], request.format || 'webm');
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "No active tab found" });
      }
    });
    return true;
  }
  
  if (request.action === 'stop-recording') {
    stopRecording(request.format || 'webm').then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  // Handle offscreen messages
  if (request.action === 'recording-data') {
    if (request.data && request.data.byteLength > 0) {
      downloadRecording(request.data, request.format || 'webm');
      isRecording = false;
      chrome.action.setBadgeText({ text: "" });
      showNotification("✅ Recording saved to downloads!");
    } else {
      showNotification("⚠️ Recording was empty");
    }
    
    sendResponse({ success: true });
    return true;
  }
    if (request.action === 'recording-data-url') {
    if (request.blobUrl && request.size > 0) {
      downloadRecordingFromBlobUrl(request.blobUrl, request.size, request.format || 'webm');
      isRecording = false;
      chrome.action.setBadgeText({ text: "" });
      showNotification("✅ Recording saved to downloads!");
    } else {
      showNotification("⚠️ Recording was empty or conversion failed");
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'conversion-progress') {
    // Forward progress updates to popup if open
    chrome.runtime.sendMessage({
      action: 'RECORDING_STATUS',
      status: request.status,
      progress: request.progress,
      type: 'processing'
    }).catch(() => {
      // Popup might be closed, ignore error
    });
    
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'debug-info') {
    sendResponse({ success: true });
    return true;
  }
});

async function downloadRecording(arrayBuffer, format = 'webm') {
  try {
    const base64Data = arrayBufferToBase64(arrayBuffer);
    const mimeType = getMimeType(format);
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const extension = getFileExtension(format);
    const filename = `screen-recording-${timestamp}.${extension}`;

    await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true
    });

  } catch (error) {
    console.error("Download failed:", error);
  }
}

async function downloadRecordingFromBlobUrl(blobUrl, size, format = 'webm') {
  try {
    // Instead of downloading directly, open a results page
    openResultsPage(blobUrl, size, format);

  } catch (error) {
    console.error("Opening results page failed:", error);
    showNotification(`Error: ${error.message}`);
  }
}

async function openResultsPage(blobUrl, size, format) {
  try {
    // Create results page URL with data
    const resultsUrl = chrome.runtime.getURL('results.html');
    
    // Store the data temporarily (could be improved with chrome.storage)
    globalThis.recordingData = {
      blobUrl: blobUrl,
      size: size,
      format: format,
      timestamp: new Date().toISOString()
    };
    
    // Open results page in new tab
    await chrome.tabs.create({
      url: resultsUrl
    });

  } catch (error) {
    console.error("Failed to open results page:", error);
    // Fallback to direct download
    await directDownload(blobUrl, size, format);
  }
}

async function directDownload(blobUrl, size, format) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const extension = getFileExtension(format);
    const filename = `screen-recording-${timestamp}.${extension}`;

    const downloadId = await chrome.downloads.download({
      url: blobUrl,
      filename: filename,
      saveAs: true
    });

  } catch (error) {
    console.error("Direct download failed:", error);
    showNotification(`Download failed: ${error.message}`);
  }
}

function getFileExtension(format) {
  switch (format) {
    case 'mp4': return 'mp4';
    case 'gif': return 'gif';
    case 'webm': return 'webm';
    default: return 'webm';
  }
}

function getMimeType(format) {
  switch (format) {
    case 'mp4': return 'video/mp4';
    case 'gif': return 'image/gif';
    case 'webm': return 'video/webm';
    default: return 'video/webm';
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function showNotification(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title: 'Screen Recorder',
    message: message
  }).catch(() => {
    // Fallback if notifications fail
  });
}
