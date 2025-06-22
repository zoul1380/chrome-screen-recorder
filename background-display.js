// Background script using getDisplayMedia approach
// This should reliably show the permission dialog

let isRecording = false;

// Handle action button clicks - DISABLED because we now use popup
// chrome.action.onClicked.addListener(async (tab) => {
//   if (isRecording) {
//     await stopRecording();
//   } else {
//     await startRecording(tab);
//   }
// });

async function startRecording(tab, watermarkSettings = null) {
  try {
    // Check if tab is recordable
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      showNotification("Cannot record this page. Please navigate to a regular website and try again.");
      return;
    }

    // Create offscreen document
    await ensureOffscreenDocument();

    // Get image data if using image watermark
    let imageData = null;
    if (watermarkSettings && watermarkSettings.enabled && watermarkSettings.type === 'image') {
      const result = await chrome.storage.local.get(['watermarkImageData']);
      imageData = result.watermarkImageData;
    }

    // Send message to offscreen to start getDisplayMedia
    const result = await chrome.runtime.sendMessage({
      target: 'offscreen',
      action: 'start-display-media',
      watermarkSettings: watermarkSettings,
      watermarkImageData: imageData
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

async function stopRecording() {
  try {
    const result = await chrome.runtime.sendMessage({
      target: 'offscreen',
      action: 'stop-recording'
    });

    if (result.success) {
      isRecording = false;
      showNotification("⏹️ Recording stopped! Check your downloads.");
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
    if (request.action === 'start-recording') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        await startRecording(tabs[0], request.watermarkSettings);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "No active tab found" });
      }
    });
    return true;
  }
  
  if (request.action === 'stop-recording') {
    stopRecording().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // Handle offscreen messages
  if (request.action === 'recording-data') {
    if (request.data && request.data.byteLength > 0) {
      downloadRecording(request.data);
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
      downloadRecordingFromBlobUrl(request.blobUrl, request.size);
      isRecording = false;
      chrome.action.setBadgeText({ text: "" });
      showNotification("✅ Recording saved to downloads!");
    } else {
      showNotification("⚠️ Recording was empty");
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'debug-info') {
    sendResponse({ success: true });
    return true;
  }
});

async function downloadRecording(arrayBuffer) {
  try {
    const base64Data = arrayBufferToBase64(arrayBuffer);
    const dataUrl = `data:video/webm;base64,${base64Data}`;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `screen-recording-${timestamp}.webm`;

    await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true
    });

  } catch (error) {
    console.error("Download failed:", error);
  }
}

async function downloadRecordingFromBlobUrl(blobUrl, size) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `screen-recording-${timestamp}.webm`;

    const downloadId = await chrome.downloads.download({
      url: blobUrl,
      filename: filename,
      saveAs: true
    });

  } catch (error) {
    console.error("Download from Blob URL failed:", error);
    showNotification(`Download failed: ${error.message}`);
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
