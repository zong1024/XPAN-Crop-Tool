# XPAN Camera - Android App

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Android-green?style=for-the-badge" alt="Android">
  <img src="https://img.shields.io/badge/Language-Kotlin-purple?style=for-the-badge" alt="Kotlin">
  <img src="https://img.shields.io/badge/Camera-CameraX-blue?style=for-the-badge" alt="CameraX">
</p>

一款专为 **Pixel 6 Pro** 优化的双摄像头全景拍摄应用，自动调用主摄和超广角进行 XPAN 画幅拍摄。

## ✨ 功能特性

- 📷 **双摄同时拍摄** - 主摄 + 超广角同步捕获
- 🧩 **自动拼接** - OpenCV ORB 特征点匹配
- 🎬 **XPAN 画幅** - 经典 65:24 全景比例
- 🔧 **畸变校正** - 超广角镜头畸变补偿
- 💾 **自动保存** - 直接存储到相册

## 🛠️ 技术栈

| 组件 | 技术 |
|------|------|
| 语言 | Kotlin |
| 相机 | CameraX |
| 图像处理 | OpenCV 4.9.0 |
| 架构 | MVVM |
| 异步 | Coroutines |

## 📱 Pixel 6 Pro 适配

### 摄像头参数

| 摄像头 | 焦距 | 传感器 | 光圈 |
|--------|------|--------|------|
| 主摄 | 24mm | Samsung GN1 | f/1.85 |
| 超广角 | 13mm | Sony IMX386 | f/2.2 |

### 处理流程

```
┌─────────────┐     ┌─────────────┐
│   主摄 24mm  │     │ 超广角 13mm │
└──────┬──────┘     └──────┬──────┘
       │                   │
       │            ┌──────▼──────┐
       │            │  畸变校正   │
       │            └──────┬──────┘
       │                   │
       │            ┌──────▼──────┐
       │            │  视角裁切   │
       │            └──────┬──────┘
       │                   │
       └───────┬───────────┘
               │
        ┌──────▼──────┐
        │ 特征点匹配  │
        └──────┬──────┘
               │
        ┌──────▼──────┐
        │  图像拼接   │
        └──────┬──────┘
               │
        ┌──────▼──────┐
        │ XPAN 裁切   │
        └─────────────┘
```

## 🚀 快速开始

### 环境要求

- Android Studio Hedgehog 或更高版本
- JDK 17
- Android SDK 34
- 目标设备: Android 7.0+ (API 24)

### 构建步骤

1. **打开项目**
   ```bash
   cd XPanCamera
   ```

2. **在 Android Studio 中打开**
   - File → Open → 选择 XPanCamera 目录

3. **同步 Gradle**
   - 等待 Gradle 同步完成
   - 下载 OpenCV 依赖

4. **连接设备**
   - 启用开发者选项和 USB 调试
   - 连接 Pixel 6 Pro

5. **运行**
   - 点击 Run 或按 Shift+F10

### 构建 APK

```bash
# Debug 版本
./gradlew assembleDebug

# Release 版本
./gradlew assembleRelease
```

APK 输出位置: `app/build/outputs/apk/`

## 📁 项目结构

```
XPanCamera/
├── app/
│   ├── src/main/
│   │   ├── java/com/xpan/camera/
│   │   │   ├── MainActivity.kt       # 主界面 + 相机逻辑
│   │   │   └── MainViewModel.kt      # 状态管理
│   │   ├── res/
│   │   │   ├── layout/
│   │   │   │   └── activity_main.xml # UI 布局
│   │   │   ├── drawable/             # 图标资源
│   │   │   ├── values/               # 字符串、主题
│   │   │   └── xml/                  # 配置文件
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts
├── build.gradle.kts
└── settings.gradle.kts
```

## ⚠️ 注意事项

### 多摄像头限制

Android 的多摄像头 API 有一定限制：
- 部分设备不支持同时开启多个摄像头
- 超广角可能作为逻辑摄像头实现
- 需要实际设备测试

### Pixel 6 Pro 特殊处理

- 超广角镜头有明显的桶形畸变
- 镜头物理间距约 20mm，需要视差补偿
- 建议拍摄 2 米以外的景物

## 🔧 待优化

- [ ] 精确的相机标定参数
- [ ] 更好的图像融合算法
- [ ] 手动曝光控制
- [ ] RAW 格式支持
- [ ] 实时预览拼接效果

## 📄 许可证

MIT License