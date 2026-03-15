package com.xpan.camera

import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class MainViewModel : ViewModel() {
    
    // UI 状态
    private val _statusText = MutableStateFlow("准备拍摄")
    val statusText: StateFlow<String> = _statusText.asStateFlow()
    
    private val _isProcessing = MutableStateFlow(false)
    val isProcessing: StateFlow<Boolean> = _isProcessing.asStateFlow()
    
    private val _progress = MutableStateFlow(0)
    val progress: StateFlow<Int> = _progress.asStateFlow()

    fun updateStatus(status: String) {
        _statusText.value = status
    }
    
    fun setProcessing(processing: Boolean) {
        _isProcessing.value = processing
    }
    
    fun setProgress(progress: Int) {
        _progress.value = progress
    }
}