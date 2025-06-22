// Popup script for WebP & GIF Page Recorder extension

document.addEventListener('DOMContentLoaded', function() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const statusDiv = document.getElementById('status');
    const formatRadios = document.querySelectorAll('input[name="format"]');
    
    // Check initial status when popup opens
    checkRecordingStatus();
    
    // Get selected format
    function getSelectedFormat() {
        const selected = document.querySelector('input[name="format"]:checked');
        return selected ? selected.value : 'webm';
    }
    
    // Update status display
    function updateStatus(message, type = 'info') {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;

    }
    
    // Update button states
    function updateButtons(recording = false) {
        startBtn.disabled = recording;
        stopBtn.disabled = !recording;
        
        // Disable format selection while recording
        formatRadios.forEach(radio => {
            radio.disabled = recording;
        });
        

    }
    
    // Check current recording status
    async function checkRecordingStatus() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'get-status'
            });
            

            
            if (response && response.isRecording) {
                updateStatus('🔴 Recording in progress...', 'info');
                updateButtons(true);
            } else {
                updateStatus('Ready to record', 'info');
                updateButtons(false);
            }
        } catch (error) {
            console.error('Error checking status:', error);
            updateStatus('Error checking status', 'error');
            updateButtons(false);
        }
    }
    
    // Start recording
    startBtn.addEventListener('click', async function() {
        try {
            updateStatus('Starting recording...', 'processing');

            
            const response = await chrome.runtime.sendMessage({
                action: 'start-recording'
            });
            

            
            if (response && response.success) {
                updateStatus('🔴 Recording in progress...', 'info');
                updateButtons(true);
            } else {
                throw new Error(response?.error || 'Failed to start recording');
            }
        } catch (error) {
            console.error('Error starting recording:', error);
            updateStatus(`Error: ${error.message}`, 'error');
            updateButtons(false);
        }
    });
      // Stop recording and download
    stopBtn.addEventListener('click', async function() {
        try {
            const format = getSelectedFormat();
            updateStatus(`Stopping recording...`, 'processing');

            
            const response = await chrome.runtime.sendMessage({
                action: 'stop-recording',
                format: format
            });
            

            
            if (response && response.success) {
                updateStatus(`✅ Recording stopped! Processing download...`, 'success');
                updateButtons(false);
                
                // Close popup after a delay
                setTimeout(() => {
                    window.close();
                }, 2000);
            } else {
                throw new Error(response?.error || 'Failed to stop recording');
            }        } catch (error) {
            console.error('Error stopping recording:', error);
            updateStatus(`Error: ${error.message}`, 'error');
            
            // Still reset buttons in case of error
            updateButtons(false);
        }
    });
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
        if (message.action === 'RECORDING_STATUS') {
            updateStatus(message.status, message.type || 'info');
            
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
        }
    }).catch(err => {

    });
    

});
