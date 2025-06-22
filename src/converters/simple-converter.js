// Simplified format converter for Chrome extension
// Works without external dependencies or workers

class SimpleFormatConverter {
    constructor() {
        this.isReady = true;
    }    async convertToMP4(webmBlob, onProgress = null) {
        try {
            if (onProgress) onProgress(0.1);
            
            // Since Chrome doesn't natively support MP4 encoding in MediaRecorder,
            // we'll return the WebM with H.264 codec if available, or high-quality VP9
            // This provides better compatibility than VP8
            
            const video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;
            
            const videoUrl = URL.createObjectURL(webmBlob);
            video.src = videoUrl;
            
            return new Promise((resolve, reject) => {
                video.onloadedmetadata = async () => {
                    try {
                        if (onProgress) onProgress(0.3);
                        
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        
                        if (onProgress) onProgress(0.5);
                        
                        const stream = canvas.captureStream(30);
                        const chunks = [];
                        
                        // Use the best available codec for "MP4-like" quality
                        let mimeType, actualFormat;
                        if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
                            mimeType = 'video/webm;codecs=h264';
                            actualFormat = 'webm'; // Still WebM container but H.264 codec
                        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                            mimeType = 'video/webm;codecs=vp9';
                            actualFormat = 'webm';
                        } else {
                            mimeType = 'video/webm';
                            actualFormat = 'webm';
                        }
                        
                        const recorder = new MediaRecorder(stream, { 
                            mimeType: mimeType,
                            videoBitsPerSecond: 4000000
                        });
                        
                        recorder.ondataavailable = (event) => {
                            if (event.data.size > 0) {
                                chunks.push(event.data);
                            }
                        };
                          recorder.onstop = () => {
                            // Return the actual format based on what was supported
                            const resultBlob = new Blob(chunks, { type: mimeType });
                            
                            // Add metadata about actual format
                            resultBlob.actualFormat = actualFormat;
                            resultBlob.codecInfo = mimeType;
                            
                            if (onProgress) onProgress(1.0);
                            URL.revokeObjectURL(videoUrl);
                            resolve(resultBlob);
                        };
                        
                        recorder.start();
                        
                        // Record the video by drawing frames
                        const fps = 30;
                        const duration = Math.min(video.duration, 30); // Limit to 30 seconds
                        let currentTime = 0;
                        const frameInterval = 1 / fps;
                        
                        const drawFrame = () => {
                            if (currentTime <= duration) {
                                video.currentTime = currentTime;
                                
                                const onSeeked = () => {
                                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                    currentTime += frameInterval;
                                    
                                    if (onProgress) {
                                        const progress = 0.5 + (currentTime / duration) * 0.4;
                                        onProgress(Math.min(progress, 0.9));
                                    }
                                    
                                    if (currentTime <= duration) {
                                        setTimeout(drawFrame, 1000 / fps);
                                    } else {
                                        recorder.stop();
                                    }
                                    
                                    video.removeEventListener('seeked', onSeeked);
                                };
                                
                                video.addEventListener('seeked', onSeeked);
                            }
                        };
                        
                        drawFrame();
                        
                    } catch (error) {
                        URL.revokeObjectURL(videoUrl);
                        reject(error);
                    }
                };
                
                video.onerror = () => {
                    URL.revokeObjectURL(videoUrl);
                    reject(new Error('Failed to load video for MP4 conversion'));
                };
            });
            
        } catch (error) {
            throw new Error(`MP4 conversion failed: ${error.message}`);
        }
    }    async convertToGIF(webmBlob, options = {}, onProgress = null) {
        const {
            width = 480,
            height = null,
            fps = 8,
            maxDuration = 8
        } = options;

        try {
            if (onProgress) onProgress(0.05);

            const video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;
            video.preload = 'metadata';
            
            const videoUrl = URL.createObjectURL(webmBlob);
            video.src = videoUrl;

            return new Promise((resolve, reject) => {
                video.onloadedmetadata = async () => {
                    try {
                        // Wait for video to be ready
                        await new Promise(resolveReady => {
                            if (video.readyState >= 2) {
                                resolveReady();
                            } else {
                                video.addEventListener('canplay', resolveReady, { once: true });
                            }
                        });

                        const aspectRatio = video.videoWidth / video.videoHeight;
                        const gifWidth = width;
                        const gifHeight = height || Math.round(width / aspectRatio);
                        
                        const duration = Math.min(video.duration || 5, maxDuration);
                        const totalFrames = Math.max(8, Math.floor(duration * fps)); // Minimum 8 frames
                        const frameInterval = duration / totalFrames;                        
                        if (onProgress) onProgress(0.1);
                        
                        // Create canvas for frame extraction
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = gifWidth;
                        canvas.height = gifHeight;
                        
                        // Set canvas background to prevent transparency issues
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, gifWidth, gifHeight);
                        
                        // Test first frame to ensure video is working
                        video.currentTime = 0;
                        await new Promise((resolveTest, rejectTest) => {
                            const testSeek = () => {
                                try {
                                    ctx.drawImage(video, 0, 0, gifWidth, gifHeight);
                                    
                                    // Check if canvas has content
                                    const imageData = ctx.getImageData(0, 0, Math.min(10, gifWidth), Math.min(10, gifHeight));
                                    const hasContent = imageData.data.some((pixel, i) => i % 4 < 3 && pixel !== 255);
                                    
                                    if (!hasContent) {
                                        console.warn('First frame appears empty, but continuing...');
                                    }
                                    
                                    // Video frame test completed
                                    video.removeEventListener('seeked', testSeek);
                                    resolveTest();
                                } catch (testError) {
                                    console.error('Frame test error:', testError);
                                    video.removeEventListener('seeked', testSeek);
                                    rejectTest(testError);
                                }
                            };
                            
                            video.addEventListener('seeked', testSeek);
                            
                            // Fallback timeout
                            setTimeout(() => {
                                video.removeEventListener('seeked', testSeek);
                                resolveTest(); // Continue anyway
                            }, 2000);
                        });
                        
                        // Create simple animated WebP instead of GIF (better browser support)
                        const frames = [];
                        
                        for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
                            const currentTime = frameIndex * frameInterval;
                            
                            if (currentTime >= duration) break;
                            
                            video.currentTime = currentTime;
                            
                            await new Promise(resolveFrame => {
                                const onSeeked = () => {
                                    try {
                                        // Clear and fill background
                                        ctx.fillStyle = '#FFFFFF';
                                        ctx.fillRect(0, 0, gifWidth, gifHeight);
                                        
                                        // Draw video frame
                                        ctx.drawImage(video, 0, 0, gifWidth, gifHeight);
                                        
                                        // Convert to data URL
                                        const dataURL = canvas.toDataURL('image/png', 0.8);
                                        frames.push(dataURL);
                                        
                                        if (onProgress) {
                                            const progress = 0.1 + (frameIndex / totalFrames) * 0.7;
                                            onProgress(progress);
                                        }
                                        
                                        // Frame captured
                                        
                                        video.removeEventListener('seeked', onSeeked);
                                        resolveFrame();
                                    } catch (frameError) {
                                        console.error('Frame capture error:', frameError);
                                        video.removeEventListener('seeked', onSeeked);
                                        resolveFrame(); // Continue with next frame
                                    }
                                };
                                
                                video.addEventListener('seeked', onSeeked);
                                
                                // Timeout fallback
                                setTimeout(() => {
                                    video.removeEventListener('seeked', onSeeked);
                                    resolveFrame();
                                }, 1000);
                            });
                            
                            // Small delay between frames
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                        
                        if (onProgress) onProgress(0.8);
                        
                        if (frames.length === 0) {
                            throw new Error('No frames were captured from video');
                        }                        
                          // Create proper animated GIF instead of composite image
                        
                        if (frames.length === 0) {
                            throw new Error('No frames were captured for GIF conversion');
                        }
                        
                        // Use working GIF creator
                        const gif = new GIF({
                            width: gifWidth,
                            height: gifHeight,
                            quality: 80,
                            fps: fps
                        });
                        
                        gif.on('progress', function(p) {
                            if (onProgress) {
                                onProgress(0.8 + p * 0.2);
                            }
                        });
                        
                        // Create promise for completion
                        const gifPromise = new Promise((resolveGif, rejectGif) => {
                            gif.on('finished', function(blob) {
                                // Animated GIF created successfully
                                resolveGif(blob);
                            });
                            
                            gif.on('error', function(error) {
                                console.error('GIF creation failed:', error);
                                rejectGif(error);
                            });
                        });
                        
                        // Add frames to GIF
                        for (let i = 0; i < frames.length; i++) {
                            const frameCanvas = document.createElement('canvas');
                            frameCanvas.width = gifWidth;
                            frameCanvas.height = gifHeight;
                            const frameCtx = frameCanvas.getContext('2d');
                            
                            // Load and draw frame
                            const img = new Image();
                            img.src = frames[i];
                            
                            await new Promise(resolve => {
                                img.onload = () => {
                                    frameCtx.drawImage(img, 0, 0, gifWidth, gifHeight);
                                    gif.addFrame(frameCanvas, { delay: Math.round(1000 / fps) });
                                    // Frame added to animated GIF
                                    resolve();
                                };
                                img.onerror = () => {
                                    console.warn(`Frame ${i} failed to load, skipping`);
                                    resolve();
                                };
                            });
                        }
                        
                        // Render the GIF
                        gif.render();
                        
                        // Wait for completion
                        const animatedBlob = await gifPromise;
                        
                        if (onProgress) onProgress(1.0);
                        
                        URL.revokeObjectURL(videoUrl);
                        // GIF conversion completed
                        resolve(animatedBlob);
                        
                    } catch (error) {
                        console.error('GIF conversion error:', error);
                        URL.revokeObjectURL(videoUrl);
                        reject(error);
                    }
                };
                
                video.onerror = (error) => {
                    console.error('Video loading error:', error);
                    URL.revokeObjectURL(videoUrl);
                    reject(new Error('Failed to load video for GIF conversion'));
                };
            });
            
        } catch (error) {
            throw new Error(`GIF conversion failed: ${error.message}`);
        }
    }

    async createMultiFrameImage(frames, width, height) {
        // Create a composite image showing multiple frames
        // This is a workaround since true GIF encoding is complex
        const cols = Math.ceil(Math.sqrt(frames.length));
        const rows = Math.ceil(frames.length / cols);
        
        const compositeCanvas = document.createElement('canvas');
        const ctx = compositeCanvas.getContext('2d');
        compositeCanvas.width = width * cols;
        compositeCanvas.height = height * rows;
        
        // Fill background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);
        
        // Draw frames in grid
        for (let i = 0; i < frames.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            
            const img = new Image();
            img.src = frames[i];
            
            await new Promise(resolve => {
                img.onload = () => {
                    ctx.drawImage(img, col * width, row * height, width, height);
                    resolve();
                };
                img.onerror = () => resolve(); // Skip failed frames
            });
        }
        
        // Convert to blob
        return new Promise(resolve => {
            compositeCanvas.toBlob(blob => {
                resolve(blob || new Blob([''], {type: 'image/png'}));
            }, 'image/png', 0.8);
        });
    }

    async convertToWebMH264(webmBlob, onProgress = null) {
        try {
            if (onProgress) onProgress(0.1);
            
            const video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;
            
            const videoUrl = URL.createObjectURL(webmBlob);
            video.src = videoUrl;
            
            return new Promise((resolve, reject) => {
                video.onloadedmetadata = async () => {
                    try {
                        if (onProgress) onProgress(0.3);
                        
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        
                        if (onProgress) onProgress(0.5);
                        
                        const stream = canvas.captureStream(30);
                        const chunks = [];
                        
                        // Try H.264 codec in WebM container for best compatibility
                        let mimeType;
                        if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
                            mimeType = 'video/webm;codecs=h264';
                        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                            mimeType = 'video/webm;codecs=vp9';
                        } else {
                            mimeType = 'video/webm';
                        }
                        
                        const recorder = new MediaRecorder(stream, { 
                            mimeType: mimeType,
                            videoBitsPerSecond: 4000000
                        });
                        
                        recorder.ondataavailable = (event) => {
                            if (event.data.size > 0) {
                                chunks.push(event.data);
                            }
                        };
                        
                        recorder.onstop = () => {
                            const resultBlob = new Blob(chunks, { type: mimeType });
                            if (onProgress) onProgress(1.0);
                            URL.revokeObjectURL(videoUrl);
                            resolve(resultBlob);
                        };
                        
                        recorder.start();
                        
                        // Record the video by drawing frames
                        const fps = 30;
                        const duration = Math.min(video.duration, 30); // Limit to 30 seconds
                        let currentTime = 0;
                        const frameInterval = 1 / fps;
                        
                        const drawFrame = () => {
                            if (currentTime <= duration) {
                                video.currentTime = currentTime;
                                
                                const onSeeked = () => {
                                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                    currentTime += frameInterval;
                                    
                                    if (onProgress) {
                                        const progress = 0.5 + (currentTime / duration) * 0.4;
                                        onProgress(Math.min(progress, 0.9));
                                    }
                                    
                                    if (currentTime <= duration) {
                                        setTimeout(drawFrame, 1000 / fps);
                                    } else {
                                        recorder.stop();
                                    }
                                    
                                    video.removeEventListener('seeked', onSeeked);
                                };
                                
                                video.addEventListener('seeked', onSeeked);
                            }
                        };
                        
                        drawFrame();
                        
                    } catch (error) {
                        URL.revokeObjectURL(videoUrl);
                        reject(error);
                    }
                };
                
                video.onerror = () => {
                    URL.revokeObjectURL(videoUrl);
                    reject(new Error('Failed to load video for H.264 conversion'));
                };
            });
            
        } catch (error) {
            throw new Error(`WebM H.264 conversion failed: ${error.message}`);
        }
    }

    // Helper methods
    getFileExtension(format) {
        switch (format) {
            case 'mp4': return 'mp4';
            case 'gif': return 'gif';
            case 'webm': return 'webm';
            default: return 'webm';
        }
    }

    getMimeType(format) {
        switch (format) {
            case 'mp4': return 'video/mp4';
            case 'gif': return 'image/gif';
            case 'webm': return 'video/webm';
            default: return 'video/webm';
        }
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.SimpleFormatConverter = SimpleFormatConverter;
}
