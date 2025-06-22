// GIF Test JavaScript - separated from HTML for CSP compliance

let testVideoBlob = null;
let converter = null;

function log(message) {
    const logDiv = document.getElementById('log');
    const timestamp = new Date().toLocaleTimeString();
    logDiv.innerHTML += `[${timestamp}] ${message}<br>`;
    logDiv.scrollTop = logDiv.scrollHeight;
    console.log(message);
}

function clearLog() {
    document.getElementById('log').innerHTML = '';
}

async function createTestVideo() {
    try {
        log('Creating test video...');
        
        // Create a canvas with animated content
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        
        // Create MediaStream from canvas
        const stream = canvas.captureStream(15);
        const recorder = new MediaRecorder(stream, {
            mimeType: 'video/webm'
        });
        
        const chunks = [];
        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                chunks.push(event.data);
            }
        };
        
        recorder.onstop = () => {
            testVideoBlob = new Blob(chunks, { type: 'video/webm' });
            const videoUrl = URL.createObjectURL(testVideoBlob);
            
            const video = document.getElementById('testVideo');
            video.src = videoUrl;
            video.style.display = 'block';
            
            document.getElementById('videoStatus').textContent = 
                `Video created: ${(testVideoBlob.size / 1024).toFixed(1)} KB`;
            document.getElementById('gifButton').disabled = false;
            document.getElementById('gifStatus').textContent = 'Ready to convert';
            
            log(`Test video created: ${testVideoBlob.size} bytes`);
        };
        
        recorder.start();
        
        // Animate the canvas for 3 seconds
        let frame = 0;
        const animate = () => {
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw animated content
            ctx.fillStyle = `hsl(${frame * 5}, 70%, 50%)`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = 'white';
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`Frame ${frame}`, canvas.width / 2, canvas.height / 2);
            
            // Draw moving circle
            const x = (Math.sin(frame * 0.1) + 1) * canvas.width / 2;
            const y = (Math.cos(frame * 0.1) + 1) * canvas.height / 2;
            
            ctx.fillStyle = 'yellow';
            ctx.beginPath();
            ctx.arc(x, y, 20, 0, Math.PI * 2);
            ctx.fill();
            
            frame++;
            
            if (frame < 45) { // 3 seconds at 15fps
                setTimeout(animate, 1000 / 15);
            } else {
                recorder.stop();
            }
        };
        
        animate();
        
    } catch (error) {
        log(`Error creating test video: ${error.message}`);
        console.error('Test video creation error:', error);
    }
}

async function testGIFConversion() {
    if (!testVideoBlob) {
        log('No test video available');
        return;
    }

    try {
        log('Starting GIF conversion test...');
        document.getElementById('gifStatus').textContent = 'Converting...';
        
        // Initialize converter
        if (!converter) {
            converter = new SimpleFormatConverter();
            log('Converter initialized');
        }
        
        // Convert to GIF
        const gifBlob = await converter.convertToGIF(testVideoBlob, {
            width: 320,
            height: 240,
            fps: 8,
            maxDuration: 3
        }, (progress) => {
            const percent = Math.round(progress * 100);
            document.getElementById('gifStatus').textContent = `Converting... ${percent}%`;
            log(`Conversion progress: ${percent}%`);
        });
        
        log(`GIF conversion completed: ${gifBlob.size} bytes`);
        
        // Display result
        const gifUrl = URL.createObjectURL(gifBlob);
        const img = document.createElement('img');
        img.src = gifUrl;
        img.style.border = '2px solid green';
        img.style.maxWidth = '320px';
        
        const resultDiv = document.getElementById('gifResult');
        resultDiv.innerHTML = '';
        resultDiv.appendChild(img);
        
        // Add download link
        const downloadLink = document.createElement('a');
        downloadLink.href = gifUrl;
        downloadLink.download = 'test-gif.gif';
        downloadLink.textContent = 'Download GIF';
        downloadLink.style.display = 'block';
        downloadLink.style.marginTop = '10px';
        resultDiv.appendChild(downloadLink);
        
        document.getElementById('gifStatus').textContent = 
            `GIF created: ${(gifBlob.size / 1024).toFixed(1)} KB`;
        
    } catch (error) {
        log(`GIF conversion error: ${error.message}`);
        document.getElementById('gifStatus').textContent = `Error: ${error.message}`;
        console.error('GIF conversion error:', error);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    log('GIF conversion test page loaded');
    
    // Add event listeners
    const createVideoBtn = document.getElementById('createVideoBtn');
    const convertGifBtn = document.getElementById('gifButton');
    const clearLogBtn = document.getElementById('clearLogBtn');
    
    if (createVideoBtn) {
        createVideoBtn.addEventListener('click', createTestVideo);
    }
    
    if (convertGifBtn) {
        convertGifBtn.addEventListener('click', testGIFConversion);
    }
    
    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', clearLog);
    }
});
