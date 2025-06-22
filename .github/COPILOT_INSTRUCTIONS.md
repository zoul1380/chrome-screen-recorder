# GitHub Copilot Instructions for Chrome Screen Recorder Extension

## 🎯 Project Overview

This is a **Chrome Extension (Manifest V3)** for screen recording with WebM output. The project uses:
- **getDisplayMedia API** for screen capture
- **Offscreen Document architecture** for MediaRecorder operations
- **Blob URL transfer** for large file handling
- **Service Worker** background script
- **Clean, production-ready codebase** (no console.log statements in production)

## 🔄 Development Workflow

### **MANDATORY: Branch-First Development**
- ✅ **ALWAYS create a new branch** for any development work
- ✅ **NEVER commit directly to main branch**
- ✅ **Use descriptive branch names** following the pattern: `feature/description` or `fix/description`

### **Branch Creation Commands**
```bash
# For new features
git checkout -b feature/add-audio-recording
git checkout -b feature/recording-quality-settings
git checkout -b feature/pause-resume-functionality

# For bug fixes
git checkout -b fix/permission-dialog-timing
git checkout -b fix/download-filename-format

# For improvements
git checkout -b improve/error-handling
git checkout -b improve/ui-responsiveness
```

## 📁 Core Project Architecture

### **Critical Files - Handle with Care**
- `manifest.json` - Extension configuration (validate JSON syntax)
- `background-display.js` - Service worker (handles lifecycle, downloads, offscreen coordination)
- `offscreen-display.js` - Screen capture logic (getDisplayMedia, MediaRecorder)
- `popup.html/js` - User interface (recording controls, status display)
- `offscreen-display.html` - Minimal HTML for offscreen document

### **File Interaction Patterns**
```
Popup UI ↔ Background Service Worker ↔ Offscreen Document
         ↕                         ↕
    User Controls              MediaRecorder
                              getDisplayMedia
```

## 🚨 Critical Development Guidelines

### **Console.log Policy**
- ❌ **NO console.log statements** in production code
- ✅ **Use chrome.runtime.sendMessage** for debug info relay instead
- ✅ **Remove all console.log before committing**

### **Message Passing Patterns**
```javascript
// Popup to Background
chrome.runtime.sendMessage({
  action: 'start-recording' | 'stop-recording' | 'get-status'
});

// Background to Offscreen
chrome.runtime.sendMessage({
  target: 'offscreen',
  action: 'start-display-media' | 'stop-recording'
});

// Offscreen to Background (data transfer)
chrome.runtime.sendMessage({
  action: 'recording-data-url',
  blobUrl: blobUrl,
  size: blob.size
});
```

### **Error Handling Requirements**
- ✅ **Always wrap async operations in try-catch**
- ✅ **Provide user-friendly error messages via notifications**
- ✅ **Clean up resources on errors** (stop streams, reset state)
- ✅ **Use sendResponse for message handling**

## 🎬 Screen Recording Specifics

### **getDisplayMedia Configuration**
```javascript
// Standard configuration for screen capture
await navigator.mediaDevices.getDisplayMedia({
  video: {
    mediaSource: 'screen',
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 }
  },
  audio: false // Currently video-only
});
```

### **MediaRecorder Best Practices**
- ✅ **Validate stream has video tracks** before recording
- ✅ **Use codec fallback** (vp8,vp9 → webm)
- ✅ **Collect data every 100ms** for smooth recording
- ✅ **Handle ondataavailable and onstop events**

### **Large File Transfer**
- ✅ **Use Blob URLs** instead of direct ArrayBuffer transfer
- ✅ **Clean up Blob URLs** after download initiation
- ❌ **NEVER send large data via chrome.runtime.sendMessage**

## 🔧 Extension Development Patterns

### **State Management**
```javascript
// Centralized in background script
let isRecording = false;

// Update UI indicators
chrome.action.setBadgeText({ text: isRecording ? "REC" : "" });
chrome.action.setBadgeBackgroundColor({ color: "#ff0000" });
```

### **Offscreen Document Management**
```javascript
// Always check existing contexts before creation
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
```

## 🧪 Testing Requirements

### **Before Committing**
- ✅ **Test recording start/stop functionality**
- ✅ **Verify permission dialog appears**
- ✅ **Confirm download completes successfully**
- ✅ **Check for syntax errors** using `get_errors` tool
- ✅ **Validate manifest.json** structure

### **Cross-Browser Testing**
- ✅ **Test on different Chrome versions**
- ✅ **Verify on various screen resolutions**
- ✅ **Test different recording sources** (screen, window, tab)

## 📝 Code Quality Standards

### **Naming Conventions**
```javascript
// Functions: camelCase with descriptive names
async function startDisplayMedia() {}
async function handleRecordingComplete() {}

// Variables: descriptive and clear
let mediaRecorder = null;
let recordedChunks = [];
const blobUrl = URL.createObjectURL(blob);

// Constants: UPPER_SNAKE_CASE
const MAX_RECORDING_DURATION = 300000; // 5 minutes
```

### **Function Structure**
```javascript
async function functionName() {
  try {
    // Input validation
    if (!requiredParam) {
      throw new Error("Required parameter missing");
    }
    
    // Main logic
    const result = await performOperation();
    
    // Success handling
    return { success: true, data: result };
    
  } catch (error) {
    // Error handling with cleanup
    performCleanup();
    throw new Error(`Operation failed: ${error.message}`);
  }
}
```

## 🔮 Future Development Areas

### **Immediate Enhancements**
- Audio recording support (microphone + system audio)
- Recording quality settings (resolution, bitrate)
- Recording timer with duration display
- Pause/resume functionality

### **Format Conversion Features**
- WebP animated image output
- GIF generation with optimization
- MP4 conversion for compatibility
- Format selection in UI

### **Advanced Features**
- Cloud storage integration (Google Drive, Dropbox)
- Basic video editing (trim, split)
- Annotation tools (text, arrows, shapes)
- Hotkey support for start/stop

## 🚀 Deployment Guidelines

### **Pre-Release Checklist**
- ✅ All console.log statements removed
- ✅ No debug or test files included
- ✅ Manifest permissions minimized
- ✅ Code formatted and documented
- ✅ README.md updated with changes
- ✅ Version number incremented in manifest.json

### **Chrome Web Store Preparation**
- ✅ Icon files in required sizes (16, 48, 128px)
- ✅ Screenshots for store listing
- ✅ Privacy policy if using user data
- ✅ Extension description and keywords

## 💡 Development Tips

### **Debugging Strategies**
```javascript
// Use message relay for debugging instead of console.log
chrome.runtime.sendMessage({
  action: 'debug-info',
  info: `Debug: ${JSON.stringify(debugData)}`
});

// Check multiple contexts for errors
// 1. Extension popup (right-click → Inspect)
// 2. Background script (chrome://extensions/ → Inspect views)
// 3. Offscreen document (DevTools → Sources → Select context)
```

### **Common Pitfalls to Avoid**
- ❌ Forgetting user gesture requirements for getDisplayMedia
- ❌ Not handling stream.getTracks()[0].addEventListener('ended')
- ❌ Sending large data through message passing
- ❌ Not cleaning up Blob URLs and streams
- ❌ Missing error handlers for async operations

## 📋 Commit Message Format

```
🎯 Type: Brief description

✨ Details:
- Specific change 1
- Specific change 2

🧪 Testing:
- Test case 1 verified
- Test case 2 verified

📁 Files Modified:
- filename.js - description of changes
```

**Example:**
```
🎯 Feature: Add recording quality settings

✨ Details:
- Added quality dropdown in popup UI
- Implemented bitrate configuration in MediaRecorder
- Added user preference storage
- Updated settings validation

🧪 Testing:
- Verified quality changes affect file size
- Tested settings persistence across sessions

📁 Files Modified:
- popup.html - Added quality selector dropdown
- popup.js - Added settings handling logic
- offscreen-display.js - Updated MediaRecorder config
- manifest.json - Added storage permission
```

---

**Remember: Clean code, thorough testing, and proper branching are essential for maintaining this production-ready Chrome extension!** 🚀
