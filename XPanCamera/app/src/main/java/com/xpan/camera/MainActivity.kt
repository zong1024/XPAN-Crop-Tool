package com.xpan.camera

import android.Manifest
import android.content.ContentValues
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.util.Log
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.xpan.camera.databinding.ActivityMainBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.opencv.android.OpenCVLoader
import org.opencv.android.Utils
import org.opencv.core.*
import org.opencv.features2d.BFMatcher
import org.opencv.features2d.ORB
import org.opencv.imgproc.Imgproc
import java.io.ByteArrayOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var cameraExecutor: ExecutorService
    private val viewModel: MainViewModel by viewModels()

    // CameraX
    private var mainCamera: Camera? = null
    private var ultraWideCamera: Camera? = null
    private var mainImageCapture: ImageCapture? = null
    private var ultraWideImageCapture: ImageCapture? = null

    // Pixel 6 Pro 摄像头参数
    companion object {
        const val TAG = "XPANCamera"
        
        // Pixel 6 Pro 摄像头物理参数
        const val MAIN_FOCAL_LENGTH = 24.0  // mm (35mm等效)
        const val ULTRA_WIDE_FOCAL_LENGTH = 13.0  // mm
        const val LENS_SPACING_MM = 20.0  // 镜头间距约20mm
        
        // XPAN画幅比例 (65:24)
        const val XPAN_RATIO = 65.0 / 24.0
    }

    // 权限请求
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            startDualCameras()
        } else {
            Toast.makeText(this, R.string.permission_required, Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // 初始化 OpenCV
        if (!OpenCVLoader.initDebug()) {
            Log.e(TAG, "OpenCV initialization failed")
        } else {
            Log.d(TAG, "OpenCV initialized successfully")
        }

        cameraExecutor = Executors.newFixedThreadPool(2)

        // 拍摄按钮
        binding.captureButton.setOnClickListener {
            captureDualImages()
        }

        // 检查权限并启动相机
        if (allPermissionsGranted()) {
            startDualCameras()
        } else {
            requestPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun allPermissionsGranted() = ContextCompat.checkSelfPermission(
        this, Manifest.permission.CAMERA
    ) == PackageManager.PERMISSION_GRANTED

    /**
     * 启动双摄像头预览
     * Pixel 6 Pro: 主摄 (Camera 0) + 超广角 (Logical Camera)
     */
    private fun startDualCameras() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()
            
            try {
                // 获取所有摄像头
                val cameraManager = getSystemService(CAMERA_SERVICE) as android.hardware.camera2.CameraManager
                val cameraIdList = cameraManager.cameraIdList
                
                Log.d(TAG, "Available cameras: ${cameraIdList.joinToString()}")
                
                // 绑定主摄像头预览
                val mainPreview = Preview.Builder()
                    .build()
                    .also { preview ->
                        preview.setSurfaceProvider(binding.mainCameraPreview.surfaceProvider)
                    }

                mainImageCapture = ImageCapture.Builder()
                    .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                    .setTargetResolution(android.util.Size(4032, 3024))
                    .build()

                // 主摄使用后置摄像头
                val mainCameraSelector = CameraSelector.Builder()
                    .requireLensFacing(CameraSelector.LENS_FACING_BACK)
                    .build()

                cameraProvider.unbindAll()
                mainCamera = cameraProvider.bindToLifecycle(
                    this, mainCameraSelector, mainPreview, mainImageCapture
                )

                // 尝试绑定超广角摄像头
                // Pixel 6 Pro 的超广角通常作为逻辑摄像头的一部分
                bindUltraWideCamera(cameraProvider)

                updateStatus("准备拍摄")

            } catch (e: Exception) {
                Log.e(TAG, "Camera binding failed", e)
                updateStatus("相机启动失败: ${e.message}")
            }
            
        }, ContextCompat.getMainExecutor(this))
    }

    /**
     * 绑定超广角摄像头
     * 使用 CameraX 的多摄像头 API
     */
    private fun bindUltraWideCamera(cameraProvider: ProcessCameraProvider) {
        try {
            val ultraWidePreview = Preview.Builder()
                .build()
                .also { preview ->
                    preview.setSurfaceProvider(binding.ultraWidePreview.surfaceProvider)
                }

            ultraWideImageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .setTargetResolution(android.util.Size(4032, 3024))
                .build()

            // 尝试使用超广角摄像头
            // 在支持的设备上，这会自动切换到超广角
            val ultraWideSelector = CameraSelector.Builder()
                .requireLensFacing(CameraSelector.LENS_FACING_BACK)
                .addFilter { cameras ->
                    // 尝试找到超广角摄像头
                    cameras.filter { camera ->
                        val characteristics = camera.cameraInfo.cameraSelector
                        true // 在实际设备上需要更精确的检测
                    }
                }
                .build()

            // 为超广角创建单独的 lifecycle owner
            // 注意：这需要 API 支持
            ultraWideCamera = cameraProvider.bindToLifecycle(
                this, ultraWideSelector, ultraWidePreview, ultraWideImageCapture
            )

        } catch (e: Exception) {
            Log.w(TAG, "Ultra wide camera binding failed, using alternative approach", e)
            // 如果失败，显示提示
            binding.ultraWidePreview.post {
                Toast.makeText(this, "超广角不可用，将使用主摄裁切", Toast.LENGTH_SHORT).show()
            }
        }
    }

    /**
     * 同时捕获两个摄像头的图像
     */
    private fun captureDualImages() {
        if (mainImageCapture == null) {
            updateStatus("相机未就绪")
            return
        }

        updateStatus("拍摄中...")
        binding.progressBar.visibility = android.view.View.VISIBLE
        binding.captureButton.isEnabled = false

        // 存储捕获的图像
        var mainBitmap: Bitmap? = null
        var ultraWideBitmap: Bitmap? = null
        var captureCount = 0

        val onCaptureComplete = {
            captureCount++
            if (captureCount >= 2 && mainBitmap != null) {
                // 两张图片都捕获完成，开始处理
                processAndStitchImages(mainBitmap!!, ultraWideBitmap ?: mainBitmap!!)
            }
        }

        // 捕获主摄像头图像
        mainImageCapture?.takePicture(
            cameraExecutor,
            object : ImageCapture.OnImageCapturedCallback() {
                override fun onCaptureSuccess(image: ImageProxy) {
                    mainBitmap = imageProxyToBitmap(image)
                    image.close()
                    onCaptureComplete()
                }

                override fun onError(exception: ImageCaptureException) {
                    Log.e(TAG, "Main camera capture failed", exception)
                    onCaptureComplete()
                }
            }
        )

        // 捕获超广角图像
        ultraWideImageCapture?.takePicture(
            cameraExecutor,
            object : ImageCapture.OnImageCapturedCallback() {
                override fun onCaptureSuccess(image: ImageProxy) {
                    ultraWideBitmap = imageProxyToBitmap(image)
                    image.close()
                    onCaptureComplete()
                }

                override fun onError(exception: ImageCaptureException) {
                    Log.e(TAG, "Ultra wide capture failed", exception)
                    // 使用主摄模拟
                    ultraWideBitmap = mainBitmap
                    onCaptureComplete()
                }
            }
        ) ?: run {
            // 如果超广角不可用，直接使用主摄
            captureCount++
            ultraWideBitmap = null
        }
    }

    /**
     * 将 ImageProxy 转换为 Bitmap
     */
    private fun imageProxyToBitmap(image: ImageProxy): Bitmap {
        val buffer = image.planes[0].buffer
        val bytes = ByteArray(buffer.remaining())
        buffer.get(bytes)
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    }

    /**
     * 处理并拼接图像
     */
    private fun processAndStitchImages(mainBitmap: Bitmap, ultraWideBitmap: Bitmap) {
        lifecycleScope.launch {
            try {
                updateStatus("处理图像中...")

                val result = withContext(Dispatchers.Default) {
                    stitchAndCropImages(mainBitmap, ultraWideBitmap)
                }

                if (result != null) {
                    updateStatus("保存中...")
                    saveImageToGallery(result)
                    updateStatus("保存成功！")
                } else {
                    updateStatus("拼接失败")
                }

            } catch (e: Exception) {
                Log.e(TAG, "Image processing failed", e)
                updateStatus("处理失败: ${e.message}")
            } finally {
                binding.progressBar.visibility = android.view.View.GONE
                binding.captureButton.isEnabled = true
            }
        }
    }

    /**
     * 图像拼接和 XPAN 裁切
     * 使用 OpenCV ORB 特征点匹配
     */
    private fun stitchAndCropImages(mainBmp: Bitmap, ultraWideBmp: Bitmap): Bitmap? {
        try {
            // 转换为 OpenCV Mat
            val mainMat = Mat()
            val ultraWideMat = Mat()
            Utils.bitmapToMat(mainBmp, mainMat)
            Utils.bitmapToMat(ultraWideBmp, ultraWideMat)

            // 超广角畸变校正（简化版）
            // 实际应用中需要精确的相机标定参数
            val undistortedUltraWide = correctUltraWideDistortion(ultraWideMat)

            // 超广角视角裁切（模拟主摄视角）
            // 13mm / 24mm ≈ 0.54
            val croppedUltraWide = cropToMatchFOV(undistortedUltraWide, MAIN_FOCAL_LENGTH / ULTRA_WIDE_FOCAL_LENGTH)

            // 特征点检测和匹配
            val stitchResult = stitchImages(mainMat, croppedUltraWide)

            if (stitchResult != null) {
                // 裁切为 XPAN 画幅
                val xpanCropped = cropToXPAN(stitchResult)

                // 转换回 Bitmap
                val resultBitmap = Bitmap.createBitmap(
                    xpanCropped.cols(), xpanCropped.rows(), Bitmap.Config.ARGB_8888
                )
                Utils.matToBitmap(xpanCropped, resultBitmap)

                // 释放资源
                mainMat.release()
                ultraWideMat.release()
                undistortedUltraWide.release()
                croppedUltraWide.release()
                stitchResult.release()
                xpanCropped.release()

                return resultBitmap
            }

            // 如果拼接失败，直接裁切主摄为 XPAN
            val xpanCropped = cropToXPAN(mainMat)
            val resultBitmap = Bitmap.createBitmap(
                xpanCropped.cols(), xpanCropped.rows(), Bitmap.Config.ARGB_8888
            )
            Utils.matToBitmap(xpanCropped, resultBitmap)

            mainMat.release()
            xpanCropped.release()

            return resultBitmap

        } catch (e: Exception) {
            Log.e(TAG, "Stitching error", e)
            return null
        }
    }

    /**
     * 超广角畸变校正
     */
    private fun correctUltraWideDistortion(mat: Mat): Mat {
        val result = Mat()
        
        // 简化的畸变校正参数
        // 实际应用中需要精确标定
        val cameraMatrix = Mat.eye(3, 3, CvType.CV_64F)
        cameraMatrix.put(0, 0, mat.cols().toDouble())  // fx
        cameraMatrix.put(1, 1, mat.cols().toDouble())  // fy
        cameraMatrix.put(0, 2, mat.cols() / 2.0)       // cx
        cameraMatrix.put(1, 2, mat.rows() / 2.0)       // cy

        // 畸变系数 (估算值)
        val distCoeffs = Mat.zeros(1, 5, CvType.CV_64F)
        distCoeffs.put(0, 0, -0.1)  // k1
        distCoeffs.put(0, 1, 0.01)  // k2
        distCoeffs.put(0, 4, 0.0)   // k3

        val newCameraMatrix = Mat()
        Imgproc.undistort(mat, result, cameraMatrix, distCoeffs, newCameraMatrix)

        cameraMatrix.release()
        distCoeffs.release()
        newCameraMatrix.release()

        return result
    }

    /**
     * 裁切超广角图像以匹配主摄视角
     */
    private fun cropToMatchFOV(mat: Mat, ratio: Double): Mat {
        val newWidth = (mat.cols() * ratio).toInt()
        val newHeight = (mat.rows() * ratio).toInt()
        val x = (mat.cols() - newWidth) / 2
        val y = (mat.rows() - newHeight) / 2

        val roi = Rect(x, y, newWidth, newHeight)
        return Mat(mat, roi)
    }

    /**
     * 使用 ORB 特征点拼接图像
     */
    private fun stitchImages(img1: Mat, img2: Mat): Mat? {
        try {
            // 转换为灰度图
            val gray1 = Mat()
            val gray2 = Mat()
            Imgproc.cvtColor(img1, gray1, Imgproc.COLOR_RGBA2GRAY)
            Imgproc.cvtColor(img2, gray2, Imgproc.COLOR_RGBA2GRAY)

            // ORB 特征检测
            val orb = ORB.create(1000)
            val keypoints1 = MatOfKeyPoint()
            val keypoints2 = MatOfKeyPoint()
            val descriptors1 = Mat()
            val descriptors2 = Mat()

            orb.detectAndCompute(gray1, Mat(), keypoints1, descriptors1)
            orb.detectAndCompute(gray2, Mat(), keypoints2, descriptors2)

            if (descriptors1.empty() || descriptors2.empty()) {
                return null
            }

            // 特征匹配
            val matcher = BFMatcher.create(Core.NORM_HAMMING)
            val matches = MatOfDMatch()
            matcher.match(descriptors1, descriptors2, matches)

            // 过滤好的匹配点
            val matchesList = matches.toList()
            val minDist = matchesList.minOfOrNull { it.distance } ?: 0.0
            val goodMatches = matchesList.filter { it.distance < Math.max(2 * minDist, 30.0) }

            if (goodMatches.size < 4) {
                return null
            }

            // 提取匹配点坐标
            val srcPoints = mutableListOf<Point>()
            val dstPoints = mutableListOf<Point>()
            val kp1List = keypoints1.toList()
            val kp2List = keypoints2.toList()

            for (match in goodMatches) {
                srcPoints.add(kp1List[match.queryIdx].pt)
                dstPoints.add(kp2List[match.trainIdx].pt)
            }

            val srcMat = MatOfPoint2f()
            srcMat.fromList(srcPoints)
            val dstMat = MatOfPoint2f()
            dstMat.fromList(dstPoints)

            // 计算单应性矩阵
            val H = Imgproc.findHomography(srcMat, dstMat, Imgproc.RANSAC, 5.0)

            if (H == null || H.empty()) {
                return null
            }

            // 计算结果图像大小
            val resultWidth = img1.cols() + img2.cols()
            val resultHeight = Math.max(img1.rows(), img2.rows())

            // 透视变换
            val warpedImg1 = Mat()
            Imgproc.warpPerspective(img1, warpedImg1, H, Size(resultWidth.toDouble(), resultHeight.toDouble()))

            // 合并图像
            val result = Mat.zeros(resultHeight, resultWidth, img1.type())
            val roi = Rect(0, 0, img2.cols(), img2.rows())
            img2.copyTo(Mat(result, roi))

            // 混合重叠区域
            for (y in 0 until resultHeight) {
                for (x in 0 until resultWidth) {
                    val idx = (y * resultWidth + x) * 4
                    if (idx < warpedImg1.total() * 4) {
                        val w1 = warpedImg1.get(y, x)
                        val w2 = result.get(y, x)
                        if (w1[3] > 0 && w2[3] > 0) {
                            result.put(y, x,
                                (w1[0] + w2[0]) / 2,
                                (w1[1] + w2[1]) / 2,
                                (w1[2] + w2[2]) / 2,
                                255.0
                            )
                        } else if (w1[3] > 0) {
                            result.put(y, x, w1[0], w1[1], w1[2], 255.0)
                        }
                    }
                }
            }

            // 释放资源
            gray1.release()
            gray2.release()
            keypoints1.release()
            keypoints2.release()
            descriptors1.release()
            descriptors2.release()
            matches.release()
            H.release()
            warpedImg1.release()

            return result

        } catch (e: Exception) {
            Log.e(TAG, "Stitching failed", e)
            return null
        }
    }

    /**
     * 裁切为 XPAN 画幅 (65:24)
     */
    private fun cropToXPAN(mat: Mat): Mat {
        val width = mat.cols().toDouble()
        val height = mat.rows().toDouble()

        var cropWidth: Double
        var cropHeight: Double

        // 计算裁切区域
        if (width / height > XPAN_RATIO) {
            // 图片更宽，以高度为基准
            cropHeight = height
            cropWidth = height * XPAN_RATIO
        } else {
            // 图片更高，以宽度为基准
            cropWidth = width
            cropHeight = width / XPAN_RATIO
        }

        // 居中裁切
        val x = ((width - cropWidth) / 2).toInt()
        val y = ((height - cropHeight) / 2).toInt()

        val roi = Rect(x, y, cropWidth.toInt(), cropHeight.toInt())
        return Mat(mat, roi)
    }

    /**
     * 保存图像到相册
     */
    private fun saveImageToGallery(bitmap: Bitmap) {
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val filename = "XPAN_$timestamp.jpg"

        val contentValues = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, filename)
            put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.Images.Media.IS_PENDING, 1)
            }
        }

        val uri = contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues)

        uri?.let {
            contentResolver.openOutputStream(it).use { outputStream ->
                if (outputStream != null) {
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 95, outputStream)
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                contentValues.clear()
                contentValues.put(MediaStore.Images.Media.IS_PENDING, 0)
                contentResolver.update(it, contentValues, null, null)
            }

            Toast.makeText(this, "已保存: $filename", Toast.LENGTH_SHORT).show()
        }
    }

    private fun updateStatus(message: String) {
        binding.statusText.text = message
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }
}