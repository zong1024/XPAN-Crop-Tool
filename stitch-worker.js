// Panorama Stitching Web Worker
// Uses OpenCV.js for feature detection and image stitching

let cv = null;

// Load OpenCV.js
importScripts('https://docs.opencv.org/4.x/opencv.js');

// Check if OpenCV is ready
let checkCV = setInterval(() => {
    if (typeof cv !== 'undefined' && cv.Mat) {
        clearInterval(checkCV);
        self.postMessage({ type: 'ready' });
    }
}, 100);

// Message handler
self.onmessage = function(e) {
    const { type, data } = e.data;
    
    if (type === 'stitch') {
        stitchImages(data.image1, data.image2);
    }
};

// Load image from data URL
function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = dataUrl;
    });
}

// Send progress update
function sendProgress(percent, message) {
    self.postMessage({
        type: 'progress',
        percent: percent,
        message: message
    });
}

// Main stitching function
async function stitchImages(img1Data, img2Data) {
    try {
        sendProgress(5, '加载图像中...');
        
        // Load images
        const img1 = await loadImage(img1Data);
        const img2 = await loadImage(img2Data);
        
        sendProgress(15, '转换为灰度图...');
        
        // Create canvases and draw images
        const canvas1 = new OffscreenCanvas(img1.width, img1.height);
        const ctx1 = canvas1.getContext('2d');
        ctx1.drawImage(img1, 0, 0);
        const imgData1 = ctx1.getImageData(0, 0, img1.width, img1.height);
        
        const canvas2 = new OffscreenCanvas(img2.width, img2.height);
        const ctx2 = canvas2.getContext('2d');
        ctx2.drawImage(img2, 0, 0);
        const imgData2 = ctx2.getImageData(0, 0, img2.width, img2.height);
        
        sendProgress(25, '转换为OpenCV格式...');
        
        // Convert to OpenCV Mat
        const mat1 = cv.matFromImageData(imgData1);
        const mat2 = cv.matFromImageData(imgData2);
        
        sendProgress(35, '检测特征点...');
        
        // Convert to grayscale
        const gray1 = new cv.Mat();
        const gray2 = new cv.Mat();
        cv.cvtColor(mat1, gray1, cv.COLOR_RGBA2GRAY);
        cv.cvtColor(mat2, gray2, cv.COLOR_RGBA2GRAY);
        
        // ORB feature detection
        const orb = cv.ORB.create(1000);
        const kp1 = new cv.KeyPointVector();
        const kp2 = new cv.KeyPointVector();
        const desc1 = new cv.Mat();
        const desc2 = new cv.Mat();
        orb.detectAndCompute(gray1, new cv.Mat(), kp1, desc1);
        orb.detectAndCompute(gray2, new cv.Mat(), kp2, desc2);
        
        sendProgress(50, '匹配特征点...');
        
        // Feature matching
        const matcher = cv.BFMatcher.create(cv.NORM_HAMMING);
        const matches = new cv.DMatchVectorVector();
        matcher.knnMatch(desc1, desc2, matches, 2);
        
        // Apply ratio test
        const goodMatches = [];
        for (let i = 0; i < matches.size(); i++) {
            const match = matches.get(i);
            if (match.size() >= 2) {
                const m = match.get(0);
                const n = match.get(1);
                if (m.distance < 0.7 * n.distance) {
                    goodMatches.push(m);
                }
            }
        }
        
        if (goodMatches.length < 4) {
            throw new Error('匹配点不足，请确保两张照片有足够的重叠区域');
        }
        
        sendProgress(60, `找到 ${goodMatches.length} 个匹配点`);
        
        // Extract matched points
        const srcPoints = [];
        const dstPoints = [];
        for (const match of goodMatches) {
            srcPoints.push(kp1.get(match.queryIdx).pt.x, kp1.get(match.queryIdx).pt.y);
            dstPoints.push(kp2.get(match.trainIdx).pt.x, kp2.get(match.trainIdx).pt.y);
        }
        
        const srcMat = cv.matFromArray(goodMatches.length, 1, cv.CV_32FC2, srcPoints);
        const dstMat = cv.matFromArray(goodMatches.length, 1, cv.CV_32FC2, dstPoints);
        
        sendProgress(70, '计算变换矩阵...');
        
        // Find homography
        const H = cv.findHomography(srcMat, dstMat, cv.RANSAC, 5.0);
        
        if (H.empty()) {
            throw new Error('无法计算变换矩阵');
        }
        
        sendProgress(80, '透视变换...');
        
        // Calculate output canvas size
        const resultWidth = img1.width + img2.width;
        const resultHeight = Math.max(img1.height, img2.height);
        
        // Warp perspective
        const warped1 = new cv.Mat();
        cv.warpPerspective(mat1, warped1, H, new cv.Size(resultWidth, resultHeight));
        
        // Create result image
        const result = new cv.Mat(resultHeight, resultWidth, cv.CV_8UC4, new cv.Scalar(0, 0, 0, 255));
        
        // Copy second image to result
        const roi2 = new cv.Rect(0, 0, mat2.cols, mat2.rows);
        mat2.copyTo(result.roi(roi2));
        
        // Blend first warped image
        for (let y = 0; y < resultHeight; y++) {
            for (let x = 0; x < resultWidth; x++) {
                const idx = (y * resultWidth + x) * 4;
                const w1 = warped1.data[idx + 3]; // alpha
                const w2 = result.data[idx + 3];
                
                if (w1 > 0 && w2 > 0) {
                    // Blend in overlap area
                    result.data[idx] = Math.round((warped1.data[idx] + result.data[idx]) / 2);
                    result.data[idx + 1] = Math.round((warped1.data[idx + 1] + result.data[idx + 1]) / 2);
                    result.data[idx + 2] = Math.round((warped1.data[idx + 2] + result.data[idx + 2]) / 2);
                    result.data[idx + 3] = 255;
                } else if (w1 > 0) {
                    result.data[idx] = warped1.data[idx];
                    result.data[idx + 1] = warped1.data[idx + 1];
                    result.data[idx + 2] = warped1.data[idx + 2];
                    result.data[idx + 3] = 255;
                }
            }
        }
        
        sendProgress(90, '裁切为XPAN画幅...');
        
        // Crop to XPAN aspect ratio (65:24)
        const xpanRatio = 65 / 24;
        let cropWidth = result.cols;
        let cropHeight = cropWidth / xpanRatio;
        
        if (cropHeight > result.rows) {
            cropHeight = result.rows;
            cropWidth = cropHeight * xpanRatio;
        }
        
        const cropX = Math.round((result.cols - cropWidth) / 2);
        const cropY = Math.round((result.rows - cropHeight) / 2);
        
        const roi = new cv.Rect(cropX, cropY, Math.round(cropWidth), Math.round(cropHeight));
        const cropped = new cv.Mat();
        result.roi(roi).copyTo(cropped);
        
        sendProgress(95, '生成结果...');
        
        // Convert result to ImageData
        const resultCanvas = new OffscreenCanvas(cropped.cols, cropped.rows);
        const resultCtx = resultCanvas.getContext('2d');
        const resultImageData = resultCtx.createImageData(cropped.cols, cropped.rows);
        
        for (let i = 0; i < cropped.data.length; i++) {
            resultImageData.data[i] = cropped.data[i];
        }
        
        resultCtx.putImageData(resultImageData, 0, 0);
        
        // Convert to blob
        const blob = await resultCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
        
        // Cleanup
        mat1.delete();
        mat2.delete();
        gray1.delete();
        gray2.delete();
        kp1.delete();
        kp2.delete();
        desc1.delete();
        desc2.delete();
        matches.delete();
        srcMat.delete();
        dstMat.delete();
        H.delete();
        warped1.delete();
        result.delete();
        cropped.delete();
        
        sendProgress(100, '完成！');
        
        // Send result as transferable
        const arrayBuffer = await blob.arrayBuffer();
        self.postMessage({
            type: 'result',
            width: cropped.cols,
            height: cropped.rows
        }, [arrayBuffer]);
        
    } catch (error) {
        self.postMessage({
            type: 'error',
            error: error.message || '拼接失败'
        });
    }
}