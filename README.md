# XPAN 画幅裁剪工具

<p align="center">
  <img src="https://img.shields.io/badge/XPAN-Panoramic%20Crop-red?style=for-the-badge" alt="XPAN">
  <img src="https://img.shields.io/badge/PWA-Ready-green?style=for-the-badge" alt="PWA Ready">
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License">
</p>

一个专业的全景画幅裁剪工具，支持 XPAN、电影等多种比例，可在浏览器中直接使用。

## ✨ 功能特性

### 🖼️ 多比例裁剪
| 比例 | 名称 | 用途 |
|------|------|------|
| 2.71:1 | XPAN | 经典哈苏全景画幅 |
| 2.39:1 | Anamorphic | 电影宽银幕 |
| 2.35:1 | Cinemascope | 经典电影 |
| 1.85:1 | Flat | 美国标准电影 |
| 1.90:1 | IMAX | IMAX 数字 |
| 1.43:1 | IMAX 70mm | IMAX 胶片 |

### 🧩 全景拼接
- 上传两张重叠照片，自动识别并拼接成全景
- 使用 ORB 特征点检测算法
- 自动裁切为 XPAN 画幅
- 实时进度条显示处理状态

### 📦 批量处理
- 支持批量上传图片
- 一键打包下载为 ZIP
- 保留原始 EXIF 元数据

### 📱 PWA 支持
- 可安装到手机主屏幕
- 支持离线使用
- 像原生应用一样运行

## 🚀 快速开始

### 在线使用
1. 访问 [GitHub Pages](https://zong1024.github.io/XPAN-Crop-Tool/)
2. 拖拽或点击上传图片
3. 选择比例、调整位置
4. 下载裁剪后的图片

### 本地使用
```bash
# 克隆仓库
git clone https://github.com/zong1024/XPAN-Crop-Tool.git

# 进入目录
cd XPAN-Crop-Tool

# 用浏览器打开
open index.html
```

### 安卓手机安装
1. 用 Chrome 打开网站
2. 点击菜单 → "添加到主屏幕"
3. 应用会像原生 App 一样安装

## 🎯 使用指南

### 单张裁剪
1. 上传一张图片
2. 选择画幅比例
3. 拖动滑块调整垂直位置
4. 点击 DOWNLOAD 下载

### 全景拼接
1. 切换到"拼接模式"
2. 上传两张有重叠区域的照片
3. 等待自动拼接完成
4. 下载 XPAN 画幅的拼接图

### 批量处理
1. 同时上传多张图片
2. 设置统一的比例和位置
3. 点击 DOWNLOAD ALL 打包下载

## 🛠️ 技术栈

- **前端**: HTML5 Canvas, CSS3, Vanilla JavaScript
- **图像处理**: OpenCV.js (全景拼接)
- **压缩**: JSZip
- **EXIF**: piexifjs
- **PWA**: Service Worker, Web App Manifest

## 📁 项目结构

```
XPAN-Crop-Tool/
├── index.html          # 主页面
├── style.css           # 样式
├── app.js              # 主逻辑
├── stitch-worker.js    # 拼接 Web Worker
├── manifest.json       # PWA 配置
├── service-worker.js   # 离线缓存
├── Formula1-Bold.ttf   # 字体文件
└── README.md           # 文档
```

## 🙏 致谢

- 哈苏 XPAN - 经典全景相机
- OpenCV.js - 图像处理库
- Formula 1 字体 - 赛车风格设计

## 📄 许可证

MIT License

---

<p align="center">
  Made with ❤️ for panoramic photography lovers
</p>