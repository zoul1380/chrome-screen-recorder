// Results page JavaScript - separated from HTML for CSP compliance

let recordingData = null;

// Get recording data from background script
async function loadRecordingData() {
    try {
        // Get data from background script global storage
        const response = await chrome.runtime.sendMessage({
            action: 'get-recording-data'
        });
        
        if (response && response.data) {
            recordingData = response.data;
            displayRecording();
        } else {
            throw new Error('No recording data available');
        }    } catch (error) {
        // Send error info via runtime message instead of console.log
        chrome.runtime.sendMessage({
            action: 'debug-info',
            message: 'Error loading recording data',
            error: error.message
        });
        showError();
    }
}

function displayRecording() {
    try {
        const video = document.getElementById('videoPreview');
        const formatInfo = document.getElementById('formatInfo');
        const sizeInfo = document.getElementById('sizeInfo');
        const durationInfo = document.getElementById('durationInfo');
        
        // Set video source
        video.src = recordingData.blobUrl;
          // Update info (show original format)
        formatInfo.textContent = recordingData.format.toUpperCase() + ' (Original)';
        sizeInfo.textContent = formatFileSize(recordingData.size);
        
        // Get duration when video loads
        video.addEventListener('loadedmetadata', function() {
            const duration = video.duration;
            if (duration && !isNaN(duration) && isFinite(duration)) {
                durationInfo.textContent = formatDuration(duration);
            } else {
                // Duration is invalid (Infinity/NaN) - show recording complete
                durationInfo.textContent = 'Recording Complete';
                
                // Try to estimate duration from file size (optional)
                const estimatedDuration = estimateDurationFromFileSize(recordingData.size);
                if (estimatedDuration) {
                    durationInfo.textContent = `~${formatDuration(estimatedDuration)} (estimated)`;
                }
            }
        });
          // Handle video load errors
        video.addEventListener('error', function() {
            // Send error info via runtime message instead of console.log
            chrome.runtime.sendMessage({
                action: 'debug-info',
                message: 'Video load error',
                error: video.error?.message || 'Unknown video error'
            });
            durationInfo.textContent = 'Error';
        });
        
        // Show content, hide loading
        document.getElementById('loading').style.display = 'none';
        document.getElementById('content').style.display = 'block';
          } catch (error) {
        // Send error info via runtime message instead of console.log
        chrome.runtime.sendMessage({
            action: 'debug-info',
            message: 'Error displaying recording',
            error: error.message
        });
        showError();
    }
}

function showError() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
}

function getFileName(format) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const extension = getFileExtension(format || recordingData.format);
    return `screen-recording-${timestamp}.${extension}`;
}

async function downloadRecording() {
    const selectedFormat = document.querySelector('input[name="downloadFormat"]:checked').value;
    const downloadBtn = document.getElementById('downloadBtn');
    const progressContainer = document.getElementById('conversionProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    try {
        // If same format as original, download directly
        if (selectedFormat === recordingData.format) {
            const link = document.createElement('a');
            link.href = recordingData.blobUrl;
            link.download = getFileName(selectedFormat);
            link.click();
            return;
        }
        
        // Show conversion progress
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        progressContainer.style.display = 'block';
        progressText.textContent = `Converting to ${selectedFormat.toUpperCase()}...`;
        
        // Convert format
        let convertedBlob;
        
        if (selectedFormat === 'gif') {
            // Convert to GIF
            if (!window.SimpleFormatConverter) {
                throw new Error('GIF converter not available');
            }
            
            const converter = new SimpleFormatConverter();
            const originalBlob = await fetch(recordingData.blobUrl).then(r => r.blob());
            
            convertedBlob = await converter.convertToGIF(originalBlob, {
                width: 480,
                height: 360,
                fps: 10,
                quality: 'medium'
            }, (progress) => {
                progressFill.style.width = (progress * 100) + '%';
                progressText.textContent = `Converting to GIF... ${Math.round(progress * 100)}%`;
            });
            
        } else if (selectedFormat === 'mp4') {
            // Convert to MP4 (WebM with H.264)
            if (!window.SimpleFormatConverter) {
                throw new Error('MP4 converter not available');
            }
            
            const converter = new SimpleFormatConverter();
            const originalBlob = await fetch(recordingData.blobUrl).then(r => r.blob());
            
            convertedBlob = await converter.convertToWebMH264(originalBlob, (progress) => {
                progressFill.style.width = (progress * 100) + '%';
                progressText.textContent = `Converting to MP4... ${Math.round(progress * 100)}%`;
            });
            
        } else {
            throw new Error(`Unsupported format: ${selectedFormat}`);
        }
        
        // Download converted file
        const convertedUrl = URL.createObjectURL(convertedBlob);
        const link = document.createElement('a');
        link.href = convertedUrl;
        link.download = getFileName(selectedFormat);
        link.click();
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(convertedUrl), 1000);
        
        progressText.textContent = 'Conversion complete!';
          } catch (error) {
        // Send error info via runtime message instead of console.log
        chrome.runtime.sendMessage({
            action: 'debug-info',
            message: 'Download/conversion error',
            error: error.message
        });
        progressText.textContent = `Error: ${error.message}`;
        alert(`Download failed: ${error.message}`);
        } finally {
        // Reset UI
        setTimeout(() => {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download Recording';
            progressContainer.style.display = 'none';
            progressFill.style.width = '0%';
        }, 2000);
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

function recordAnother() {
    // Close this tab and open extension popup
    chrome.runtime.sendMessage({ action: 'record-another' });
    window.close();
}

function shareRecording() {
    // Future: implement sharing functionality
    alert('Sharing functionality coming soon!');
}

// Estimate duration based on file size (rough approximation)
function estimateDurationFromFileSize(fileSize) {
    if (!fileSize || fileSize < 1000) return null;
    
    // Rough estimation: WebM recordings are typically 1-3 MB per minute
    // This is very approximate but better than showing nothing
    const avgBytesPerSecond = 50000; // ~3 MB per minute
    const estimatedSeconds = Math.round(fileSize / avgBytesPerSecond);
    
    // Only show estimate if it seems reasonable (between 1 second and 1 hour)
    if (estimatedSeconds >= 1 && estimatedSeconds <= 3600) {
        return estimatedSeconds;
    }
    
    return null;
}

// Load recording data when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadRecordingData();
    
    // Add event listeners to buttons
    const downloadBtn = document.getElementById('downloadBtn');
    const recordAnotherBtn = document.getElementById('recordAnotherBtn');
    const shareBtn = document.getElementById('shareBtn');
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadRecording);
    }
    
    if (recordAnotherBtn) {
        recordAnotherBtn.addEventListener('click', recordAnother);
    }
    
    if (shareBtn) {
        shareBtn.addEventListener('click', shareRecording);
    }
});
