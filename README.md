# WebP & GIF Page Recorder - Chrome Extension

A powerful Chrome extension (Manifest V3) that records browser tabs and screens, allowing users to download recordings as WebM video files. Originally designed for WebP and GIF output, the extension provides a solid foundation for screen recording with future format conversion capabilities.

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Features](#-features)
- [Installation](#-installation)
- [Usage Guide](#-usage-guide)
- [Technical Architecture](#-technical-architecture)
- [Bug Documentation & Fixes](#-bug-documentation--fixes)
- [File Structure](#-file-structure)
- [Development Journey](#-development-journey)
- [Future Features Roadmap](#-future-features-roadmap)
- [Troubleshooting](#-troubleshooting)
- [Technical References](#-technical-references)
- [License](#-license)

## 🎯 Project Overview

The **WebP & GIF Page Recorder** is a Chrome extension that enables users to record browser content (tabs or entire screens) and download the recordings as WebM video files. The project demonstrates advanced Chrome extension development techniques including:

- Manifest V3 service worker architecture
- Screen capture using `getDisplayMedia` API
- Offscreen document processing
- Large data transfer optimization using Blob URLs
- Real-time recording with MediaRecorder API

### Original Goals
- Record browser tabs and convert to WebP/GIF formats
- Provide simple one-click recording functionality
- Ensure cross-platform compatibility
- Maintain security and performance standards

### Current Status
✅ **Fully Functional Screen Recording**
✅ **WebM Video Output**
✅ **Native Chrome Permission Integration**
✅ **Reliable Large File Downloads**
🔄 **WebP/GIF Conversion** (Future enhancement)

## ✨ Features

### Core Functionality
- 🎬 **Screen Recording**: Record entire screen, specific windows, or browser tabs
- 📹 **High-Quality Output**: WebM format with configurable quality settings
- 🔒 **Native Permissions**: Integrates with Chrome's built-in screen sharing permissions
- 💾 **Reliable Downloads**: Handles large video files (2MB+) without corruption
- 🎛️ **Simple Interface**: Clean popup UI with start/stop controls
- 🔄 **Background Processing**: All recording handled in service worker for optimal performance
- 💧 **Watermark Support**: Add custom text, images, or timestamps to recordings

### Watermark Features
- **Text Watermarks**: Add custom text with adjustable color, size, and opacity
- **Image Watermarks**: Upload and overlay custom images with opacity control
- **Timestamp Watermarks**: Automatically add current date/time to recordings
- **Flexible Positioning**: Place watermarks in any corner or center of the screen
- **Persistent Settings**: Watermark preferences are saved across browser sessions

### Technical Features
- **Manifest V3 Compliance**: Modern Chrome extension architecture
- **Offscreen Document Processing**: Isolated recording environment
- **Blob URL Optimization**: Bypasses Chrome extension message size limits
- **Error Handling**: Comprehensive error detection and user feedback
- **Debug Logging**: Detailed console output for development and troubleshooting

## 🚀 Installation

### For Users
1. **Download the Extension**
   - Clone or download the repository
   - Extract files to a local directory

2. **Install in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - The extension icon should appear in your toolbar

3. **Grant Permissions**
   - The extension will request necessary permissions on first use
   - Screen recording permission will be requested when starting a recording

### For Developers
```bash
git clone <repository-url>
cd screenrecord
# Open chrome://extensions/ and load the unpacked extension
```

## 📖 Usage Guide

### Quick Start
1. **Navigate to Target Content**
   - Open any website you want to record
   - Ensure the content is visible and active

2. **Start Recording**
   - Click the extension icon in Chrome toolbar
   - Select recording format (WebM recommended)
   - Click "Start Recording"
   - Grant screen sharing permission when prompted

3. **Choose Recording Source**
   - Select "Entire screen" for full screen recording
   - Select "Window" to record a specific application window
   - Select "Chrome Tab" to record only the current browser tab

4. **Stop Recording**
   - Click the extension icon again
   - Click "Stop Recording"
   - The video file will automatically download

### Watermark Usage

#### Adding Text Watermarks
1. **Enable Watermarks**
   - Check the "💧 Add Watermark" checkbox in the popup
   - The watermark controls will appear

2. **Configure Text Watermark**
   - Select "Text Watermark" from the dropdown
   - Enter your custom text (default: "Screen Recording")
   - Choose text color using the color picker
   - Adjust opacity with the slider (0.1 to 1.0)
   - Select position from dropdown (Top Left, Top Right, Bottom Left, Bottom Right, Center)

#### Adding Image Watermarks
1. **Select Image Type**
   - Choose "Image Watermark" from the dropdown
   - Click "Choose File" to upload your image
   - Supported formats: PNG, JPG, GIF, WebP
   - Adjust opacity for transparency effect

2. **Image Requirements**
   - Recommended size: 200x200 pixels or smaller
   - Transparent PNG files work best for professional overlay
   - Image will be automatically scaled to fit appropriately

#### Adding Timestamp Watermarks
- Select "Timestamp" from the dropdown
- Current date and time will be automatically added to recordings
- Format: "MM/DD/YYYY, HH:MM:SS AM/PM"
- Position and opacity can be adjusted

#### Watermark Best Practices
- **Opacity**: Use 0.6-0.8 for subtle branding without interfering with content
- **Position**: Top Right is recommended for minimal interference
- **Text Length**: Keep text short (under 20 characters) for best results
- **Colors**: White text with slight transparency works well on most backgrounds

### Advanced Usage

#### Recording Settings
- **Duration**: Record for at least 5-10 seconds for valid video files
- **Quality**: Extension uses optimal settings for web content
- **Audio**: Currently video-only (audio support planned for future)

#### File Management
- **Filename Format**: `screen-recording-YYYY-MM-DD.webm`
- **Default Location**: Chrome's default download folder
- **File Size**: Typical recordings are 1-5MB for short clips

#### Conversion to Other Formats
Since Chrome extensions have security restrictions for format conversion, use these online tools:
- **[CloudConvert](https://cloudconvert.com/)** - Professional conversion service
- **[EZGIF](https://ezgif.com/)** - Free GIF and WebP converter
- **[Online-Convert](https://www.online-convert.com/)** - Multiple format support

## 🏗️ Technical Architecture

### System Overview
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Popup UI      │    │  Background      │    │   Offscreen     │
│   (popup.js)    │◄──►│  Service Worker  │◄──►│   Document      │
│                 │    │ (background.js)  │    │ (offscreen.js)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                        │                        │
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Input    │    │    Downloads     │    │  MediaRecorder  │
│   & Display     │    │      API         │    │ & getDisplayMedia│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Core Components

#### 1. Manifest Configuration (`manifest.json`)
```json
{
  "manifest_version": 3,
  "permissions": [
    "tabCapture", "activeTab", "storage", 
    "downloads", "scripting", "offscreen", "notifications"
  ],
  "background": {
    "service_worker": "background-display.js"
  }
}
```

#### 2. Background Service Worker (`background-display.js`)
- Handles extension lifecycle
- Manages offscreen document creation
- Processes download requests
- Coordinates recording state

#### 3. Offscreen Document (`offscreen-display.js`)
- Executes `getDisplayMedia()` API calls
- Handles MediaRecorder operations
- Processes video data chunks
- Creates optimized Blob URLs
- **Canvas Compositing**: Applies watermarks to video streams using HTML5 Canvas
- **Real-time Overlay**: Renders text, images, and timestamps frame-by-frame

#### 4. User Interface (`popup.html`, `popup.js`)
- Recording controls
- Status display
- Error messaging
- Format selection
- **Watermark Configuration**: Settings for text, image, and timestamp watermarks
- **Persistent Storage**: Saves watermark preferences using chrome.storage.local

### Data Flow

1. **User Interaction**: User clicks extension icon and starts recording
2. **Watermark Configuration**: User sets up watermark preferences (text, image, position, opacity)
3. **Permission Request**: `getDisplayMedia()` triggers Chrome's native permission dialog
4. **Stream Capture**: Selected screen/window content is captured as MediaStream
5. **Canvas Compositing**: If watermarks enabled, original stream is composited with overlay using HTML5 Canvas
6. **Data Recording**: MediaRecorder processes stream (original or watermarked) into video chunks
7. **Data Transfer**: Blob URLs bypass Chrome extension message size limits
8. **File Download**: Chrome downloads API saves the video file with watermarks embedded

## 🐛 Bug Documentation & Fixes

### Critical Issues Resolved

#### 1. **Chrome Extension Message Size Limit**
**Problem**: Large video files (2MB+) were being truncated to 0 bytes during transfer from offscreen document to background script.

**Root Cause**: Chrome extensions have a message size limit for `chrome.runtime.sendMessage()`. Large ArrayBuffer objects cannot be transferred directly.

**Solution**: Implemented Blob URL transfer mechanism
```javascript
// Instead of sending raw data:
chrome.runtime.sendMessage({ data: arrayBuffer }); // FAILS for large files

// Use Blob URLs:
const blobUrl = URL.createObjectURL(blob);
chrome.runtime.sendMessage({ blobUrl: blobUrl, size: blob.size }); // SUCCESS
```

**Reference**: [Chrome Extensions Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)

#### 2. **MediaRecorder Data Availability Issues**
**Problem**: `ondataavailable` events were not firing consistently, resulting in empty recordings.

**Root Cause**: MediaRecorder requires proper stream initialization and timing configuration.

**Solution**: Enhanced stream validation and timing optimization
```javascript
// Validate stream has video tracks
const videoTracks = stream.getVideoTracks();
if (videoTracks.length === 0) {
  throw new Error("No video tracks available");
}

// Optimize data collection timing
mediaRecorder.start(100); // Collect data every 100ms
```

#### 3. **Offscreen Document Context Isolation**
**Problem**: Console logs from offscreen document were not visible in main extension console, making debugging difficult.

**Root Cause**: Offscreen documents run in separate contexts with isolated console output.

**Solution**: Implemented debug message relay system
```javascript
// Send debug info to background script
chrome.runtime.sendMessage({
  action: 'debug-info',
  info: 'Debug message from offscreen document'
});
```

#### 4. **Permission Dialog Integration**
**Problem**: Screen recording permission requests were inconsistent or not appearing.

**Root Cause**: User gesture requirements and API timing issues.

**Solution**: Implemented proper user gesture preservation and permission flow
```javascript
// Ensure user gesture is preserved
chrome.action.onClicked.addListener(async (tab) => {
  await startRecording(tab); // User gesture is maintained
});
```

#### 5. **JSON Syntax Errors in Manifest**
**Problem**: Multiple JSON syntax errors preventing extension loading.

**Root Cause**: Missing commas, trailing commas, and malformed JSON structure.

**Solution**: Systematic JSON validation and correction
- Fixed missing commas in permissions array
- Removed trailing commas
- Validated JSON structure with proper tools

**Reference**: [Chrome Extension Manifest Format](https://developer.chrome.com/docs/extensions/mv3/manifest/)

#### 6. **Post-Cleanup Recording Failure (June 2025)**
**Problem**: After automated code cleanup (removing unused files and console.log statements), the screen recording permission dialog stopped appearing and recording functionality was completely broken.

**Root Cause**: During the console.log removal process, the entire content of `offscreen-display.js` was accidentally removed, eliminating all `getDisplayMedia` functionality. Additionally, the background script wasn't properly handling popup UI messages.

**Symptoms**:
- Extension icon clickable but no permission dialog
- Popup buttons appeared to work but no recording occurred
- No errors in console but silent failure of core functionality

**Solution**: Complete restoration of offscreen document functionality
```javascript
// Restored essential getDisplayMedia implementation
async function startDisplayMedia() {
  try {
    // Request screen sharing - this shows the permission dialog
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        mediaSource: 'screen',
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 }
      },
      audio: false
    });
    
    // Validate stream and setup MediaRecorder
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      throw new Error("No video tracks available");
    }
    
    // ... MediaRecorder setup with proper error handling
  } catch (error) {
    throw new Error(`Failed to start display media: ${error.message}`);
  }
}
```

**Additional Fixes**:
- Enhanced background script message handling for popup communication
- Added proper `get-status`, `start-recording`, and `stop-recording` message handlers
- Maintained existing action button click functionality
- Preserved Blob URL transfer mechanism for large files

**Prevention**: When performing automated cleanup, preserve functional code blocks and validate core API implementations remain intact.

**Reference**: This demonstrates the importance of incremental testing during cleanup operations and maintaining backup functionality.

### Development Challenges Overcome

#### Browser API Compatibility
- **Issue**: Different Chrome versions have varying API support
- **Solution**: Implemented fallback mechanisms and API feature detection

#### Content Security Policy (CSP) Restrictions
- **Issue**: Inline scripts and unsafe evaluations blocked
- **Solution**: Moved all code to external files and avoided eval()

#### State Management
- **Issue**: Coordinating state between popup, background, and offscreen contexts
- **Solution**: Centralized state management in background script

## 📁 File Structure

```
screenrecord/
├── manifest.json                 # Extension configuration
├── popup.html                    # User interface layout
├── popup.js                      # UI logic and controls
├── background-display.js          # Main background service worker
├── offscreen-display.html        # Offscreen document HTML
├── offscreen-display.js          # Screen capture and recording logic
├── content.js                    # Minimal content script
├── icon.png                      # Extension icon
├── README.md                     # This documentation
├── test-files/
│   ├── test.html                 # Basic test page
│   ├── debug-test.html          # Debug test page
│   ├── final-test.html          # Final test page
│   └── simple-test.html         # Simple test page
├── legacy-files/
│   ├── background.js            # Original background script
│   ├── background-modern.js     # Modern API background script
│   ├── background-simple.js     # Simplified background script
│   ├── background-action.js     # Action-based background script
│   ├── offscreen.html           # Original offscreen document
│   └── offscreen.js             # Original offscreen script
└── debug-files/
    ├── bug.md                   # Bug tracking document
    ├── extension-test.js        # Extension testing script
    ├── debug.js                 # Debug utilities
    └── api-test-background.js   # API testing script
```

### Core Files Description

- **`manifest.json`**: Extension metadata, permissions, and configuration
- **`popup.html/js`**: User interface for recording controls
- **`background-display.js`**: Service worker handling extension lifecycle and downloads
- **`offscreen-display.html/js`**: Isolated environment for MediaRecorder operations
- **`content.js`**: Minimal content script for compatibility
- **Test files**: Various HTML pages for testing recording functionality

## 🔄 Development Journey

### Phase 1: Initial Setup (Legacy Approach)
- Attempted direct tab recording with `chrome.tabCapture.capture()`
- Used content script injection for MediaRecorder
- Faced content script communication issues

### Phase 2: Modern API Migration
- Switched to `chrome.tabCapture.getMediaStreamId()`
- Implemented offscreen document architecture
- Addressed API compatibility issues

### Phase 3: Display Media Implementation
- Adopted `getDisplayMedia()` for better user experience
- Implemented native Chrome permission dialogs
- Resolved screen sharing permission issues

### Phase 4: Data Transfer Optimization
- Identified Chrome extension message size limitations
- Implemented Blob URL transfer mechanism
- Achieved reliable large file downloads

### Phase 5: Polish and Documentation
- Enhanced error handling and user feedback
- Comprehensive debugging and testing
- Created detailed documentation

## 🚀 Future Features Roadmap

### Recently Completed
- [x] **Watermark Support**: Add text, image, and timestamp watermarks to recordings ✨ *NEW*

### Immediate Enhancements
- [ ] **Audio Recording Support**: Add microphone and system audio capture
- [ ] **Recording Quality Settings**: Allow users to choose resolution and bitrate
- [ ] **Recording Timer**: Display recording duration in real-time
- [ ] **Pause/Resume Functionality**: Allow users to pause and resume recordings
- [ ] **Advanced Watermark Features**: Custom fonts, effects, and animations

### Format Conversion Features
- [ ] **WebP Output**: Implement WebP conversion for animated images
- [ ] **GIF Output**: Add GIF generation with optimization options
- [ ] **MP4 Support**: Provide MP4 output for better compatibility
- [ ] **Format Selection**: Allow users to choose output format before recording

### User Experience Improvements
- [ ] **Recording Preview**: Show live preview during recording
- [ ] **Hotkey Support**: Keyboard shortcuts for start/stop recording
- [ ] **Multiple Tab Recording**: Record multiple tabs simultaneously
- [ ] **Scheduling**: Schedule recordings to start at specific times

### Advanced Features
- [ ] **Cloud Storage Integration**: Direct upload to Google Drive, Dropbox
- [ ] **Video Editing**: Basic trimming and editing capabilities
- [ ] **Annotation Tools**: Add text, arrows, and shapes to recordings
- [ ] **Screen Drawing**: Real-time drawing during recording

### Technical Enhancements
- [ ] **Performance Optimization**: Reduce memory usage and CPU load
- [ ] **Error Recovery**: Automatic recovery from recording failures
- [ ] **Cross-Platform Support**: Firefox and Edge extension versions
- [ ] **API Modernization**: Keep up with latest Chrome extension APIs

### Integration Features
- [ ] **YouTube Upload**: Direct upload to YouTube
- [ ] **Social Media Sharing**: One-click sharing to social platforms
- [ ] **Collaboration Tools**: Share recordings with teams
- [ ] **Analytics**: Recording usage statistics and insights

## 🔧 Troubleshooting

### Common Issues

#### Extension Not Loading
1. Check Chrome version compatibility (requires Chrome 88+)
2. Verify all files are in the correct directory structure
3. Reload extension in `chrome://extensions/`
4. Check console for JSON syntax errors

#### Recording Fails to Start
1. Ensure you're on a regular website (not chrome:// pages)
2. Check if screen recording permission was granted
3. Try refreshing the page and attempting again
4. Verify extension has necessary permissions

#### Empty or Corrupted Video Files
1. Record for at least 5-10 seconds
2. Ensure the content being recorded is visible and active
3. Check available disk space
4. Try recording different content

#### Permission Dialog Not Appearing
1. Ensure you clicked the extension icon (user gesture required)
2. Check if permission was previously denied
3. Reset Chrome permissions in Settings > Privacy and Security
4. Try in an incognito window

### Debug Mode
Enable detailed logging by opening Chrome DevTools and checking console output from:
- Extension popup (right-click popup > Inspect)
- Background script (chrome://extensions/ > Inspect views)
- Offscreen document (Sources tab > Select offscreen context)

## 📚 Technical References

### Chrome Extension APIs
- [Manifest V3 Documentation](https://developer.chrome.com/docs/extensions/mv3/)
- [Chrome Extensions Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)
- [Offscreen Documents API](https://developer.chrome.com/docs/extensions/reference/offscreen/)
- [Downloads API](https://developer.chrome.com/docs/extensions/reference/downloads/)

### Web APIs
- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [getDisplayMedia API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)
- [Blob API](https://developer.mozilla.org/en-US/docs/Web/API/Blob)
- [URL.createObjectURL()](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL)

### Screen Recording Resources
- [Screen Capture API Guide](https://web.dev/screen-capture/)
- [MediaRecorder Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/MediaRecorder)
- [Chrome Extension Content Security Policy](https://developer.chrome.com/docs/extensions/mv3/security/)

### Development Tools
- [Chrome Extension Developer Tools](https://developer.chrome.com/docs/extensions/mv3/devtools/)
- [WebRTC Samples](https://webrtc.github.io/samples/)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)

## 📄 License

This project is provided as-is for educational and development purposes. Feel free to modify, distribute, and use as a foundation for your own Chrome extension projects.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests to improve the extension.

### Development Setup
1. Clone the repository
2. Load extension in Chrome developer mode
3. Make changes and test thoroughly
4. Update documentation as needed
5. Submit pull request with detailed description

---

**Version**: 1.0.0  
**Last Updated**: June 22, 2025  
**Status**: ✅ Fully Functional
