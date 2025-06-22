// Popup script for WebP & GIF Page Recorder extension

document.addEventListener('DOMContentLoaded', function() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const statusDiv = document.getElementById('status');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    
    // Initialize with default state
    updateStatus('Checking status...', 'info');
    updateButtons(false);
    
    // Check initial status when popup opens
    setTimeout(checkRecordingStatus, 100);
      // Update status display
    function updateStatus(message, type = 'info') {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        
        // Show/hide progress bar based on type
        if (type === 'processing') {
            progressContainer.style.display = 'block';
        } else {
            progressContainer.style.display = 'none';
            progressFill.style.width = '0%';
        }
    }
    
    // Update progress bar
    function updateProgress(percentage) {
        if (progressContainer.style.display === 'block') {
            progressFill.style.width = percentage + '%';
        }
    }
      // Update button states
    function updateButtons(recording = false) {
        startBtn.disabled = recording;
        stopBtn.disabled = !recording;
    }
      // Check current recording status
    function checkRecordingStatus() {
        chrome.runtime.sendMessage({
            action: 'get-status'
        }, function(response) {
            if (chrome.runtime.lastError) {
                console.error('Runtime error checking status:', chrome.runtime.lastError);
                updateStatus('Error checking status', 'error');
                updateButtons(false);
                return;
            }
            
            if (response && response.isRecording) {
                updateStatus('🔴 Recording in progress...', 'info');
                updateButtons(true);
            } else {
                updateStatus('Ready to record', 'info');
                updateButtons(false);
            }
        });
    }// Start recording
    startBtn.addEventListener('click', async function() {
        try {
            updateStatus('Starting recording...', 'processing');

            // Send message and wait for response
            chrome.runtime.sendMessage({
                action: 'start-recording'
            }, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('Runtime error:', chrome.runtime.lastError);
                    updateStatus(`Error: ${chrome.runtime.lastError.message}`, 'error');
                    updateButtons(false);
                    return;
                }
                
                if (response && response.success) {
                    updateStatus('🔴 Recording in progress...', 'info');
                    updateButtons(true);
                } else {
                    const errorMsg = response?.error || 'Failed to start recording';
                    console.error('Start recording failed:', errorMsg);
                    updateStatus(`Error: ${errorMsg}`, 'error');
                    updateButtons(false);
                }
            });
        } catch (error) {
            console.error('Error starting recording:', error);
            updateStatus(`Error: ${error.message}`, 'error');
            updateButtons(false);
        }
    });    // Stop recording and download
    stopBtn.addEventListener('click', async function() {
        try {
            updateStatus(`Stopping recording...`, 'processing');

            chrome.runtime.sendMessage({
                action: 'stop-recording'
            }, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('Runtime error:', chrome.runtime.lastError);
                    updateStatus(`Error: ${chrome.runtime.lastError.message}`, 'error');
                    updateButtons(false);
                    return;
                }
                
                if (response && response.success) {
                    updateStatus(`✅ Recording stopped! Opening results...`, 'success');
                    updateButtons(false);
                    
                    // Close popup after a delay
                    setTimeout(() => {
                        window.close();
                    }, 1500);
                } else {
                    const errorMsg = response?.error || 'Failed to stop recording';
                    console.error('Stop recording failed:', errorMsg);
                    updateStatus(`Error: ${errorMsg}`, 'error');
                    updateButtons(false);
                }
            });
        } catch (error) {
            console.error('Error stopping recording:', error);
            updateStatus(`Error: ${error.message}`, 'error');
            updateButtons(false);
        }
    });// Listen for messages from background script
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
        if (message.action === 'RECORDING_STATUS') {
            let statusText = message.status;
            updateStatus(statusText, message.type || 'info');
            
            // Update progress if available
            if (message.progress !== undefined) {
                updateProgress(message.progress);
            }
            
            if (message.finished) {
                updateButtons(false);
            }
        }
    });
      // Check if already recording on popup open
    chrome.runtime.sendMessage({ action: 'get-status' }).then(response => {
        if (response && response.recording) {
            updateStatus('🔴 Recording in progress...', 'info');
            updateButtons(true);
        }    }).catch(err => {
        // Silently handle errors
    });
});
