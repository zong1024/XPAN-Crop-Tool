// XPAN 画幅比例 65:24 (约 2.708:1)
const XPAN_RATIO = 65 / 24;

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
            handleFile(files[0]);
        }
    });
    
    // 垂直位置调整
    verticalPosition.addEventListener('input', () => {
        positionValue.textContent = verticalPosition.value + '%';
        updateCrop();
    });
    
    // 下载按钮
    downloadBtn.addEventListener('click', downloadImage);
    
    // 重置按钮
    resetBtn.addEventListener('click', reset);
}

// 处理文件选择
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

// 处理文件
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
            
            // 显示编辑器
            uploadArea.style.display = 'none';
            editorContainer.style.display = 'grid';
            
            // 设置原图
            originalImage.src = e.target.result;
            
            // 等图片加载完成后更新裁剪
            setTimeout(() => {
                updateCrop();
            }, 100);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// 更新裁剪区域和预览
function updateCrop() {
    if (!currentImage) return;
    
    const containerWidth = cropContainer.offsetWidth;
    const containerHeight = originalImage.offsetHeight;
    
    // 计算显示比例
    const displayScale = containerWidth / imageWidth;
    
    // 计算 XPAN 画幅的裁剪高度
    const cropHeight = imageWidth / XPAN_RATIO;
    
    // 如果图片高度不足以裁剪成 XPAN 画幅
    if (cropHeight > imageHeight) {
        // 按高度计算最大可用宽度
        const maxWidth = imageHeight * XPAN_RATIO;
        const displayCropWidth = maxWidth * displayScale;
        const displayCropHeight = containerHeight;
        
        // 居中裁剪宽度
        const leftOffset = (containerWidth - displayCropWidth) / 2;
        
        cropArea.style.left = leftOffset + 'px';
        cropArea.style.right = 'auto';
        cropArea.style.width = displayCropWidth + 'px';
        cropArea.style.top = '0';
        cropArea.style.height = displayCropHeight + 'px';
    } else {
        // 正常情况：宽度固定，调整高度
        const displayCropHeight = cropHeight * displayScale;
        
        // 根据垂直位置计算 top 值
        const maxTop = containerHeight - displayCropHeight;
        const position = verticalPosition.value / 100;
        const top = maxTop * position;
        
        cropArea.style.left = '0';
        cropArea.style.right = '0';
        cropArea.style.width = 'auto';
        cropArea.style.top = top + 'px';
        cropArea.style.height = displayCropHeight + 'px';
    }
    
    // 更新预览
    updatePreview();
}

// 更新预览画布
function updatePreview() {
    if (!currentImage) return;
    
    const ctx = resultCanvas.getContext('2d');
    
    // 计算裁剪区域
    let cropWidth, cropHeight, cropX, cropY;
    
    const idealCropHeight = imageWidth / XPAN_RATIO;
    
    if (idealCropHeight > imageHeight) {
        // 图片不够高，按高度计算宽度
        cropHeight = imageHeight;
        cropWidth = imageHeight * XPAN_RATIO;
        cropY = 0;
        cropX = (imageWidth - cropWidth) / 2;
    } else {
        // 正常裁剪
        cropWidth = imageWidth;
        cropHeight = idealCropHeight;
        cropX = 0;
        
        const maxCropY = imageHeight - cropHeight;
        const position = verticalPosition.value / 100;
        cropY = maxCropY * position;
    }
    
    // 设置画布尺寸（限制最大显示尺寸）
    const maxDisplayWidth = 800;
    const displayScale = Math.min(1, maxDisplayWidth / cropWidth);
    
    resultCanvas.width = cropWidth * displayScale;
    resultCanvas.height = cropHeight * displayScale;
    
    // 绘制裁剪区域
    ctx.drawImage(
        currentImage,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, resultCanvas.width, resultCanvas.height
    );
    
    // 更新尺寸信息
    originalSizeEl.textContent = `SOURCE: ${imageWidth} × ${imageHeight}`;
    resultSizeEl.textContent = `OUTPUT: ${Math.round(cropWidth)} × ${Math.round(cropHeight)}`;
    
    // 存储裁剪信息供下载使用
    resultCanvas.dataset.cropX = cropX;
    resultCanvas.dataset.cropY = cropY;
    resultCanvas.dataset.cropWidth = cropWidth;
    resultCanvas.dataset.cropHeight = cropHeight;
}

// 下载图片
function downloadImage() {
    if (!currentImage) return;
    
    // 创建全分辨率画布
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const cropX = parseFloat(resultCanvas.dataset.cropX);
    const cropY = parseFloat(resultCanvas.dataset.cropY);
    const cropWidth = parseFloat(resultCanvas.dataset.cropWidth);
    const cropHeight = parseFloat(resultCanvas.dataset.cropHeight);
    
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    
    // 绘制全分辨率图片
    ctx.drawImage(
        currentImage,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
    );
    
    // 下载
    const link = document.createElement('a');
    link.download = 'xpan_' + Date.now() + '.jpg';
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
}

// 重置
function reset() {
    currentImage = null;
    imageWidth = 0;
    imageHeight = 0;
    fileInput.value = '';
    verticalPosition.value = 50;
    positionValue.textContent = '50%';
    
    editorContainer.style.display = 'none';
    uploadArea.style.display = 'block';
}

// 窗口大小变化时重新计算
window.addEventListener('resize', () => {
    if (currentImage) {
        setTimeout(updateCrop, 100);
    }
});

// 初始化
init();