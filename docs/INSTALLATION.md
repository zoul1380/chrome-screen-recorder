# Screen Recorder Installation Guide

## Quick Installation Steps

### 1. Download the Extension
- Clone or download this repository to your local machine
- Extract all files to a folder (e.g., `screen-recorder/`)

### 2. Load in Chrome
1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the folder containing the extension files
6. The extension icon should appear in your Chrome toolbar

### 3. Test the Extension
1. Open the included `test-format-conversion.html` file in Chrome
2. Click the Screen Recorder extension icon
3. Select your desired format (WebM, MP4, or GIF)
4. Click "Start Recording" and grant screen sharing permission
5. Record for 5-10 seconds, then click "Stop Recording"
6. Wait for conversion (if needed) and check your downloads folder

## Format Capabilities

### ✅ WebM (Native)
- Instant processing
- Smallest file size
- Best quality

### ✅ MP4 (Converted)
- 30-60 second conversion time
- Maximum compatibility
- Good quality with H.264

### ✅ GIF (Converted)
- 60-120 second conversion time
- Perfect for animations
- Optimized for web sharing

## Troubleshooting

### Extension Won't Load
- Check that all files are in the same folder
- Verify Chrome is version 88 or newer
- Look for errors in `chrome://extensions/`

### Recording Fails
- Try refreshing the page and attempting again
- Ensure you're not on a chrome:// page (use a regular website)
- Check that screen recording permission was granted

### Conversion Takes Too Long
- GIF conversion can take 1-2 minutes for longer recordings
- Close other tabs to free up browser resources
- For very long recordings, consider trimming to 10 seconds or less

### File Not Downloading
- Check your Chrome download settings
- Ensure you have enough disk space
- Try a different output format

## Privacy & Security

- ✅ All conversion happens in your browser
- ✅ No data sent to external servers
- ✅ No user tracking or data collection
- ✅ Files are processed locally and immediately offered for download

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Try recording a simple test page first
3. Verify your Chrome version supports the required APIs
4. Test with different output formats

---

**Version**: 2.0.0 (Format Conversion Update)
**Compatible**: Chrome 88+ (Manifest V3)
**Last Updated**: June 22, 2025
