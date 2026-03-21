"""
XPAN Crop Tool - RAW 解码后端服务
使用 rawpy 解码 RAW 文件，返回高质量 JPEG 图像
"""

import os
import io
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import rawpy
import numpy as np

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 配置
UPLOAD_FOLDER = 'temp_uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 最大 100MB


def decode_raw_file(file_path_or_bytes):
    """
    使用 rawpy 解码 RAW 文件
    返回 PIL Image 对象
    """
    try:
        # 打开 RAW 文件
        if isinstance(file_path_or_bytes, bytes):
            raw = rawpy.imread(file_path_or_bytes)
        else:
            with open(file_path_or_bytes, 'rb') as f:
                raw = rawpy.imread(f.read())
        
        # 使用 rawpy 的 postprocess 获取高质量图像
        # params 参数可以控制解码质量
        rgb = raw.postprocess(
            use_camera_wb=True,      # 使用相机的白平衡
            half_size=False,          # 不缩小尺寸（全分辨率）
            no_auto_bright=False,     # 自动亮度调整
            output_bps=8,             # 8位输出
            gamma=(2.222, 4.5),       # 标准gamma
            fbdd_noise_reduction=rawpy.FBDDNoiseReductionMode.Full,  # 全降噪
            demosaic_algorithm=rawpy.DemosaicAlgorithm.AHD,  # AHD demosaic算法
        )
        
        raw.close()
        
        # 转换为 PIL Image
        image = Image.fromarray(rgb)
        
        return image
    
    except Exception as e:
        raise Exception(f"RAW 解码失败: {str(e)}")


def image_to_base64(image, quality=98):
    """
    将 PIL Image 转换为 base64 编码的 JPEG
    """
    buffer = io.BytesIO()
    image.save(buffer, format='JPEG', quality=quality, subsampling=0)
    buffer.seek(0)
    
    base64_str = base64.b64encode(buffer.getvalue()).decode('utf-8')
    return f"data:image/jpeg;base64,{base64_str}"


@app.route('/api/decode', methods=['POST'])
def decode():
    """
    解码上传的 RAW 文件
    返回 base64 编码的 JPEG 图像
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': '没有上传文件'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400
        
        # 读取文件内容
        file_bytes = file.read()
        
        print(f"正在解码文件: {file.filename}, 大小: {len(file_bytes) / 1024 / 1024:.1f} MB")
        
        # 解码 RAW 文件
        image = decode_raw_file(file_bytes)
        
        print(f"解码完成: {image.width} x {image.height}")
        
        # 转换为 base64
        base64_str = image_to_base64(image)
        
        return jsonify({
            'success': True,
            'width': image.width,
            'height': image.height,
            'data': base64_str
        })
    
    except Exception as e:
        print(f"错误: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health():
    """健康检查"""
    return jsonify({
        'status': 'ok',
        'message': 'RAW 解码服务运行中'
    })


@app.route('/', methods=['GET'])
def index():
    """首页"""
    return '''
    <h1>XPAN RAW 解码服务</h1>
    <p>服务运行中</p>
    <h2>API 端点</h2>
    <ul>
        <li>POST /api/decode - 上传 RAW 文件进行解码</li>
        <li>GET /api/health - 健康检查</li>
    </ul>
    <h2>支持的 RAW 格式</h2>
    <ul>
        <li>Sony ARW (包括 A7C2)</li>
        <li>Canon CR2/CR3</li>
        <li>Nikon NEF</li>
        <li>Adobe DNG</li>
        <li>其他 LibRaw 支持的格式</li>
    </ul>
    '''


if __name__ == '__main__':
    print("=" * 50)
    print("XPAN RAW 解码服务")
    print("=" * 50)
    print("启动服务...")
    print("访问 http://localhost:5000 查看状态")
    print("=" * 50)
    
    app.run(host='0.0.0.0', port=5000, debug=True)