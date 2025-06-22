// Debug logging for format selection issues
// This file helps trace the format selection flow

console.log('=== FORMAT DEBUG LOG ===');

// Test 1: Check popup format selection
console.log('Testing popup format selection simulation...');

function simulatePopupFlow() {
    // Simulate what happens when user selects MP4
    const selectedFormat = 'mp4';
    console.log('1. User selects format:', selectedFormat);
    
    // Simulate message to background
    const startMessage = {
        action: 'start-recording',
        format: selectedFormat
    };
    console.log('2. Popup sends start message:', JSON.stringify(startMessage));
    
    // Simulate background forwarding to offscreen
    const offscreenMessage = {
        target: 'offscreen',
        action: 'start-display-media',
        format: selectedFormat
    };
    console.log('3. Background forwards to offscreen:', JSON.stringify(offscreenMessage));
    
    // Simulate stop message
    const stopMessage = {
        action: 'stop-recording',
        format: selectedFormat
    };
    console.log('4. Popup sends stop message:', JSON.stringify(stopMessage));
    
    // Simulate offscreen response
    const responseMessage = {
        action: 'recording-data-url',
        blobUrl: 'blob:fake-url',
        size: 12345,
        format: selectedFormat
    };
    console.log('5. Offscreen responds with:', JSON.stringify(responseMessage));
    
    // Test filename generation
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const extension = getFileExtension(selectedFormat);
    const filename = `screen-recording-${timestamp}.${extension}`;
    console.log('6. Generated filename:', filename);
}

function getFileExtension(format) {
    switch (format) {
        case 'mp4': return 'mp4';
        case 'gif': return 'gif';
        case 'webm': return 'webm';
        default: return 'webm';
    }
}

// Run simulation
simulatePopupFlow();

console.log('=== END FORMAT DEBUG ===');
