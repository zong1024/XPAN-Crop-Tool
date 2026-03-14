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

// 处理单张图片（预览模式）
function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('请选择图片文件！');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            currentImage = img;
            imageWidth = img.naturalWidth;
            imageHeight = img.naturalHeight;
            
            uploadArea.style.display = 'none';
            batchContainer.style.display = 'none';
            editorContainer.style.display = 'grid';
            
            originalImage.src = e.target.result;
            
            setTimeout(() => {
                updateCrop();
            }, 100);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// 处理多张图片（批量模式）
function handleMultipleFiles(files) {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
        alert('请选择图片文件！');
        return;
    }
    
    let loaded = 0;
    imageFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                batchImages.push({
                    id: Date.now() + Math.random(),
                    name: file.name,
                    image: img,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    yPosition: 50
                });
                loaded++;
                if (loaded === imageFiles.length) {
                    showBatchMode();
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
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
    
    const link = document.createElement('a');
    const ratioLabel = currentRatioName.replace(':', 'x').replace('/', '-');
    link.download = `crop_${ratioLabel}_${Date.now()}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
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
        
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
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
