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
        }
    } catch (error) {
        console.error('Error loading recording data:', error);
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
                // Duration is invalid (Infinity/NaN) - try to fix WebM
                durationInfo.textContent = 'Calculating...';
                fixWebMDuration(video, recordingData)
                    .then(fixedData => {
                        if (fixedData) {
                            recordingData = fixedData;
                            video.src = fixedData.blobUrl;
                        }
                    })
                    .catch(error => {
                        console.error('Duration fix failed:', error);
                        durationInfo.textContent = 'Unknown';
                    });
            }
        });
        
        // Handle video load errors
        video.addEventListener('error', function() {
            console.error('Video load error:', video.error);
            durationInfo.textContent = 'Error';
        });
        
        // Show content, hide loading
        document.getElementById('loading').style.display = 'none';
        document.getElementById('content').style.display = 'block';
        
    } catch (error) {
        console.error('Error displaying recording:', error);
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
        console.error('Download/conversion error:', error);
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

// Function to fix WebM duration metadata
async function fixWebMDuration(videoElement, originalData) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('Attempting to fix WebM duration metadata...');
            
            // Fetch the original blob
            const response = await fetch(originalData.blobUrl);
            const webmBlob = await response.blob();
            
            // Try to fix using canvas re-encoding
            const fixedBlob = await reencodeWebMWithDuration(webmBlob);
            
            if (fixedBlob) {
                // Create new blob URL
                const newBlobUrl = URL.createObjectURL(fixedBlob);
                
                // Test the fixed video
                const testVideo = document.createElement('video');
                testVideo.muted = true;
                testVideo.preload = 'metadata';
                
                testVideo.addEventListener('loadedmetadata', () => {
                    const duration = testVideo.duration;
                    console.log('Fixed video duration:', duration);
                    
                    if (duration && !isNaN(duration) && isFinite(duration)) {
                        // Success! Update the duration display
                        document.getElementById('durationInfo').textContent = formatDuration(duration);
                        
                        // Clean up old URL
                        URL.revokeObjectURL(originalData.blobUrl);
                        
                        // Return fixed data
                        resolve({
                            blobUrl: newBlobUrl,
                            size: fixedBlob.size,
                            format: originalData.format
                        });
                    } else {
                        // Still invalid
                        URL.revokeObjectURL(newBlobUrl);
                        reject(new Error('Duration still invalid after fixing'));
                    }
                });
                
                testVideo.addEventListener('error', () => {
                    URL.revokeObjectURL(newBlobUrl);
                    reject(new Error('Fixed video failed to load'));
                });
                
                testVideo.src = newBlobUrl;
                
            } else {
                reject(new Error('Re-encoding failed'));
            }
            
        } catch (error) {
            console.error('WebM duration fix error:', error);
            reject(error);
        }
    });
}

// Re-encode WebM using canvas to fix duration metadata
async function reencodeWebMWithDuration(originalBlob) {
    return new Promise((resolve, reject) => {
        try {
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            video.muted = true;
            video.autoplay = false;
            video.preload = 'metadata';
            
            let mediaRecorder;
            let recordedChunks = [];
            let startTime;
            let frameCount = 0;
            
            video.addEventListener('loadedmetadata', () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                console.log(`Re-encoding video: ${canvas.width}x${canvas.height}`);
                
                // Create canvas stream
                const canvasStream = canvas.captureStream(30);
                
                // Create MediaRecorder with proper settings
                mediaRecorder = new MediaRecorder(canvasStream, {
                    mimeType: 'video/webm;codecs=vp8',
                    videoBitsPerSecond: 2500000
                });
                
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) {
                        recordedChunks.push(event.data);
                    }
                };
                
                mediaRecorder.onstop = () => {
                    const recodedBlob = new Blob(recordedChunks, { 
                        type: 'video/webm;codecs=vp8' 
                    });
                    console.log(`Re-encoding complete: ${recordedChunks.length} chunks, ${(recodedBlob.size/1024/1024).toFixed(2)} MB`);
                    resolve(recodedBlob);
                };
                
                // Start recording
                startTime = Date.now();
                mediaRecorder.start();
                
                // Start video playback
                video.currentTime = 0;
                video.play();
            });
            
            video.addEventListener('timeupdate', () => {
                if (video.ended) {
                    console.log(`Video ended after ${frameCount} frames`);
                    if (mediaRecorder && mediaRecorder.state === 'recording') {
                        mediaRecorder.stop();
                    }
                    return;
                }
                
                // Draw current frame to canvas
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                frameCount++;
            });
            
            video.addEventListener('ended', () => {
                if (mediaRecorder && mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
            });
            
            video.addEventListener('error', () => {
                reject(new Error('Original video failed to load for re-encoding'));
            });
            
            // Load the original video
            video.src = URL.createObjectURL(originalBlob);
            
            // Timeout after 30 seconds
            setTimeout(() => {
                if (mediaRecorder && mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
                reject(new Error('Re-encoding timed out'));
            }, 30000);
            
        } catch (error) {
            reject(error);
        }
    });
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
