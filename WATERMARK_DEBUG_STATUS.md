# 🐛 Watermark Visibility Debug - In Progress

## 🎉 Progress Update
✅ **Save Dialog Fixed** - Videos now download when watermarks are enabled  
🔍 **Investigating** - Watermarks not visible in final video

## 🔍 Debugging Strategy

### Phase 1: Enhanced Debug Logging ✅
I've added comprehensive debug logging throughout the watermark pipeline:

**Added to `processVideoWithWatermark`:**
- Log watermark settings being received
- Log video dimensions and duration
- Log frame processing count and timing
- Log video playback status

**Added to `addWatermarkToCanvas`:**
- Log watermark enable/disable status
- Log watermark text, opacity, and position
- Log drawing coordinates and font size
- **Added red debug rectangle** behind text for visual confirmation

### Phase 2: Simple Test Function ✅
Created `processVideoWithWatermarkSimple()` to isolate the issue:
- Bypasses complex video processing
- Tests message flow only
- Returns original video after delay
- Helps determine if issue is in video processing or message handling

### Phase 3: Debug Test Page ✅
Created `watermark-debug-test.html` with:
- High-contrast background for watermark visibility
- Moving elements to test different scenarios
- Detailed debug instructions
- Expected debug message checklist

## 🧪 Testing Instructions

### Test 1: Debug Messages
1. Open extension popup
2. Enable watermarks with these settings:
   - Text: "DEBUG WATERMARK TEST" 
   - Opacity: 0.9 (high visibility)
   - Position: top-right
   - Color: white
3. Record `watermark-debug-test.html` for 10-15 seconds
4. Check popup for debug messages

### Test 2: Simple Watermark Mode
- Extension is currently using simple mode
- Should show "SIMPLE: Starting simple watermark test approach"
- Should complete in 2 seconds
- Tests basic message flow

## 🔍 Expected Debug Output

**Simple Mode Messages:**
```
SIMPLE: Starting simple watermark test approach
SIMPLE: Watermark test completed - returning original video
```

**Full Mode Messages (when enabled):**
```
Starting watermark processing with settings: {...}
Video dimensions: [width]x[height], duration: [X]s
Video playback started successfully
Adding watermark: text=DEBUG WATERMARK TEST, opacity=0.9
Drawing watermark "DEBUG WATERMARK TEST" at ([x], [y]) with fontSize [size]
Processed [X] frames, video time: [X]s
Video processing complete. Processed [X] frames.
```

## 🎯 Visual Confirmation

When working correctly, you should see:
- ✅ White text "DEBUG WATERMARK TEST" in top-right corner
- ✅ **Red rectangular background** behind the text (debug indicator)
- ✅ Both elements visible throughout entire video

## 🚨 Potential Issues Being Investigated

1. **Settings Not Passed Correctly**
   - Check if watermark settings reach the rendering function
   - Verify enabled flag is true

2. **Video Processing Issues**
   - Video might not be playing during processing
   - Canvas might not be recording frames correctly
   - Frame timing might be off

3. **Canvas Rendering Issues**
   - Watermark might be drawn but not captured
   - Context state might be interfering
   - Opacity/color issues making it invisible

4. **MediaRecorder Issues**
   - Canvas stream might not be recording properly
   - Codec issues might affect overlay rendering

## 🔧 Next Steps

1. **Test Simple Mode First** - Verify basic message flow works
2. **Check Debug Messages** - Identify where the process breaks
3. **Switch to Full Mode** - Re-enable complex processing with debug output
4. **Visual Confirmation** - Look for red debug rectangle in video
5. **Iterative Fixes** - Address specific issues found in debug output

## 📊 Current Status - ENHANCED DEBUG MODE
- 🔄 **Enhanced Debug Logging** - Added comprehensive logging to all components
- 🧪 **Test Button Added** - Manual watermark settings test in popup
- 📋 **Ready for Testing** - Multiple debug approaches ready
- 🎯 **Next Action** - Use test button to isolate the issue

## 🧪 NEW: Enhanced Testing Approach

### Step 1: Test Settings Saving (NEW!)
1. Open extension popup
2. Enable watermarks and configure settings
3. Click the **🧪 Test Watermark Settings** button (orange button at bottom)
4. Check browser console (F12) for popup debug messages
5. Check extension popup debug area for background messages

### Step 2: Test Recording Process
1. After confirming settings work, try recording
2. Look for BACKGROUND debug messages about receiving recording data
3. Look for OFFSCREEN debug messages about processing

## 🔍 Expected Debug Messages (Updated)

**Popup Console (F12 → Console):**
```
POPUP: Getting watermark settings...
POPUP: Watermark enabled checkbox: true
POPUP: Final watermark settings: {enabled: true, type: "text", ...}
POPUP: Saving watermark settings: {...}
POPUP: Watermark settings saved successfully
POPUP: Test watermark button clicked
POPUP: Retrieved settings for test: {...}
```

**Extension Popup Debug Area:**
```
BACKGROUND: Test message received with settings: {...}
BACKGROUND: Received recording-data-url, blobUrl: true, size: [X]
BACKGROUND: Watermark settings: {enabled: true, ...}
OFFSCREEN: Received watermark processing request
OFFSCREEN: Starting watermark processing with settings: {...}
```

---
**Files Modified:**
- `popup.html` - Added test button
- `popup.js` - Added debug logging and test functionality  
- `background-display.js` - Added debug logging and test handler
- `offscreen-display.js` - Re-enabled full watermark processing with debug logging
