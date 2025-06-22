// Popup script for WebP & GIF Page Recorder extension

document.addEventListener('DOMContentLoaded', function() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const statusDiv = document.getElementById('status');
    const formatRadios = document.querySelectorAll('input[name="format"]');
    
    // Watermark elements
    const watermarkEnabled = document.getElementById('watermarkEnabled');
    const watermarkControls = document.getElementById('watermarkControls');
    const watermarkType = document.getElementById('watermarkType');
    const textWatermarkSettings = document.getElementById('textWatermarkSettings');
    const imageWatermarkSettings = document.getElementById('imageWatermarkSettings');
    
    // Check initial status when popup opens
    checkRecordingStatus();
    loadWatermarkSettings();
    
    // Watermark controls toggle
    watermarkEnabled.addEventListener('change', function() {
        watermarkControls.style.display = this.checked ? 'block' : 'none';
        saveWatermarkSettings();
    });
    
    // Watermark type change
    watermarkType.addEventListener('change', function() {
        textWatermarkSettings.style.display = this.value === 'text' ? 'block' : 'none';
        imageWatermarkSettings.style.display = this.value === 'image' ? 'block' : 'none';
        saveWatermarkSettings();
    });
    
    // Save watermark settings on any change
    ['watermarkText', 'watermarkColor', 'watermarkOpacity', 'imageOpacity', 'watermarkPosition'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', saveWatermarkSettings);
            element.addEventListener('input', saveWatermarkSettings);
        }
    });
    
    // Handle image upload
    document.getElementById('watermarkImage').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const imageData = e.target.result;
                chrome.storage.local.set({ watermarkImageData: imageData });
            };
            reader.readAsDataURL(file);
        }
    });
      // Get selected format
    function getSelectedFormat() {
        const selected = document.querySelector('input[name="format"]:checked');
        return selected ? selected.value : 'webm';
    }
    
    // Get watermark settings
    function getWatermarkSettings() {
        if (!watermarkEnabled.checked) {
            return { enabled: false };
        }
        
        const settings = {
            enabled: true,
            type: watermarkType.value,
            position: document.getElementById('watermarkPosition').value
        };
        
        if (watermarkType.value === 'text') {
            settings.text = document.getElementById('watermarkText').value || 'Screen Recording';
            settings.color = document.getElementById('watermarkColor').value;
            settings.opacity = parseFloat(document.getElementById('watermarkOpacity').value);
        } else if (watermarkType.value === 'image') {
            settings.opacity = parseFloat(document.getElementById('imageOpacity').value);
        }
        
        return settings;
    }
    
    // Save watermark settings
    function saveWatermarkSettings() {
        const settings = getWatermarkSettings();
        chrome.storage.local.set({ watermarkSettings: settings });
    }
    
    // Load watermark settings
    async function loadWatermarkSettings() {
        try {
            const result = await chrome.storage.local.get(['watermarkSettings', 'watermarkImageData']);
            const settings = result.watermarkSettings || { enabled: false };
            
            watermarkEnabled.checked = settings.enabled || false;
            watermarkControls.style.display = settings.enabled ? 'block' : 'none';
            
            if (settings.type) {
                watermarkType.value = settings.type;
                textWatermarkSettings.style.display = settings.type === 'text' ? 'block' : 'none';
                imageWatermarkSettings.style.display = settings.type === 'image' ? 'block' : 'none';
            }
            
            if (settings.text) document.getElementById('watermarkText').value = settings.text;
            if (settings.color) document.getElementById('watermarkColor').value = settings.color;
            if (settings.opacity) document.getElementById('watermarkOpacity').value = settings.opacity;
            if (settings.opacity) document.getElementById('imageOpacity').value = settings.opacity;
            if (settings.position) document.getElementById('watermarkPosition').value = settings.position;
            
        } catch (error) {
            chrome.runtime.sendMessage({
                action: 'debug-info',
                info: `Error loading watermark settings: ${error.message}`
            });
        }
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
            
            const watermarkSettings = getWatermarkSettings();
            
            const response = await chrome.runtime.sendMessage({
                action: 'start-recording',
                watermarkSettings: watermarkSettings
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
