// 画幅比例选项
const ASPECT_RATIOS = {
    'XPAN': { ratio: 65/24, label: 'XPAN' },
    '2.39:1': { ratio: 2.39, label: '2.39:1' },
    '2.35:1': { ratio: 2.35, label: '2.35:1' },
    '1.85:1': { ratio: 1.85, label: '1.85:1' },
    '1.90:1': { ratio: 1.90, label: '1.90:1' },
    '1.43:1': { ratio: 1.43, label: '1.43:1' }
};

// 当前选中的比例
let currentRatio = ASPECT_RATIOS['XPAN'].ratio;
let currentRatioName = 'XPAN';

// 批量处理相关
let batchImages = [];
let batchPosition = 50;

// DOM 元素
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const editorContainer = document.getElementById('editorContainer');
const originalImage = document.getElementById('originalImage');
const cropContainer = document.getElementById('cropContainer');
const cropArea = document.getElementById('cropArea');
const resultCanvas = document.getElementById('resultCanvas');
const verticalPosition = document.getElementById('verticalPosition');
const positionValue = document.getElementById('positionValue');
const originalSizeEl = document.getElementById('originalSize');
const resultSizeEl = document.getElementById('resultSize');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const ratioOptions = document.getElementById('ratioOptions');

// 批量处理 DOM 元素
const batchContainer = document.getElementById('batchContainer');
const batchRatioOptions = document.getElementById('batchRatioOptions');
const batchPositionSlider = document.getElementById('batchPosition');
const batchPositionValueEl = document.getElementById('batchPositionValue');
const imageQueue = document.getElementById('imageQueue');
const batchDownloadBtn = document.getElementById('batchDownloadBtn');
const addMoreBtn = document.getElementById('addMoreBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const imageCountEl = document.getElementById('imageCount');

// 当前图片信息
let currentImage = null;
let imageWidth = 0;
let imageHeight = 0;
let currentExif = null;  // 存储当前图片的EXIF数据

// 拼接模式相关
let currentMode = 'crop';  // 'crop' 或 'stitch'
let stitchImg1 = null;
let stitchImg2 = null;
let cvReady = false;

// DOM 元素 - 拼接模式
const stitchUploadArea = document.getElementById('stitchUploadArea');
const stitchSlot1 = document.getElementById('stitchSlot1');
const stitchSlot2 = document.getElementById('stitchSlot2');
const stitchImg1El = document.getElementById('stitchImg1');
const stitchImg2El = document.getElementById('stitchImg2');
const stitchFileInput = document.getElementById('stitchFileInput');
const startStitchBtn = document.getElementById('startStitchBtn');
const removeStitch1 = document.getElementById('removeStitch1');
const removeStitch2 = document.getElementById('removeStitch2');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const cropModeBtn = document.getElementById('cropModeBtn');
const stitchModeBtn = document.getElementById('stitchModeBtn');

// 检查是否为RAW文件
function isRawFile(file) {
    const rawExtensions = ['.arw', '.cr2', '.cr3', '.nef', '.dng', '.orf', '.rw2', '.raf', '.tiff', '.tif'];
    const fileName = file.name.toLowerCase();
    return rawExtensions.some(ext => fileName.endsWith(ext)) || 
           file.type === 'image/x-sony-arw' ||
           file.type === 'image/x-canon-cr2' ||
           file.type === 'image/x-nikon-nef' ||
           file.type === 'image/x-adobe-dng' ||
           file.type === 'image/tiff';
}

// 从RAW文件中提取嵌入的JPEG预览
function extractEmbeddedJpeg(data) {
    // JPEG起始标记 FFD8，结束标记 FFD9
    // Sony ARW 文件通常有多个嵌入的 JPEG（缩略图、预览图等）
    // 我们需要找到最大的那个（全尺寸预览图通常在文件末尾附近）
    
    let jpegSegments = [];
    
    // 找所有的 JPEG 起始和结束标记
    for (let i = 0; i < data.length - 1; i++) {
        if (data[i] === 0xFF && data[i + 1] === 0xD8) {
            jpegSegments.push({ type: 'start', pos: i });
        }
        if (data[i] === 0xFF && data[i + 1] === 0xD9) {
            jpegSegments.push({ type: 'end', pos: i });
        }
    }
    
    console.log('找到 JPEG 标记总数:', jpegSegments.length);
    
    // 找所有有效的 JPEG 段（起始到结束的配对）
    let validJpegs = [];
    for (let i = 0; i < jpegSegments.length; i++) {
        const marker = jpegSegments[i];
        if (marker.type === 'start') {
            // 找这个起始标记后面最近的结束标记
            for (let j = i + 1; j < jpegSegments.length; j++) {
                const endMarker = jpegSegments[j];
                if (endMarker.type === 'end' && endMarker.pos > marker.pos) {
                    const size = endMarker.pos - marker.pos;
                    validJpegs.push({
                        start: marker.pos,
                        end: endMarker.pos,
                        size: size,
                        startIndex: i
                    });
                    break; // 只匹配第一个结束标记
                }
            }
        }
    }
    
    console.log('找到有效 JPEG 段:', validJpegs.length);
    
    // 按大小排序，找最大的
    validJpegs.sort((a, b) => b.size - a.size);
    
    // 输出所有找到的 JPEG 大小（调试用）
    validJpegs.forEach((jpeg, idx) => {
        console.log(`JPEG ${idx + 1}: 位置 ${jpeg.start}, 大小 ${(jpeg.size / 1024).toFixed(1)} KB`);
    });
    
    // 选择最大的 JPEG（至少 100KB 才算全尺寸预览）
    if (validJpegs.length > 0 && validJpegs[0].size > 100000) {
        const best = validJpegs[0];
        console.log('选择最大 JPEG 预览: 位置', best.start, '大小', (best.size / 1024).toFixed(1), 'KB');
        const jpegData = data.slice(best.start, best.end + 2);
        const blob = new Blob([jpegData], { type: 'image/jpeg' });
        return blob;
    }
    
    // 降低要求到 10KB
    if (validJpegs.length > 0 && validJpegs[0].size > 10000) {
        const best = validJpegs[0];
        console.log('选择可用 JPEG 预览: 位置', best.start, '大小', (best.size / 1024).toFixed(1), 'KB');
        const jpegData = data.slice(best.start, best.end + 2);
        const blob = new Blob([jpegData], { type: 'image/jpeg' });
        return blob;
    }
    
    console.log('未找到有效的 JPEG 预览');
    return null;
}

// 解码RAW文件 (Sony ARW 等) - 提取嵌入的预览JPEG
async function decodeRawFile(arrayBuffer, fileName) {
    const data = new Uint8Array(arrayBuffer);
    
    // 方法1: 查找嵌入的JPEG预览图（大多数RAW文件都有）
    const jpegBlob = extractEmbeddedJpeg(data);
    if (jpegBlob) {
        console.log('成功提取嵌入的JPEG预览:', fileName);
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(jpegBlob);
        });
    }
    
    // 方法2: 尝试使用 UTIF 解码（适用于TIFF格式的RAW）
    if (typeof UTIF !== 'undefined') {
        try {
            const ifds = UTIF.decode(arrayBuffer);
            if (ifds && ifds.length > 0) {
                // 找最大的图像
                let mainIfd = ifds[0];
                for (const ifd of ifds) {
                    const w = UTIF.ifdGet(ifd, 256) || 0;
                    const h = UTIF.ifdGet(ifd, 257) || 0;
                    const mw = UTIF.ifdGet(mainIfd, 256) || 0;
                    const mh = UTIF.ifdGet(mainIfd, 257) || 0;
                    if (w * h > mw * mh) {
                        mainIfd = ifd;
                    }
                }
                
                const width = UTIF.ifdGet(mainIfd, 256);
                const height = UTIF.ifdGet(mainIfd, 257);
                
                if (width && height && width > 0 && height > 0) {
                    UTIF.decodeImage(arrayBuffer, mainIfd);
                    const rgba = UTIF.toRGBA8(mainIfd);
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    
                    const imageData = ctx.createImageData(width, height);
                    imageData.data.set(rgba);
                    ctx.putImageData(imageData, 0, 0);
                    
                    return canvas.toDataURL('image/jpeg', 0.95);
                }
            }
        } catch (e) {
            console.log('UTIF解码失败:', e.message);
        }
    }
    
    throw new Error('无法解码RAW文件，请确保文件是有效的RAW格式');
}

// 初始化事件监听
function init() {
    // 点击上传区域
    uploadArea.addEventListener('click', () => fileInput.click());
    
    // 文件选择
    fileInput.addEventListener('change', handleFileSelect);
    
    // 拖拽上传
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleMultipleFiles(files);
        }
    });
    
    // 垂直位置调整（单张模式）
    verticalPosition.addEventListener('input', () => {
        positionValue.textContent = verticalPosition.value + '%';
        updateCrop();
    });
    
    // 比例选择（单张模式）
    ratioOptions.addEventListener('click', (e) => {
        if (e.target.classList.contains('ratio-btn')) {
            document.querySelectorAll('#ratioOptions .ratio-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentRatio = parseFloat(e.target.dataset.ratio);
            currentRatioName = e.target.dataset.name;
            updateCrop();
        }
    });
    
    // 批量处理比例选择
    batchRatioOptions.addEventListener('click', (e) => {
        if (e.target.classList.contains('ratio-btn')) {
            document.querySelectorAll('#batchRatioOptions .ratio-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentRatio = parseFloat(e.target.dataset.ratio);
            currentRatioName = e.target.dataset.name;
            renderQueue();
        }
    });
    
    // 批量位置调整
    batchPositionSlider.addEventListener('input', () => {
        batchPosition = parseInt(batchPositionSlider.value);
        batchPositionValueEl.textContent = batchPosition + '%';
    });
    
    // 下载按钮
    downloadBtn.addEventListener('click', downloadImage);
    
    // 重置按钮
    resetBtn.addEventListener('click', reset);
    
    // 批量下载
    batchDownloadBtn.addEventListener('click', downloadAllAsZip);
    
    // 添加更多图片
    addMoreBtn.addEventListener('click', () => fileInput.click());
    
    // 清空所有
    clearAllBtn.addEventListener('click', clearAll);
    
    // 模式切换
    cropModeBtn.addEventListener('click', () => switchMode('crop'));
    stitchModeBtn.addEventListener('click', () => switchMode('stitch'));
    
    // 拼接模式事件
    stitchSlot1.addEventListener('click', () => {
        stitchFileInput.dataset.slot = '1';
        stitchFileInput.click();
    });
    
    stitchSlot2.addEventListener('click', () => {
        stitchFileInput.dataset.slot = '2';
        stitchFileInput.click();
    });
    
    stitchFileInput.addEventListener('change', handleStitchFileSelect);
    
    removeStitch1.addEventListener('click', (e) => {
        e.stopPropagation();
        clearStitchSlot(1);
    });
    
    removeStitch2.addEventListener('click', (e) => {
        e.stopPropagation();
        clearStitchSlot(2);
    });
    
    startStitchBtn.addEventListener('click', startStitch);
}

// 切换模式
function switchMode(mode) {
    currentMode = mode;
    
    cropModeBtn.classList.toggle('active', mode === 'crop');
    stitchModeBtn.classList.toggle('active', mode === 'stitch');
    
    uploadArea.style.display = 'none';
    stitchUploadArea.style.display = 'none';
    editorContainer.style.display = 'none';
    batchContainer.style.display = 'none';
    progressContainer.style.display = 'none';
    
    if (mode === 'crop') {
        uploadArea.style.display = 'block';
    } else {
        stitchUploadArea.style.display = 'block';
    }
}

// 处理拼接文件选择
function handleStitchFileSelect(e) {
    const file = e.target.files[0];
    const slot = e.target.dataset.slot;
    
    if (!file) return;
    
    const isRaw = isRawFile(file);
    if (!file.type.startsWith('image/') && !isRaw) return;
    
    processFile(file).then(dataUrl => {
        const img = new Image();
        img.onload = () => {
            if (slot === '1') {
                stitchImg1 = { image: img, dataUrl: dataUrl };
                stitchImg1El.src = dataUrl;
                stitchImg1El.style.display = 'block';
                removeStitch1.style.display = 'flex';
                stitchSlot1.querySelector('.stitch-slot-content').style.display = 'none';
            } else {
                stitchImg2 = { image: img, dataUrl: dataUrl };
                stitchImg2El.src = dataUrl;
                stitchImg2El.style.display = 'block';
                removeStitch2.style.display = 'flex';
                stitchSlot2.querySelector('.stitch-slot-content').style.display = 'none';
            }
            updateStitchButton();
        };
        img.src = dataUrl;
    }).catch(err => {
        alert('图片加载失败: ' + err.message);
    });
    
    e.target.value = '';
}

// 清除拼接槽位
function clearStitchSlot(slot) {
    if (slot === 1) {
        stitchImg1 = null;
        stitchImg1El.src = '';
        stitchImg1El.style.display = 'none';
        removeStitch1.style.display = 'none';
        stitchSlot1.querySelector('.stitch-slot-content').style.display = 'block';
    } else {
        stitchImg2 = null;
        stitchImg2El.src = '';
        stitchImg2El.style.display = 'none';
        removeStitch2.style.display = 'none';
        stitchSlot2.querySelector('.stitch-slot-content').style.display = 'block';
    }
    updateStitchButton();
}

// 更新拼接按钮状态
function updateStitchButton() {
    startStitchBtn.disabled = !(stitchImg1 && stitchImg2);
}

// 显示进度
function showProgress(percent, message) {
    progressContainer.style.display = 'block';
    progressFill.style.width = percent + '%';
    progressText.textContent = message;
}

// 隐藏进度
function hideProgress() {
    progressContainer.style.display = 'none';
}

// 开始拼接
function startStitch() {
    if (!stitchImg1 || !stitchImg2) return;
    
    startStitchBtn.disabled = true;
    showProgress(0, '初始化...');
    
    // 使用主线程处理（简化版）
    setTimeout(() => {
        simpleStitch(stitchImg1, stitchImg2);
    }, 100);
}

// 简单拼接（无特征匹配，直接水平拼接）
function simpleStitch(img1Data, img2Data) {
    try {
        showProgress(20, '加载图像...');
        
        const img1 = img1Data.image;
        const img2 = img2Data.image;
        
        showProgress(40, '计算拼接...');
        
        // 计算拼接后的尺寸
        const resultWidth = img1.width + img2.width;
        const resultHeight = Math.max(img1.height, img2.height);
        
        // 创建画布
        const canvas = document.createElement('canvas');
        canvas.width = resultWidth;
        canvas.height = resultHeight;
        const ctx = canvas.getContext('2d');
        
        // 绘制两张图片
        ctx.drawImage(img1, 0, 0);
        ctx.drawImage(img2, img1.width, 0);
        
        showProgress(60, '裁切为XPAN画幅...');
        
        // 裁切为 XPAN 画幅
        const xpanRatio = 65 / 24;
        let cropWidth = resultWidth;
        let cropHeight = cropWidth / xpanRatio;
        
        if (cropHeight > resultHeight) {
            cropHeight = resultHeight;
            cropWidth = cropHeight * xpanRatio;
        }
        
        const cropX = (resultWidth - cropWidth) / 2;
        const cropY = (resultHeight - cropHeight) / 2;
        
        // 创建裁切后的画布
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = cropWidth;
        croppedCanvas.height = cropHeight;
        const croppedCtx = croppedCanvas.getContext('2d');
        
        croppedCtx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        
        showProgress(80, '生成结果...');
        
        // 转换为图片并显示
        const dataUrl = croppedCanvas.toDataURL('image/jpeg', 0.95);
        
        // 设置为当前图片
        const resultImg = new Image();
        resultImg.onload = () => {
            currentImage = resultImg;
            imageWidth = cropWidth;
            imageHeight = cropHeight;
            
            // 切换到编辑模式
            stitchUploadArea.style.display = 'none';
            progressContainer.style.display = 'none';
            editorContainer.style.display = 'grid';
            
            originalImage.src = dataUrl;
            
            // 重置比例到 XPAN
            currentRatio = 65/24;
            currentRatioName = 'XPAN';
            document.querySelectorAll('#ratioOptions .ratio-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.name === 'XPAN');
            });
            
            setTimeout(() => {
                updateCrop();
            }, 100);
            
            startStitchBtn.disabled = false;
        };
        resultImg.src = dataUrl;
        
        showProgress(100, '完成！');
        
    } catch (error) {
        alert('拼接失败: ' + error.message);
        hideProgress();
        startStitchBtn.disabled = false;
    }
}

// 处理文件选择
function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 1) {
        handleMultipleFiles(files);
    } else if (files.length === 1) {
        handleFile(files[0]);
    }
}

// 处理文件（返回Promise）
async function processFile(file) {
    const isRaw = isRawFile(file);
    
    if (!file.type.startsWith('image/') && !isRaw) {
        throw new Error('请选择图片文件！');
    }
    
    let dataUrl;
    
    if (isRaw) {
        // 处理RAW文件
        const arrayBuffer = await file.arrayBuffer();
        dataUrl = await decodeRawFile(arrayBuffer, file.name);
    } else {
        // 处理普通图片
        dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    return dataUrl;
}

// 处理单张图片（预览模式）
async function handleFile(file) {
    const isRaw = isRawFile(file);
    
    if (!file.type.startsWith('image/') && !isRaw) {
        alert('请选择图片文件！');
        return;
    }
    
    // 显示加载提示
    if (isRaw) {
        showProgress(0, '正在解码RAW文件...');
    }
    
    try {
        let dataUrl;
        let exifData = null;
        
        if (isRaw) {
            // 处理RAW文件
            showProgress(30, '读取RAW数据...');
            const arrayBuffer = await file.arrayBuffer();
            
            showProgress(50, '解码RAW图像...');
            dataUrl = await decodeRawFile(arrayBuffer, file.name);
            
            showProgress(80, '加载预览...');
            // RAW文件通常不包含标准EXIF，尝试从预览图中提取
            try {
                exifData = piexif.load(dataUrl);
            } catch (ex) {
                console.log('No EXIF data in decoded RAW');
            }
        } else {
            // 处理普通图片
            dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            
            // 提取EXIF数据
            try {
                exifData = piexif.load(dataUrl);
            } catch (ex) {
                console.log('No EXIF data found');
            }
        }
        
        currentExif = exifData;
        
        const img = new Image();
        img.onload = () => {
            currentImage = img;
            imageWidth = img.naturalWidth;
            imageHeight = img.naturalHeight;
            
            uploadArea.style.display = 'none';
            batchContainer.style.display = 'none';
            editorContainer.style.display = 'grid';
            hideProgress();
            
            originalImage.src = dataUrl;
            
            setTimeout(() => {
                updateCrop();
            }, 100);
        };
        img.onerror = () => {
            hideProgress();
            alert('图片加载失败！');
        };
        img.src = dataUrl;
        
        if (isRaw) {
            showProgress(100, '完成！');
        }
    } catch (error) {
        hideProgress();
        console.error('处理文件失败:', error);
        alert('处理文件失败: ' + error.message);
    }
}

// 处理多张图片（批量模式）
async function handleMultipleFiles(files) {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/') || isRawFile(f));
    
    if (imageFiles.length === 0) {
        alert('请选择图片文件！');
        return;
    }
    
    showProgress(0, `正在处理 ${imageFiles.length} 个文件...`);
    
    let loaded = 0;
    const total = imageFiles.length;
    
    for (const file of imageFiles) {
        try {
            const dataUrl = await processFile(file);
            
            // 提取EXIF数据
            let exif = null;
            try {
                exif = piexif.load(dataUrl);
            } catch (ex) {
                console.log('No EXIF for', file.name);
            }
            
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = dataUrl;
            });
            
            batchImages.push({
                id: Date.now() + Math.random(),
                name: file.name,
                image: img,
                dataUrl: dataUrl,
                width: img.naturalWidth,
                height: img.naturalHeight,
                yPosition: 50,
                exif: exif  // 存储EXIF数据
            });
            
            loaded++;
            showProgress(Math.round((loaded / total) * 100), `处理中 ${loaded}/${total}...`);
            
        } catch (error) {
            console.error('处理文件失败:', file.name, error);
        }
    }
    
    hideProgress();
    
    if (batchImages.length > 0) {
        showBatchMode();
    } else {
        alert('没有成功加载任何图片！');
    }
}

// 显示批量处理模式
function showBatchMode() {
    uploadArea.style.display = 'none';
    editorContainer.style.display = 'none';
    batchContainer.style.display = 'block';
    renderQueue();
}

// 渲染图片队列
function renderQueue() {
    imageQueue.innerHTML = '';
    imageCountEl.textContent = `(${batchImages.length})`;
    
    batchImages.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'queue-item';
        div.innerHTML = `
            <div class="queue-thumbnail">
                <img src="${item.image.src}" alt="${item.name}">
            </div>
            <div class="queue-info">
                <span class="queue-name">${item.name}</span>
                <span class="queue-size">${item.width} × ${item.height}</span>
            </div>
            <div class="queue-preview">
                <canvas class="preview-canvas" data-index="${index}"></canvas>
            </div>
            <button class="queue-remove" data-index="${index}">×</button>
        `;
        imageQueue.appendChild(div);
        
        // 绘制预览
        const previewCanvas = div.querySelector('.preview-canvas');
        drawPreview(item, previewCanvas, 80);
    });
    
    // 删除按钮事件
    document.querySelectorAll('.queue-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            batchImages.splice(index, 1);
            if (batchImages.length === 0) {
                clearAll();
            } else {
                renderQueue();
            }
        });
    });
}

// 绘制预览图
function drawPreview(item, canvas, maxWidth) {
    const ctx = canvas.getContext('2d');
    
    let cropWidth, cropHeight, cropX, cropY;
    const idealCropHeight = item.width / currentRatio;
    
    if (idealCropHeight > item.height) {
        cropHeight = item.height;
        cropWidth = item.height * currentRatio;
        cropY = 0;
        cropX = (item.width - cropWidth) / 2;
    } else {
        cropWidth = item.width;
        cropHeight = idealCropHeight;
        cropX = 0;
        const maxCropY = item.height - cropHeight;
        cropY = maxCropY * (batchPosition / 100);
    }
    
    const scale = maxWidth / cropWidth;
    canvas.width = maxWidth;
    canvas.height = cropHeight * scale;
    
    ctx.drawImage(
        item.image,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, canvas.width, canvas.height
    );
}

// 更新裁剪区域和预览
function updateCrop() {
    if (!currentImage) return;
    
    const containerWidth = cropContainer.offsetWidth;
    const containerHeight = originalImage.offsetHeight;
    
    const displayScale = containerWidth / imageWidth;
    const cropHeight = imageWidth / currentRatio;
    
    if (cropHeight > imageHeight) {
        const maxWidth = imageHeight * currentRatio;
        const displayCropWidth = maxWidth * displayScale;
        const displayCropHeight = containerHeight;
        const leftOffset = (containerWidth - displayCropWidth) / 2;
        
        cropArea.style.left = leftOffset + 'px';
        cropArea.style.right = 'auto';
        cropArea.style.width = displayCropWidth + 'px';
        cropArea.style.top = '0';
        cropArea.style.height = displayCropHeight + 'px';
    } else {
        const displayCropHeight = cropHeight * displayScale;
        const maxTop = containerHeight - displayCropHeight;
        const position = verticalPosition.value / 100;
        const top = maxTop * position;
        
        cropArea.style.left = '0';
        cropArea.style.right = '0';
        cropArea.style.width = 'auto';
        cropArea.style.top = top + 'px';
        cropArea.style.height = displayCropHeight + 'px';
    }
    
    updatePreview();
}

// 更新预览画布
function updatePreview() {
    if (!currentImage) return;
    
    const ctx = resultCanvas.getContext('2d');
    let cropWidth, cropHeight, cropX, cropY;
    
    const idealCropHeight = imageWidth / currentRatio;
    
    if (idealCropHeight > imageHeight) {
        cropHeight = imageHeight;
        cropWidth = imageHeight * currentRatio;
        cropY = 0;
        cropX = (imageWidth - cropWidth) / 2;
    } else {
        cropWidth = imageWidth;
        cropHeight = idealCropHeight;
        cropX = 0;
        const maxCropY = imageHeight - cropHeight;
        const position = verticalPosition.value / 100;
        cropY = maxCropY * position;
    }
    
    const maxDisplayWidth = 800;
    const displayScale = Math.min(1, maxDisplayWidth / cropWidth);
    
    resultCanvas.width = cropWidth * displayScale;
    resultCanvas.height = cropHeight * displayScale;
    
    ctx.drawImage(
        currentImage,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, resultCanvas.width, resultCanvas.height
    );
    
    originalSizeEl.textContent = `SOURCE: ${imageWidth} × ${imageHeight}`;
    resultSizeEl.textContent = `OUTPUT: ${Math.round(cropWidth)} × ${Math.round(cropHeight)}`;
    
    resultCanvas.dataset.cropX = cropX;
    resultCanvas.dataset.cropY = cropY;
    resultCanvas.dataset.cropWidth = cropWidth;
    resultCanvas.dataset.cropHeight = cropHeight;
}

// 带EXIF的canvas转DataUrl
function canvasToDataURLWithExif(canvas, exif, quality = 0.95) {
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    
    if (exif) {
        try {
            // 更新EXIF中的图片尺寸
            const width = canvas.width;
            const height = canvas.height;
            
            // 更新0th IFD中的尺寸信息
            if (exif['0th']) {
                exif['0th'][piexif.ImageTag.ImageWidth] = width;
                exif['0th'][piexif.ImageTag.ImageLength] = height;
            }
            
            // 更新Exif IFD中的像素尺寸
            if (exif['Exif']) {
                exif['Exif'][piexif.ExifTag.PixelXDimension] = width;
                exif['Exif'][piexif.ExifTag.PixelYDimension] = height;
            }
            
            const exifBytes = piexif.dump(exif);
            dataUrl = piexif.insert(exifBytes, dataUrl);
        } catch (ex) {
            console.log('Failed to insert EXIF:', ex);
        }
    }
    
    return dataUrl;
}

// 下载单张图片
function downloadImage() {
    if (!currentImage) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const cropX = parseFloat(resultCanvas.dataset.cropX);
    const cropY = parseFloat(resultCanvas.dataset.cropY);
    const cropWidth = parseFloat(resultCanvas.dataset.cropWidth);
    const cropHeight = parseFloat(resultCanvas.dataset.cropHeight);
    
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    
    ctx.drawImage(
        currentImage,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
    );
    
    // 使用带EXIF的导出
    const dataUrl = canvasToDataURLWithExif(canvas, currentExif);
    
    const link = document.createElement('a');
    const ratioLabel = currentRatioName.replace(':', 'x').replace('/', '-');
    link.download = `crop_${ratioLabel}_${Date.now()}.jpg`;
    link.href = dataUrl;
    link.click();
}

// DataURL转Blob
function dataURLtoBlob(dataURL) {
    const byteString = atob(dataURL.split(',')[1]);
    const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
}

// 批量下载为ZIP
async function downloadAllAsZip() {
    if (batchImages.length === 0) return;
    
    batchDownloadBtn.textContent = 'PROCESSING...';
    batchDownloadBtn.disabled = true;
    
    const zip = new JSZip();
    const ratioLabel = currentRatioName.replace(':', 'x').replace('/', '-');
    
    for (let i = 0; i < batchImages.length; i++) {
        const item = batchImages[i];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        let cropWidth, cropHeight, cropX, cropY;
        const idealCropHeight = item.width / currentRatio;
        
        if (idealCropHeight > item.height) {
            cropHeight = item.height;
            cropWidth = item.height * currentRatio;
            cropY = 0;
            cropX = (item.width - cropWidth) / 2;
        } else {
            cropWidth = item.width;
            cropHeight = idealCropHeight;
            cropX = 0;
            const maxCropY = item.height - cropHeight;
            cropY = maxCropY * (batchPosition / 100);
        }
        
        canvas.width = cropWidth;
        canvas.height = cropHeight;
        
        ctx.drawImage(
            item.image,
            cropX, cropY, cropWidth, cropHeight,
            0, 0, cropWidth, cropHeight
        );
        
        // 使用带EXIF的导出
        const dataUrl = canvasToDataURLWithExif(canvas, item.exif);
        const blob = dataURLtoBlob(dataUrl);
        
        const fileName = `${ratioLabel}_${String(i + 1).padStart(3, '0')}_${item.name}`;
        zip.file(fileName, blob);
    }
    
    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.download = `crop_${ratioLabel}_${Date.now()}.zip`;
    link.href = URL.createObjectURL(content);
    link.click();
    
    batchDownloadBtn.textContent = 'DOWNLOAD ALL (ZIP)';
    batchDownloadBtn.disabled = false;
}

// 清空所有
function clearAll() {
    batchImages = [];
    currentImage = null;
    imageWidth = 0;
    imageHeight = 0;
    fileInput.value = '';
    verticalPosition.value = 50;
    positionValue.textContent = '50%';
    batchPositionSlider.value = 50;
    batchPosition = 50;
    batchPositionValueEl.textContent = '50%';
    
    editorContainer.style.display = 'none';
    batchContainer.style.display = 'none';
    uploadArea.style.display = 'block';
}

// 重置
function reset() {
    clearAll();
}

// 窗口大小变化时重新计算
window.addEventListener('resize', () => {
    if (currentImage) {
        setTimeout(updateCrop, 100);
    }
});

// 注册 Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then((registration) => {
                console.log('SW registered:', registration.scope);
            })
            .catch((error) => {
                console.log('SW registration failed:', error);
            });
    });
}

// 初始化
init();