// 文字层管理器类
class TextLayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.currentLayerId = null;
        this.nextId = 1;
        
        // 创建默认文字层
        this.addLayer('', 150, 150);
    }
    
    addLayer(text = '', x = 150, y = 150) {
        const newLayer = {
            id: this.nextId++,
            name: `文字层 ${this.layers.length + 1}`,
            text: text,
            x: x,
            y: y + (this.layers.length * 50), // 避免重叠
            fontSize: 24,
            color: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            animationType: 'none',
            visible: true,
            locked: false,
            zIndex: this.layers.length + 1
        };
        
        this.layers.push(newLayer);
        this.setCurrentLayer(newLayer.id);
        return newLayer;
    }
    
    removeLayer(layerId) {
        if (this.layers.length <= 1) return false; // 保持至少一层
        
        this.layers = this.layers.filter(layer => layer.id !== layerId);
        
        // 如果删除的是当前层，切换到第一层
        if (this.currentLayerId === layerId) {
            this.setCurrentLayer(this.layers[0].id);
        }
        
        // 重新编号图层名称
        this.layers.forEach((layer, index) => {
            layer.name = `文字层 ${index + 1}`;
            layer.zIndex = index + 1;
        });
        
        return true;
    }
    
    setCurrentLayer(layerId) {
        this.currentLayerId = layerId;
    }
    
    getCurrentLayer() {
        return this.layers.find(layer => layer.id === this.currentLayerId);
    }
    
    getLayer(layerId) {
        return this.layers.find(layer => layer.id === layerId);
    }
    
    updateCurrentLayer(properties) {
        const currentLayer = this.getCurrentLayer();
        if (currentLayer) {
            Object.assign(currentLayer, properties);
        }
    }
    
    toggleLayerVisibility(layerId) {
        const layer = this.getLayer(layerId);
        if (layer) {
            layer.visible = !layer.visible;
        }
    }
    
    toggleLayerLock(layerId) {
        const layer = this.getLayer(layerId);
        if (layer) {
            layer.locked = !layer.locked;
        }
    }
    
    getVisibleLayers() {
        return this.layers.filter(layer => layer.visible);
    }
}

class DynamicEmojiGenerator {
    constructor() {
        this.canvas = document.getElementById('previewCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.uploadedFiles = [];
        this.currentMediaIndex = 0;
        this.isPlaying = false;
        this.animationFrame = null;
        this.mediaElements = [];
        this.currentTime = 0;
        this.animationSpeed = 0.05;
        
        // 播放速度控制
        this.playbackSpeeds = [1, 1.5, 2, 3]; // 播放速度档位
        this.currentSpeedIndex = 0; // 当前速度索引
        this.switchInterval = 3000; // 基础媒体切换间隔(毫秒)
        
        // 初始化文字层管理器
        this.textLayerManager = new TextLayerManager(this);
        
        // 每层独立的动画状态
        this.layerAnimationStates = {};
        
        // 保持向后兼容的textSettings（指向当前层）
        this.textSettings = {
            get text() { return this.textLayerManager.getCurrentLayer()?.text || ''; },
            set text(value) { this.textLayerManager.updateCurrentLayer({ text: value }); },
            get x() { return this.textLayerManager.getCurrentLayer()?.x || 150; },
            set x(value) { this.textLayerManager.updateCurrentLayer({ x: value }); },
            get y() { return this.textLayerManager.getCurrentLayer()?.y || 150; },
            set y(value) { this.textLayerManager.updateCurrentLayer({ y: value }); },
            get fontSize() { return this.textLayerManager.getCurrentLayer()?.fontSize || 24; },
            set fontSize(value) { this.textLayerManager.updateCurrentLayer({ fontSize: value }); },
            get color() { return this.textLayerManager.getCurrentLayer()?.color || '#ffffff'; },
            set color(value) { this.textLayerManager.updateCurrentLayer({ color: value }); },
            get fontFamily() { return this.textLayerManager.getCurrentLayer()?.fontFamily || 'Arial, sans-serif'; },
            set fontFamily(value) { this.textLayerManager.updateCurrentLayer({ fontFamily: value }); },
            get fontWeight() { return this.textLayerManager.getCurrentLayer()?.fontWeight || 'normal'; },
            set fontWeight(value) { this.textLayerManager.updateCurrentLayer({ fontWeight: value }); },
            get animationType() { return this.textLayerManager.getCurrentLayer()?.animationType || 'none'; },
            set animationType(value) { this.textLayerManager.updateCurrentLayer({ animationType: value }); }
        };
        
        // 初始化第一层的动画状态
        this.initLayerAnimationState(1);
        
        // 预览相关状态
        this.previewState = {
            isVisible: false,
            currentElement: null,
            currentFileObj: null,
            scrollThrottleTimer: null
        };
        
        // 移动端检测和用户交互状态
        this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        this.isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        this.hasUserInteraction = false;
        
        // 视频格式兼容性检测
        this.videoFormats = this.detectVideoSupport();
        
        // 初始化动画状态 (为向后兼容保留)
        this.animationState = {
            time: 0,
            bounceOffset: 0,
            fadeOpacity: 1,
            rotateAngle: 0,
            shakeOffset: 0,
            typewriterIndex: 0
        };
        
        this.init();
    }
    
    // 检测浏览器支持的视频格式
    detectVideoSupport() {
        const video = document.createElement('video');
        const formats = {
            mp4: video.canPlayType('video/mp4'),
            webm: video.canPlayType('video/webm'),
            mov: video.canPlayType('video/quicktime'),
            avi: video.canPlayType('video/avi'),
            m4v: video.canPlayType('video/mp4')
        };
        
        console.log('浏览器视频格式支持:', formats);
        return formats;
    }
    
    init() {
        this.setupEventListeners();
        this.setupCanvas();
        this.drawPlaceholder();
        this.updatePlayButton(); // 初始化按钮显示
    }
    
    setupEventListeners() {
        // 文件上传事件
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        
        // 拖拽事件 - 只处理拖拽，不处理点击
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        
        // 文件选择事件 - 使用原生label行为
        fileInput.addEventListener('change', (e) => {
            this.hasUserInteraction = true;
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                this.processFiles(files);
                // 重置文件输入框，允许再次选择相同文件
                e.target.value = '';
            }
        });
        
        // 播放控制
        document.getElementById('playBtn').addEventListener('click', () => {
            // 标记用户交互
            this.hasUserInteraction = true;
            
            if (this.isPlaying) {
                // 如果正在播放，切换播放速度
                this.togglePlaybackSpeed();
            } else {
                // 如果未播放，开始播放
                this.play();
            }
        });
        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.hasUserInteraction = true;
            this.pause();
        });
        
        // 文字控制
        document.getElementById('textInput').addEventListener('input', () => this.updateTextSettings());
        document.getElementById('fontSize').addEventListener('input', () => this.updateTextSettings());
        document.getElementById('textColor').addEventListener('input', () => this.updateTextSettings());
        // 初始化自定义字体选择器
        this.initCustomFontSelector();
        document.getElementById('fontWeight').addEventListener('change', () => this.updateTextSettings());
        document.getElementById('animationType').addEventListener('change', () => this.updateTextSettings());
        document.getElementById('textX').addEventListener('input', () => this.updateTextSettings());
        document.getElementById('textY').addEventListener('input', () => this.updateTextSettings());
        
        // GIF设置
        document.getElementById('gifDuration').addEventListener('input', () => this.updateGifSettings());
        document.getElementById('gifQuality').addEventListener('input', () => this.updateGifSettings());
        
        // 操作按钮
        document.getElementById('generateBtn').addEventListener('click', () => {
            this.hasUserInteraction = true;
            this.generateGif();
        });
        document.getElementById('generatePngBtn').addEventListener('click', () => {
            this.hasUserInteraction = true;
            this.generatePng();
        });
        document.getElementById('downloadBtn').addEventListener('click', () => this.download());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        
        // 为文件列表添加拖拽排序事件
        this.setupDragAndDrop();
        
        // 文字层管理事件监听器
        this.setupTextLayerEventListeners();
        
        // 添加滚动监听，优化预览框位置（带节流）
        this.scrollHandler = this.throttle(() => {
            this.updatePreviewPositionOnScroll();
        }, 16); // 约60fps更新频率
        
        window.addEventListener('scroll', this.scrollHandler, { passive: true });
    }
    
    setupDragAndDrop() {
        const fileList = document.getElementById('fileList');
        
        // 创建节流版本的拖拽处理函数
        const throttledDragOver = this.throttle((e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const afterElement = this.getDragAfterElement(fileList, e.clientX, e.clientY);
            const dragging = fileList.querySelector('.dragging');
            
            if (dragging) {
                // 清除之前的拖拽指示器
                fileList.querySelectorAll('.drag-indicator').forEach(indicator => {
                    indicator.classList.remove('drag-indicator');
                });
                
                // 添加新的拖拽指示器
                if (afterElement) {
                    afterElement.classList.add('drag-indicator');
                    fileList.insertBefore(dragging, afterElement);
                } else {
                    // 拖拽到末尾
                    const lastElement = fileList.lastElementChild;
                    if (lastElement && lastElement !== dragging) {
                        lastElement.classList.add('drag-indicator');
                    }
                    fileList.appendChild(dragging);
                }
            }
        }, 16); // 约60fps的更新频率
        
        // 使用事件委托处理拖拽事件
        fileList.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('file-item')) {
                this.draggedIndex = Array.from(fileList.children).indexOf(e.target);
                e.target.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                console.log('拖拽开始，文件索引:', this.draggedIndex);
            }
        });
        
        fileList.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('file-item')) {
                e.target.classList.remove('dragging');
                
                // 清除所有拖拽指示器
                fileList.querySelectorAll('.drag-indicator').forEach(indicator => {
                    indicator.classList.remove('drag-indicator');
                });
            }
        });
        
        fileList.addEventListener('dragover', throttledDragOver);
        
        fileList.addEventListener('drop', (e) => {
            e.preventDefault();
            console.log('拖拽结束，更新文件顺序');
            
            // 清除所有拖拽指示器
            const fileList = document.getElementById('fileList');
            fileList.querySelectorAll('.drag-indicator').forEach(indicator => {
                indicator.classList.remove('drag-indicator');
            });
            
            this.updateFileOrder();
        });
    }
    
    // 网格布局的拖拽位置计算 - 使用二维坐标
    getDragAfterElement(container, x, y) {
        const draggableElements = [...container.querySelectorAll('.file-item:not(.dragging)')];
        
        if (draggableElements.length === 0) {
            return null;
        }
        
        let closestElement = null;
        let minDistance = Infinity;
        let insertBefore = false;
        
        // 找到距离鼠标位置最近的元素
        draggableElements.forEach(element => {
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            // 计算欧几里得距离
            const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
            
            if (distance < minDistance) {
                minDistance = distance;
                closestElement = element;
                
                // 判断应该插入到前面还是后面
                // 在网格中，主要看水平位置，其次看垂直位置
                if (x < centerX) {
                    insertBefore = true;
                } else if (x > centerX) {
                    insertBefore = false;
                } else {
                    // 水平位置相同时，看垂直位置
                    insertBefore = y < centerY;
                }
            }
        });
        
        // 如果应该插入到最近元素之前，返回该元素
        // 否则返回该元素的下一个兄弟元素（即插入到其后面）
        return insertBefore ? closestElement : closestElement.nextElementSibling;
    }
    
    updateFileOrder() {
        const fileList = document.getElementById('fileList');
        const items = Array.from(fileList.children);
        
        // 根据新的DOM顺序重新排序uploadedFiles数组
        const newOrder = [];
        items.forEach(item => {
            const index = parseInt(item.dataset.index);
            if (!isNaN(index) && this.uploadedFiles[index]) {
                newOrder.push(this.uploadedFiles[index]);
            }
        });
        
        this.uploadedFiles = newOrder;
        
        // 重新渲染文件列表
        this.updateFileList();
        
        // 如果正在播放，更新当前媒体索引
        if (this.isPlaying) {
            this.currentMediaIndex = Math.max(0, Math.min(this.currentMediaIndex, this.uploadedFiles.length - 1));
        }
    }
    
    // 移除单独的handleFileSelect方法，直接在setupEventListeners中处理
    
    setupTextLayerEventListeners() {
        // 添加文字层按钮
        document.getElementById('addTextLayer').addEventListener('click', () => {
            this.textLayerManager.addLayer();
            this.updateTextLayersList();
            this.updateCurrentLayerEditor();
            this.initLayerAnimationState(this.textLayerManager.currentLayerId);
        });
        
        // 更新初始化
        this.updateTextLayersList();
        this.updateCurrentLayerEditor();
    }
    
    
    updateTextLayersList() {
        const container = document.getElementById('textLayersList');
        container.innerHTML = '';
        
        this.textLayerManager.layers.forEach((layer) => {
            const layerItem = document.createElement('div');
            layerItem.className = `layer-item ${layer.id === this.textLayerManager.currentLayerId ? 'active' : ''}`;
            layerItem.dataset.layerId = layer.id;
            
            layerItem.innerHTML = `
                <div class="layer-info" onclick="generator.selectTextLayer(${layer.id})">
                    <div class="layer-name">${layer.name}</div>
                    <div class="layer-preview">${layer.text || '(空文字)'}</div>
                </div>
                <div class="layer-controls">
                    <button class="layer-control-btn visibility-btn ${layer.visible ? 'active' : ''}" 
                            onclick="generator.toggleLayerVisibility(${layer.id})" 
                            title="${layer.visible ? '隐藏' : '显示'}">
                        ${layer.visible ? '👁️' : '🙈'}
                    </button>
                    <button class="layer-control-btn lock-btn ${layer.locked ? 'active' : ''}" 
                            onclick="generator.toggleLayerLock(${layer.id})" 
                            title="${layer.locked ? '解锁' : '锁定'}">
                        ${layer.locked ? '🔒' : '🔓'}
                    </button>
                    ${this.textLayerManager.layers.length > 1 ? 
                        `<button class="layer-control-btn delete-btn" 
                                onclick="generator.deleteTextLayer(${layer.id})" 
                                title="删除">🗑️</button>` : ''}
                </div>
            `;
            
            container.appendChild(layerItem);
        });
    }
    
    selectTextLayer(layerId) {
        this.textLayerManager.setCurrentLayer(layerId);
        this.updateTextLayersList();
        this.updateCurrentLayerEditor();
    }
    
    toggleLayerVisibility(layerId) {
        this.textLayerManager.toggleLayerVisibility(layerId);
        this.updateTextLayersList();
    }
    
    toggleLayerLock(layerId) {
        this.textLayerManager.toggleLayerLock(layerId);
        this.updateTextLayersList();
    }
    
    deleteTextLayer(layerId) {
        if (this.textLayerManager.layers.length <= 1) {
            alert('至少需要保留一个文字层');
            return;
        }
        
        if (confirm('确认删除此文字层？')) {
            // 清理动画状态
            delete this.layerAnimationStates[layerId];
            
            this.textLayerManager.removeLayer(layerId);
            this.updateTextLayersList();
            this.updateCurrentLayerEditor();
        }
    }
    
    updateCurrentLayerEditor() {
        const currentLayer = this.textLayerManager.getCurrentLayer();
        if (!currentLayer) return;
        
        // 更新当前层名称显示
        document.getElementById('currentLayerName').textContent = `(${currentLayer.name})`;
        
        // 更新控制面板的值
        document.getElementById('textInput').value = currentLayer.text;
        document.getElementById('fontSize').value = currentLayer.fontSize;
        document.getElementById('fontSizeValue').textContent = currentLayer.fontSize + 'px';
        document.getElementById('textColor').value = currentLayer.color;
        document.getElementById('fontWeight').value = currentLayer.fontWeight;
        document.getElementById('animationType').value = currentLayer.animationType;
        document.getElementById('textX').value = currentLayer.x;
        document.getElementById('textY').value = currentLayer.y;
        
        // 更新字体选择器
        this.updateFontSelector(currentLayer.fontFamily);
    }
    
    
    updateFontSelector(fontFamily) {
        const fontOptions = document.querySelectorAll('.font-option');
        fontOptions.forEach(option => {
            option.classList.remove('selected');
            if (option.dataset.value === fontFamily) {
                option.classList.add('selected');
                
                // 更新显示的字体名称
                const selectedFont = document.querySelector('.selected-font');
                selectedFont.textContent = option.textContent;
                selectedFont.style.fontFamily = fontFamily;
            }
        });
    }
    
    setupCanvas() {
        this.canvas.width = 300;
        this.canvas.height = 300;
        this.ctx.fillStyle = '#f8f9fa';
        this.ctx.fillRect(0, 0, 300, 300);
    }
    
    drawPlaceholder() {
        this.ctx.fillStyle = '#f8f9fa';
        this.ctx.fillRect(0, 0, 300, 300);
        
        this.ctx.fillStyle = '#ccc';
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('上传图片或视频开始创作', 150, 150);
    }
    
    // 拖拽处理
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.add('dragover');
    }
    
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('dragover');
    }
    
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files);
        this.processFiles(files);
    }
    
    processFiles(files) {
        const validFiles = files.filter(file => {
            // 基于MIME类型的验证
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            
            // 基于文件扩展名的备用验证
            const fileName = file.name.toLowerCase();
            const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.m4v', '.3gp', '.mkv'];
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            
            const hasVideoExtension = videoExtensions.some(ext => fileName.endsWith(ext));
            const hasImageExtension = imageExtensions.some(ext => fileName.endsWith(ext));
            
            // 特殊处理MOV文件（可能被识别为video/quicktime）
            const isQuickTime = file.type === 'video/quicktime';
            
            return isImage || isVideo || hasVideoExtension || hasImageExtension || isQuickTime;
        });
        
        if (validFiles.length === 0) {
            alert('请选择有效的图片或视频文件');
            return;
        }
        
        // 检查MOV格式的兼容性
        const movFiles = validFiles.filter(file => 
            file.name.toLowerCase().endsWith('.mov') || file.type === 'video/quicktime'
        );
        
        if (movFiles.length > 0 && this.videoFormats.mov === '') {
            const fileNames = movFiles.map(f => f.name).join(', ');
            const message = this.isMobile ? 
                `检测到MOV格式文件(${fileNames})，在当前浏览器中可能无法播放。建议使用MP4格式或在Safari中打开。` :
                `检测到MOV格式文件(${fileNames})，建议转换为MP4格式以获得更好的兼容性。`;
            
            if (!confirm(`⚠️ ${message}\n\n是否继续上传？`)) {
                return;
            }
        }
        
        // 大量文件提示
        if (validFiles.length > 50) {
            if (!confirm(`⚠️ 您选择了 ${validFiles.length} 个文件，这可能会影响性能。是否继续？`)) {
                return;
            }
        }
        
        // 记录处理前是否已有文件
        const hadFilesBeforeProcessing = this.uploadedFiles.length > 0;
        
        // 按文件名排序后添加
        const sortedFiles = validFiles.sort((a, b) => a.name.localeCompare(b.name));
        sortedFiles.forEach(file => this.addFile(file));
        
        // 如果之前没有文件，现在有了文件，确保自动播放
        if (!hadFilesBeforeProcessing && this.uploadedFiles.length > 0) {
            // 使用Promise等待文件元素创建完成后自动播放
            Promise.all(
                this.uploadedFiles.map(fileObj => {
                    if (fileObj.element) {
                        return Promise.resolve();
                    }
                    // 等待元素创建
                    return new Promise(resolve => {
                        const checkElement = () => {
                            if (fileObj.element) {
                                resolve();
                            } else {
                                setTimeout(checkElement, 10);
                            }
                        };
                        checkElement();
                    });
                })
            ).then(() => {
                // 确保所有文件元素都已创建后再开始播放
                if (!this.isPlaying && this.uploadedFiles.length > 0) {
                    console.log('文件上传完成，自动开始播放');
                    this.play();
                }
            });
        }
    }
    
    addFile(file) {
        // 更智能的文件类型判断
        let fileType = 'video';
        if (file.type.startsWith('image/')) {
            fileType = 'image';
        } else if (file.type.startsWith('video/') || file.type === 'video/quicktime') {
            fileType = 'video';
        } else {
            // 基于扩展名的备用判断
            const fileName = file.name.toLowerCase();
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            fileType = imageExtensions.some(ext => fileName.endsWith(ext)) ? 'image' : 'video';
        }
        
        const fileObj = {
            file: file,
            name: file.name,
            size: this.formatFileSize(file.size),
            type: fileType,
            url: URL.createObjectURL(file),
            element: null,
            mimeType: file.type || 'unknown' // 保存原始MIME类型用于调试
        };
        
        this.uploadedFiles.push(fileObj);
        
        // 立即更新文件列表，显示加载状态
        this.updateFileList();
        
        // 创建媒体元素并等待加载
        this.createMediaElement(fileObj).then(() => {
            if (this.uploadedFiles.length === 1) {
                // 第一个文件添加后立即开始播放
                this.currentMediaIndex = 0;
                console.log('第一个文件加载完成，立即开始播放');
                this.play();
            } else {
                // 多个文件时只渲染当前状态
                this.render();
            }
        });
    }
    
    createMediaElement(fileObj) {
        return new Promise((resolve) => {
            if (fileObj.type === 'image') {
                const img = new Image();
                
                img.onload = () => {
                    fileObj.element = img;
                    
                    // 对于抽取帧，额外设置图片尺寸信息
                    if (fileObj.isExtractedFrame) {
                        fileObj.naturalWidth = img.naturalWidth;
                        fileObj.naturalHeight = img.naturalHeight;
                        fileObj.ready = true; // 标记为已就绪
                        console.log(`抽取帧加载成功: ${fileObj.name} (${img.naturalWidth}x${img.naturalHeight})`);
                    }
                    
                    // 生成缩略图
                    this.generateThumbnail(fileObj).then((thumbnail) => {
                        if (thumbnail) {
                            fileObj.thumbnail = thumbnail;
                            console.log(`图片缩略图生成完成: ${fileObj.name}`);
                        }
                        this.updateFileList(); // 更新显示
                        resolve();
                    });
                };
                
                img.onerror = (error) => {
                    console.error('图片加载失败:', fileObj.name, error);
                    fileObj.error = '加载失败';
                    this.updateFileList();
                    resolve();
                };
                
                // 对于抽取帧（DataURL），不需要跨域设置
                if (!fileObj.isExtractedFrame) {
                    img.crossOrigin = 'anonymous';
                }
                
                // 使用DataURL或文件URL
                img.src = fileObj.dataURL || fileObj.url;
            } else {
                const video = document.createElement('video');
                video.muted = true;
                video.loop = true;
                video.preload = 'auto'; // 改为自动预加载以改善移动端体验
                
                // 移动端视频播放属性
                video.playsinline = true;
                video.setAttribute('webkit-playsinline', 'webkit-playsinline');
                video.setAttribute('x5-playsinline', 'true'); // 微信浏览器
                video.setAttribute('x5-video-player-type', 'h5'); // 微信浏览器
                video.setAttribute('x5-video-player-fullscreen', 'false'); // 防止微信全屏
                video.crossOrigin = 'anonymous'; // 允许Canvas操作
                
                // 增强视频元数据处理
                video.onloadedmetadata = () => {
                    // 存储视频元数据
                    fileObj.duration = video.duration;
                    fileObj.videoWidth = video.videoWidth;
                    fileObj.videoHeight = video.videoHeight;
                    fileObj.element = video;
                    
                    console.log(`视频元数据加载成功: ${fileObj.name}`, {
                        duration: video.duration,
                        dimensions: `${video.videoWidth}x${video.videoHeight}`,
                        readyState: video.readyState,
                        networkState: video.networkState,
                        currentSrc: video.currentSrc
                    });
                    
                    this.updateFileList();
                };
                
                video.onloadeddata = () => {
                    // 视频数据加载完成，可以进行抽帧操作
                    fileObj.readyForExtraction = true;
                    
                    // 生成视频缩略图
                    this.generateVideoThumbnail(fileObj).then((thumbnail) => {
                        if (thumbnail) {
                            fileObj.thumbnail = thumbnail;
                            console.log(`视频缩略图生成完成: ${fileObj.name}`);
                        }
                        this.updateFileList();
                        
                        // 移动端优化：视频加载完成后立即尝试播放（如果当前正在播放状态）
                        if (this.isPlaying && this.uploadedFiles[this.currentMediaIndex] === fileObj) {
                            this.attemptVideoPlay(video, fileObj).then((success) => {
                                if (success) {
                                    console.log(`视频加载完成后自动播放: ${fileObj.name}`);
                                }
                            });
                        }
                        
                        resolve();
                    });
                };
                
                video.onerror = (error) => {
                    console.error('视频加载失败:', fileObj.name, error);
                    console.log('文件MIME类型:', fileObj.mimeType);
                    console.log('设备信息:', {
                        isMobile: this.isMobile,
                        isIOS: this.isIOS,
                        userAgent: navigator.userAgent
                    });
                    
                    // 移动端特定错误提示
                    if (this.isMobile) {
                        const fileName = fileObj.name.toLowerCase();
                        if (fileName.endsWith('.mov')) {
                            if (this.isIOS) {
                                fileObj.error = 'MOV格式可能需要Safari浏览器支持';
                            } else {
                                fileObj.error = 'MOV格式在此浏览器中不支持，建议转换为MP4';
                            }
                        } else if (this.isIOS) {
                            fileObj.error = '加载失败（iOS可能需要用户交互或检查视频格式）';
                        } else {
                            fileObj.error = '加载失败（请检查视频格式是否支持）';
                        }
                    } else {
                        fileObj.error = '加载失败';
                    }
                    
                    this.updateFileList();
                    resolve();
                };
                
                // 监听视频可以播放事件
                video.oncanplay = () => {
                    fileObj.canPlay = true;
                };
                
                // 添加 oncanplaythrough 事件，确保视频完全加载
                video.oncanplaythrough = () => {
                    fileObj.fullyLoaded = true;
                    console.log(`视频完全加载: ${fileObj.name}`);
                };
                
                video.src = fileObj.url;
            }
        });
    }
    
    updateFileList() {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';
        
        // 添加文件计数和排序提示
        if (this.uploadedFiles.length > 0) {
            const countItem = document.createElement('div');
            countItem.style.cssText = 'background: #e3f2fd; padding: 10px; border-radius: 8px; margin-bottom: 2px; text-align: center; font-weight: bold; color: #1976d2;';
            countItem.innerHTML = `📊 已上传 ${this.uploadedFiles.length} 个文件 | 已按文件名排序 | 可拖拽调整顺序`;
            fileList.appendChild(countItem);
        }
        
        this.uploadedFiles.forEach((fileObj, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.draggable = true;
            fileItem.dataset.index = index;
            
            let previewContent, statusText, extractBtn = '';
            
            if (fileObj.error) {
                previewContent = '<div class="thumbnail-error">❌</div>';
                statusText = fileObj.error;
            } else if (!fileObj.element) {
                previewContent = '<div class="thumbnail-loading">⏳</div>';
                statusText = '加载中...';
            } else if (fileObj.thumbnail) {
                // 显示真实缩略图
                previewContent = `<img src="${fileObj.thumbnail}" alt="缩略图" class="thumbnail-img">`;
                
                if (fileObj.type === 'image') {
                    // 如果是抽取帧，显示额外信息
                    if (fileObj.isExtractedFrame) {
                        statusText = `抽取帧 (${fileObj.frameTime?.toFixed(1)}s)`;
                        if (!fileObj.ready && !fileObj.error) {
                            statusText += ' - 加载中...';
                        } else if (fileObj.ready) {
                            statusText += ' - 就绪';
                        }
                    }
                } else {
                    // 为视频添加抽帧按钮，只有在视频数据准备好时才启用
                    const isDisabled = !fileObj.readyForExtraction ? 'disabled' : '';
                    const buttonTitle = fileObj.readyForExtraction ? '视频抽帧' : '视频加载中...';
                    extractBtn = `<button class="file-extract-btn" ${isDisabled} onclick="generator.showFrameExtractionModal(${index})" title="${buttonTitle}">抽帧</button>`;
                    
                    // 显示视频详细信息
                    if (fileObj.duration && fileObj.videoWidth && fileObj.videoHeight) {
                        statusText = `${fileObj.duration.toFixed(1)}s - ${fileObj.videoWidth}x${fileObj.videoHeight}`;
                    }
                }
            } else {
                // 回退到表情符号（缩略图生成中或失败）
                if (fileObj.type === 'image') {
                    previewContent = `<div class="thumbnail-fallback">${fileObj.isExtractedFrame ? '🎬→🖼️' : '🖼️'}</div>`;
                    if (fileObj.isExtractedFrame) {
                        statusText = `抽取帧 (${fileObj.frameTime?.toFixed(1)}s)`;
                        if (!fileObj.ready && !fileObj.error) {
                            statusText += ' - 加载中...';
                        } else if (fileObj.ready) {
                            statusText += ' - 就绪';
                        }
                    }
                } else {
                    previewContent = '<div class="thumbnail-fallback">🎬</div>';
                    const isDisabled = !fileObj.readyForExtraction ? 'disabled' : '';
                    const buttonTitle = fileObj.readyForExtraction ? '视频抽帧' : '视频加载中...';
                    extractBtn = `<button class="file-extract-btn" ${isDisabled} onclick="generator.showFrameExtractionModal(${index})" title="${buttonTitle}">抽帧</button>`;
                    
                    if (fileObj.duration && fileObj.videoWidth && fileObj.videoHeight) {
                        statusText = `${fileObj.duration.toFixed(1)}s - ${fileObj.videoWidth}x${fileObj.videoHeight}`;
                    }
                }
            }
            
            // 创建详细的tooltip信息
            const tooltipInfo = [
                `${index + 1}. ${fileObj.name}`,
                `大小: ${fileObj.size}`,
                statusText ? `状态: ${statusText}` : ''
            ].filter(info => info).join('\n');
            
            fileItem.innerHTML = `
                <div class="file-drag-handle" title="拖拽调整顺序">≡</div>
                <div class="file-preview" title="${tooltipInfo}">
                    ${previewContent}
                </div>
                <div class="file-info">
                    ${statusText ? `<div class="file-status">${statusText}</div>` : ''}
                </div>
                <div class="file-actions">
                    ${extractBtn}
                    <button class="file-remove" onclick="generator.removeFile(${index})" title="删除文件">删除</button>
                </div>
            `;
            fileList.appendChild(fileItem);
        });
    }
    
    removeFile(index) {
        URL.revokeObjectURL(this.uploadedFiles[index].url);
        this.uploadedFiles.splice(index, 1);
        
        if (this.currentMediaIndex >= this.uploadedFiles.length) {
            this.currentMediaIndex = Math.max(0, this.uploadedFiles.length - 1);
        }
        
        this.updateFileList();
        
        if (this.uploadedFiles.length === 0) {
            this.pause();
            this.drawPlaceholder();
        } else {
            this.render();
        }
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // 切换播放速度
    togglePlaybackSpeed() {
        this.currentSpeedIndex = (this.currentSpeedIndex + 1) % this.playbackSpeeds.length;
        this.updatePlayButton();
        console.log(`播放速度切换为: ${this.getCurrentPlaybackSpeed()}x`);
    }
    
    // 获取当前播放速度
    getCurrentPlaybackSpeed() {
        return this.playbackSpeeds[this.currentSpeedIndex];
    }
    
    // 更新播放按钮显示
    updatePlayButton() {
        this.updatePlayButtonStates();
    }
    
    // 同步播放和暂停按钮状态
    updatePlayButtonStates() {
        const playBtn = document.getElementById('playBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const speed = this.getCurrentPlaybackSpeed();
        
        if (this.isPlaying) {
            playBtn.innerHTML = `▶️ 播放 ${speed}x`;
            playBtn.disabled = false; // 播放时可以切换速度
            pauseBtn.disabled = false;
        } else {
            playBtn.innerHTML = `▶️ 播放 ${speed}x`;
            playBtn.disabled = false;
            pauseBtn.disabled = true; // 暂停时禁用暂停按钮
        }
        
        // 如果没有文件，禁用所有按钮
        const hasFiles = this.uploadedFiles.length > 0;
        if (!hasFiles) {
            playBtn.disabled = true;
            pauseBtn.disabled = true;
        }
    }

    play() {
        if (this.uploadedFiles.length === 0) return;
        
        // 移动端优化：信任用户交互标志，移除过度保守的检测
        if (this.isMobile && !this.hasUserInteraction) {
            console.log('移动端自动播放，标记用户交互');
            this.hasUserInteraction = true; // 标记用户交互，允许视频播放
        }
        
        // 检查文件有效性
        const validFiles = this.getValidFiles();
        if (validFiles.length === 0) {
            console.warn('没有有效的文件可以播放');
            return;
        }
        
        // 确保当前索引有效
        this.ensureValidCurrentIndex();
        
        this.isPlaying = true;
        this.updatePlayButton(); // 更新按钮显示
        
        // 统一播放逻辑：支持视频+图片混合播放
        this.startPlayback();
        this.animate();
    }
    
    // 统一的视频播放尝试方法 - 处理移动端播放限制
    attemptVideoPlay(videoElement, fileObj) {
        if (!videoElement || !fileObj || fileObj.type !== 'video') {
            return Promise.resolve();
        }
        
        return new Promise((resolve) => {
            const playPromise = videoElement.play();
            
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log(`视频播放成功: ${fileObj.name}`);
                    fileObj.pendingPlay = false;
                    resolve(true);
                }).catch((error) => {
                    console.warn(`视频播放失败: ${fileObj.name}`, error);
                    
                    // 移动端特殊处理
                    if (this.isMobile && error.name === 'NotAllowedError') {
                        console.log('移动端视频需要用户交互，标记为待播放');
                        fileObj.pendingPlay = true;
                        
                        // 如果已有用户交互，立即重试
                        if (this.hasUserInteraction) {
                            setTimeout(() => {
                                videoElement.play().catch(() => {
                                    console.log('重试播放仍失败，等待下次用户交互');
                                });
                            }, 100);
                        }
                    }
                    resolve(false);
                });
            } else {
                // 旧浏览器不返回Promise
                try {
                    videoElement.play();
                    console.log(`视频播放成功(旧浏览器): ${fileObj.name}`);
                    resolve(true);
                } catch (error) {
                    console.warn(`视频播放失败(旧浏览器): ${fileObj.name}`, error);
                    resolve(false);
                }
            }
        });
    }
    
    // 获取所有有效的文件（已加载且有element的文件）
    getValidFiles() {
        return this.uploadedFiles.filter(file => 
            file && file.element && !file.error
        );
    }
    
    // 确保当前媒体索引指向有效文件
    ensureValidCurrentIndex() {
        const validFiles = this.getValidFiles();
        if (validFiles.length === 0) return;
        
        // 如果当前索引无效，找到第一个有效文件
        const currentFile = this.uploadedFiles[this.currentMediaIndex];
        if (!currentFile || !currentFile.element || currentFile.error) {
            // 找到第一个有效文件的索引
            for (let i = 0; i < this.uploadedFiles.length; i++) {
                const file = this.uploadedFiles[i];
                if (file && file.element && !file.error) {
                    this.currentMediaIndex = i;
                    console.log(`切换到有效文件: ${file.name} (索引: ${i})`);
                    break;
                }
            }
        }
    }
    
    // 启动播放的统一处理
    startPlayback() {
        const currentFile = this.uploadedFiles[this.currentMediaIndex];
        if (!currentFile || !currentFile.element) return;
        
        // 如果是视频，使用统一的播放方法
        if (currentFile.type === 'video') {
            this.attemptVideoPlay(currentFile.element, currentFile).then((success) => {
                if (success) {
                    console.log(`开始播放: ${currentFile.name} (${currentFile.type})`);
                } else {
                    console.log(`视频播放失败，但继续渲染: ${currentFile.name}`);
                }
            });
        } else {
            // 图片和抽取帧不需要特殊处理，通过animate方法统一管理
            console.log(`开始播放: ${currentFile.name} (${currentFile.type})`);
        }
    }
    
    pause() {
        this.isPlaying = false;
        this.updatePlayButton(); // 更新按钮显示
        
        // 暂停所有视频
        this.uploadedFiles.forEach(fileObj => {
            if (fileObj.type === 'video' && fileObj.element) {
                fileObj.element.pause();
            }
        });
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        console.log('播放已暂停');
    }
    
    animate() {
        if (!this.isPlaying) return;
        
        const speedMultiplier = this.getCurrentPlaybackSpeed();
        this.currentTime += this.animationSpeed * speedMultiplier;
        this.animationState.time = this.currentTime;
        
        // 更新所有文字层的动画状态
        this.updateAllLayerAnimations(speedMultiplier);
        
        // 智能媒体切换逻辑
        if (this.uploadedFiles.length > 1) {
            const oldIndex = this.currentMediaIndex;
            this.updateCurrentMediaIndex();
            
            // 如果切换到新文件，处理播放状态
            if (oldIndex !== this.currentMediaIndex) {
                this.handleMediaSwitch(oldIndex, this.currentMediaIndex);
            }
        }
        
        this.render();
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }
    
    // 更新所有文字层的动画状态
    updateAllLayerAnimations(speedMultiplier) {
        const time = this.currentTime;
        
        this.textLayerManager.layers.forEach(layer => {
            if (!layer.visible) return;
            
            const animationState = this.getLayerAnimationState(layer.id);
            
            switch (layer.animationType) {
                case 'bounce':
                    animationState.bounceOffset = Math.sin(time * 4 * speedMultiplier) * 10;
                    break;
                    
                case 'fade':
                    animationState.fadeOpacity = (Math.sin(time * 3 * speedMultiplier) + 1) / 2;
                    break;
                    
                case 'rotate':
                    animationState.rotateAngle = time * 2 * speedMultiplier;
                    break;
                    
                case 'shake':
                    animationState.shakeOffset = Math.sin(time * 8 * speedMultiplier) * 5;
                    break;
                    
                case 'typewriter':
                    animationState.typewriterIndex = Math.floor(time * 3 * speedMultiplier) % (layer.text.length + 10);
                    break;
                    
                // 高级动画效果
                case 'slide':
                    const slideProgress = (Math.sin(time * 2 * speedMultiplier) + 1) / 2;
                    animationState.slideOffset = (slideProgress - 0.5) * 100;
                    break;
                    
                case 'zoom':
                    animationState.zoomScale = 0.8 + Math.sin(time * 4 * speedMultiplier) * 0.4;
                    break;
                    
                case 'rainbow':
                    animationState.rainbowHue = (time * 60 * speedMultiplier) % 360;
                    break;
                    
                case 'wave':
                    animationState.waveOffset = Math.sin(time * 3 * speedMultiplier) * 15;
                    animationState.waveCharOffset = Math.sin(time * 5 * speedMultiplier) * 3;
                    break;
                    
                case 'flip':
                    animationState.flipAngle = time * 4 * speedMultiplier;
                    break;
                    
                case 'elastic':
                    animationState.elasticScale = 1 + Math.sin(time * 6 * speedMultiplier) * 0.3;
                    break;
                    
                case 'glitch':
                    animationState.glitchOffset = Math.random() * 4 - 2;
                    animationState.glitchOpacity = 0.5 + Math.random() * 0.5;
                    break;
                    
                case 'orbit':
                    animationState.orbitAngle = time * 3 * speedMultiplier;
                    animationState.orbitRadius = 20;
                    break;
            }
        });
    }
    
    // 更新当前媒体索引
    updateCurrentMediaIndex() {
        const validFiles = this.getValidFiles();
        if (validFiles.length === 0) return;
        
        const switchInterval = this.getSwitchInterval();
        
        // 计算基于有效文件的索引
        const validIndex = Math.floor(this.currentTime / switchInterval) % validFiles.length;
        
        // 找到有效文件在uploadedFiles中的实际索引
        let count = 0;
        for (let i = 0; i < this.uploadedFiles.length; i++) {
            const file = this.uploadedFiles[i];
            if (file && file.element && !file.error) {
                if (count === validIndex) {
                    this.currentMediaIndex = i;
                    break;
                }
                count++;
            }
        }
    }
    
    // 获取切换间隔（根据文件类型和播放速度动态调整）
    getSwitchInterval() {
        const currentFile = this.uploadedFiles[this.currentMediaIndex];
        const speedMultiplier = this.getCurrentPlaybackSpeed();
        
        let baseInterval;
        // 对于视频，使用固定的3秒间隔
        if (currentFile && currentFile.type === 'video') {
            baseInterval = 3;
        } else {
            // 对于图片和抽取帧，使用较短的间隔以更好的动画效果
            baseInterval = 2;
        }
        
        // 根据播放速度调整间隔（速度越快，间隔越短）
        return baseInterval / speedMultiplier;
    }
    
    // 处理媒体切换
    handleMediaSwitch(oldIndex, newIndex) {
        const oldFile = this.uploadedFiles[oldIndex];
        const newFile = this.uploadedFiles[newIndex];
        
        if (!newFile || !newFile.element) return;
        
        // 暂停之前的视频
        if (oldFile && oldFile.type === 'video' && oldFile.element) {
            oldFile.element.pause();
        }
        
        // 启动新的媒体
        if (newFile.type === 'video') {
            // 使用统一的视频播放方法，移除pendingPlay机制
            this.attemptVideoPlay(newFile.element, newFile).then((success) => {
                if (success) {
                    console.log(`视频切换播放成功: ${newFile.name}`);
                } else {
                    console.log(`视频切换播放失败，但继续渲染: ${newFile.name}`);
                }
            });
        }
        
        console.log(`媒体切换: ${oldFile?.name || '未知'} → ${newFile.name} (${newFile.type})`);
    }
    
    render() {
        // 清空画布
        this.ctx.clearRect(0, 0, 300, 300);
        
        // 绘制背景
        this.drawBackground();
        
        // 绘制文字
        this.drawText();
    }
    
    drawBackground() {
        const currentFile = this.uploadedFiles[this.currentMediaIndex];
        if (!currentFile || !currentFile.element) {
            this.ctx.fillStyle = '#f8f9fa';
            this.ctx.fillRect(0, 0, 300, 300);
            return;
        }
        
        const element = currentFile.element;
        
        // 计算缩放比例以适应1:1比例
        let sourceWidth, sourceHeight;
        
        if (currentFile.type === 'image') {
            sourceWidth = element.naturalWidth;
            sourceHeight = element.naturalHeight;
        } else {
            sourceWidth = element.videoWidth;
            sourceHeight = element.videoHeight;
        }
        
        if (sourceWidth === 0 || sourceHeight === 0) return;
        
        // 计算居中裁剪
        const scale = Math.max(300 / sourceWidth, 300 / sourceHeight);
        const scaledWidth = sourceWidth * scale;
        const scaledHeight = sourceHeight * scale;
        const x = (300 - scaledWidth) / 2;
        const y = (300 - scaledHeight) / 2;
        
        this.ctx.drawImage(element, x, y, scaledWidth, scaledHeight);
    }
    
    drawText() {
        // 绘制所有可见的文字层
        const visibleLayers = this.textLayerManager.getVisibleLayers();
        
        // 按zIndex排序，确保层级顺序正确
        visibleLayers.sort((a, b) => a.zIndex - b.zIndex);
        
        visibleLayers.forEach(layer => {
            if (!layer.text || layer.locked) return;
            
            this.ctx.save();
            
            // 设置字体样式
            this.ctx.font = `${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily}`;
            this.ctx.fillStyle = layer.color;
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 2;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // 应用层级专用的动画效果
            this.applyLayerAnimation(layer);
            
            // 绘制多行文字
            this.drawMultilineTextLayer(layer, this.getDisplayTextForLayer(layer));
            
            this.ctx.restore();
        });
    }
    
    // 多行文字渲染函数 (保持向后兼容)
    drawMultilineText(text) {
        const lines = text.split('\n');
        const lineHeight = this.textSettings.fontSize * 1.3; // 行高为字体大小的1.3倍
        const totalHeight = (lines.length - 1) * lineHeight;
        const startY = this.textSettings.y - (totalHeight / 2);
        
        lines.forEach((line, index) => {
            const yPos = startY + (index * lineHeight);
            
            // 如果行为空，跳过渲染但保持位置
            if (line.trim() === '') return;
            
            // 绘制文字描边和填充
            this.ctx.strokeText(line, this.textSettings.x, yPos);
            this.ctx.fillText(line, this.textSettings.x, yPos);
        });
    }
    
    // 为特定文字层绘制多行文字
    drawMultilineTextLayer(layer, text) {
        const lines = text.split('\n');
        const lineHeight = layer.fontSize * 1.3; // 行高为字体大小的1.3倍
        const totalHeight = (lines.length - 1) * lineHeight;
        const startY = layer.y - (totalHeight / 2);
        
        lines.forEach((line, index) => {
            const yPos = startY + (index * lineHeight);
            
            // 如果行为空，跳过渲染但保持位置
            if (line.trim() === '') return;
            
            // 绘制文字描边和填充
            this.ctx.strokeText(line, layer.x, yPos);
            this.ctx.fillText(line, layer.x, yPos);
        });
    }
    
    // 获取指定层的显示文字（支持打字机动画等）
    getDisplayTextForLayer(layer) {
        if (layer.animationType === 'typewriter') {
            const animationState = this.getLayerAnimationState(layer.id);
            const index = Math.floor(animationState.typewriterIndex);
            return layer.text.substring(0, index);
        }
        return layer.text;
    }
    
    // 为指定文字层应用动画效果
    applyLayerAnimation(layer) {
        const animationState = this.getLayerAnimationState(layer.id);
        
        switch (layer.animationType) {
            case 'bounce':
                this.ctx.translate(0, animationState.bounceOffset);
                break;
            case 'fade':
                this.ctx.globalAlpha = animationState.fadeOpacity;
                break;
            case 'rotate':
                const scale = 0.8 + Math.sin(animationState.rotateAngle) * 0.2;
                this.ctx.translate(layer.x, layer.y);
                this.ctx.rotate(animationState.rotateAngle);
                this.ctx.scale(scale, scale);
                this.ctx.translate(-layer.x, -layer.y);
                break;
            case 'shake':
                this.ctx.translate(animationState.shakeOffset, 0);
                break;
            case 'slide':
                this.ctx.translate(animationState.slideOffset || 0, 0);
                break;
            case 'zoom':
                const zoomScale = animationState.zoomScale || 1;
                this.ctx.translate(layer.x, layer.y);
                this.ctx.scale(zoomScale, zoomScale);
                this.ctx.translate(-layer.x, -layer.y);
                break;
            case 'rainbow':
                const hue = animationState.rainbowHue || 0;
                this.ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
                break;
            case 'wave':
                this.ctx.translate(animationState.waveCharOffset || 0, animationState.waveOffset || 0);
                break;
            case 'flip':
                this.ctx.translate(layer.x, layer.y);
                this.ctx.scale(Math.cos(animationState.flipAngle || 0), 1);
                this.ctx.translate(-layer.x, -layer.y);
                break;
            case 'elastic':
                const elasticScale = animationState.elasticScale || 1;
                this.ctx.translate(layer.x, layer.y);
                this.ctx.scale(elasticScale, elasticScale);
                this.ctx.translate(-layer.x, -layer.y);
                break;
            case 'glitch':
                this.ctx.translate(animationState.glitchOffset || 0, 0);
                this.ctx.globalAlpha = animationState.glitchOpacity || 1;
                break;
            case 'orbit':
                const orbitX = Math.cos(animationState.orbitAngle || 0) * (animationState.orbitRadius || 20);
                const orbitY = Math.sin(animationState.orbitAngle || 0) * (animationState.orbitRadius || 20);
                this.ctx.translate(orbitX, orbitY);
                break;
        }
    }
    
    // 在指定context上绘制多行文字（用于静态GIF生成等）
    drawMultilineTextToContext(ctx, text) {
        const lines = text.split('\n');
        const lineHeight = this.textSettings.fontSize * 1.3;
        const totalHeight = (lines.length - 1) * lineHeight;
        const startY = this.textSettings.y - (totalHeight / 2);
        
        lines.forEach((line, index) => {
            const yPos = startY + (index * lineHeight);
            
            if (line.trim() === '') return;
            
            ctx.strokeText(line, this.textSettings.x, yPos);
            ctx.fillText(line, this.textSettings.x, yPos);
        });
    }
    
    // 初始化层级动画状态
    initLayerAnimationState(layerId) {
        this.layerAnimationStates[layerId] = {
            time: 0,
            bounceOffset: 0,
            fadeOpacity: 1,
            rotateAngle: 0,
            shakeOffset: 0,
            typewriterIndex: 0
        };
    }
    
    // 获取层级动画状态
    getLayerAnimationState(layerId) {
        if (!this.layerAnimationStates[layerId]) {
            this.initLayerAnimationState(layerId);
        }
        return this.layerAnimationStates[layerId];
    }
    
    applyTextAnimation() {
        const time = this.animationState.time;
        const speedMultiplier = this.getCurrentPlaybackSpeed();
        
        switch (this.textSettings.animationType) {
            case 'bounce':
                this.animationState.bounceOffset = Math.sin(time * 4 * speedMultiplier) * 10;
                this.ctx.translate(0, this.animationState.bounceOffset);
                break;
                
            case 'fade':
                this.animationState.fadeOpacity = (Math.sin(time * 3 * speedMultiplier) + 1) / 2;
                this.ctx.globalAlpha = this.animationState.fadeOpacity;
                break;
                
            case 'rotate':
                this.animationState.rotateAngle = time * 2 * speedMultiplier;
                const scale = 0.8 + Math.sin(time * 2 * speedMultiplier) * 0.2;
                this.ctx.translate(this.textSettings.x, this.textSettings.y);
                this.ctx.rotate(this.animationState.rotateAngle);
                this.ctx.scale(scale, scale);
                this.ctx.translate(-this.textSettings.x, -this.textSettings.y);
                break;
                
            case 'shake':
                this.animationState.shakeOffset = Math.sin(time * 8 * speedMultiplier) * 5;
                this.ctx.translate(this.animationState.shakeOffset, 0);
                break;
                
            case 'typewriter':
                this.animationState.typewriterIndex = Math.floor(time * 3 * speedMultiplier) % (this.textSettings.text.length + 10);
                break;
                
            // 新增高级动画效果
            case 'slide':
                const slideProgress = (Math.sin(time * 2 * speedMultiplier) + 1) / 2;
                this.ctx.translate((slideProgress - 0.5) * 100, 0);
                break;
                
            case 'zoom':
                const zoomScale = 0.8 + Math.sin(time * 4 * speedMultiplier) * 0.4;
                this.ctx.translate(this.textSettings.x, this.textSettings.y);
                this.ctx.scale(zoomScale, zoomScale);
                this.ctx.translate(-this.textSettings.x, -this.textSettings.y);
                break;
                
            case 'rainbow':
                const hue = (time * 60 * speedMultiplier) % 360;
                this.ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
                break;
                
            case 'wave':
                const waveOffset = Math.sin(time * 3 * speedMultiplier) * 15;
                this.ctx.translate(0, waveOffset);
                // 添加波浪形状的字符偏移
                const chars = this.getDisplayText().split('');
                if (chars.length > 1) {
                    this.ctx.translate(Math.sin(time * 5 * speedMultiplier) * 3, 0);
                }
                break;
                
            case 'flip':
                const flipAngle = Math.sin(time * 2 * speedMultiplier) * Math.PI;
                this.ctx.translate(this.textSettings.x, this.textSettings.y);
                this.ctx.scale(Math.cos(flipAngle), 1);
                this.ctx.translate(-this.textSettings.x, -this.textSettings.y);
                break;
                
            case 'elastic':
                const elasticX = 1 + Math.sin(time * 4 * speedMultiplier) * 0.3;
                const elasticY = 1 + Math.cos(time * 4 * speedMultiplier) * 0.2;
                this.ctx.translate(this.textSettings.x, this.textSettings.y);
                this.ctx.scale(elasticX, elasticY);
                this.ctx.translate(-this.textSettings.x, -this.textSettings.y);
                break;
                
            case 'glitch':
                if (Math.random() < 0.1) { // 10% 概率触发故障效果
                    this.ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
                    const glitchColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'];
                    this.ctx.fillStyle = glitchColors[Math.floor(Math.random() * glitchColors.length)];
                }
                break;
                
            case 'orbit':
                const orbitRadius = 20;
                const orbitX = Math.cos(time * 3 * speedMultiplier) * orbitRadius;
                const orbitY = Math.sin(time * 3 * speedMultiplier) * orbitRadius;
                this.ctx.translate(orbitX, orbitY);
                this.ctx.rotate(time * 2 * speedMultiplier);
                break;
        }
    }
    
    getDisplayText() {
        if (this.textSettings.animationType === 'typewriter') {
            const index = Math.min(this.animationState.typewriterIndex, this.textSettings.text.length);
            return this.textSettings.text.substring(0, index);
        }
        return this.textSettings.text;
    }
    
    updateTextSettings() {
        // 更新当前文字层的设置
        const currentLayer = this.textLayerManager.getCurrentLayer();
        if (currentLayer) {
            currentLayer.text = document.getElementById('textInput').value;
            currentLayer.fontSize = parseInt(document.getElementById('fontSize').value);
            currentLayer.color = document.getElementById('textColor').value;
            // 字体家族从自定义选择器获取，如果还在使用旧的select则保持兼容
            if (this.selectedFontFamily) {
                currentLayer.fontFamily = this.selectedFontFamily;
            } else {
                const fontFamilyElement = document.getElementById('fontFamily');
                if (fontFamilyElement) {
                    currentLayer.fontFamily = fontFamilyElement.value;
                }
            }
            currentLayer.fontWeight = document.getElementById('fontWeight').value;
            currentLayer.animationType = document.getElementById('animationType').value;
            currentLayer.x = parseInt(document.getElementById('textX').value);
            currentLayer.y = parseInt(document.getElementById('textY').value);
        }
        
        // 更新显示值
        document.getElementById('fontSizeValue').textContent = document.getElementById('fontSize').value + 'px';
        
        // 更新文字层列表显示
        this.updateTextLayersList();
        
        this.render();
    }
    
    // 指定质量生成GIF的辅助方法
    async generateWithQuality(quality) {
        return new Promise((resolve, reject) => {
            const duration = parseInt(document.getElementById('gifDuration').value);
            const fps = 10;
            const totalFrames = duration * fps;
            
            // 创建GIF
            const gif = new GIF({
                workers: 2,
                quality: quality,
                width: 300,
                height: 300,
                workerScript: 'js/gif.worker.js'
            });
            
            // 生成帧的异步函数
            const generateFrames = async () => {
                for (let i = 0; i < totalFrames; i++) {
                    // 更新动画时间
                    this.currentTime = (i / fps);
                    this.animationState.time = this.currentTime;
                    
                    // 更新媒体索引
                    if (this.uploadedFiles.length > 1) {
                        this.updateCurrentMediaIndex();
                    }
                    
                    // 渲染当前帧
                    this.render();
                    
                    // 添加到GIF
                    gif.addFrame(this.canvas, { delay: 100 });
                    
                    // 让浏览器有时间更新UI
                    await new Promise(resolve => setTimeout(resolve, 5));
                }
            };
            
            // 处理GIF完成事件
            gif.on('finished', (blob) => {
                resolve(blob);
            });
            
            gif.on('error', (error) => {
                reject(error);
            });
            
            // 开始生成
            generateFrames().then(() => {
                gif.render();
            }).catch(reject);
        });
    }
    
    // 更新压缩进度显示
    updateCompressionProgress(attempt, maxAttempts, currentSize = null) {
        const compressionStatus = document.getElementById('compressionStatus');
        const compressionText = document.getElementById('compressionText');
        
        compressionStatus.style.display = 'block';
        compressionStatus.className = 'compression-status';
        
        if (currentSize) {
            const sizeText = this.formatFileSize(currentSize);
            compressionText.textContent = `第${attempt}次压缩中... 当前大小: ${sizeText}`;
        } else {
            compressionText.textContent = `第${attempt}次压缩中...`;
        }
    }
    
    // 增强版压缩进度显示
    updateCompressionProgressEnhanced(stepName, currentStep, totalSteps, currentSize = null) {
        const compressionStatus = document.getElementById('compressionStatus');
        const compressionText = document.getElementById('compressionText');
        
        compressionStatus.style.display = 'block';
        compressionStatus.className = 'compression-status';
        
        const progress = Math.round((currentStep / totalSteps) * 100);
        
        if (currentSize) {
            const sizeText = this.formatFileSize(currentSize);
            const status = currentSize <= 1024 * 1024 ? '✅' : '🔄';
            compressionText.textContent = `${status} ${stepName} - ${sizeText} (${progress}%)`;
        } else {
            compressionText.textContent = `🔄 ${stepName}... (${progress}%)`;
        }
    }
    
    // 增强版压缩结果展示
    showCompressionResultEnhanced(success, originalSettings, finalSettings, finalSize, attempts, stepsUsed) {
        const compressionStatus = document.getElementById('compressionStatus');
        const compressionText = document.getElementById('compressionText');
        
        if (success) {
            compressionStatus.className = 'compression-status success';
            
            // 计算压缩详情
            const changes = [];
            if (finalSettings.quality !== originalSettings.quality) {
                changes.push(`质量:${originalSettings.quality}→${finalSettings.quality}`);
            }
            if (finalSettings.fps !== originalSettings.fps) {
                changes.push(`帧率:${originalSettings.fps}→${finalSettings.fps}fps`);
            }
            if (finalSettings.duration !== originalSettings.duration) {
                changes.push(`时长:${originalSettings.duration}→${finalSettings.duration}s`);
            }
            if (finalSettings.width !== originalSettings.width) {
                changes.push(`尺寸:${originalSettings.width}→${finalSettings.width}px`);
            }
            
            const finalSizeText = this.formatFileSize(finalSize);
            const changesText = changes.length > 0 ? ` (${changes.join(', ')})` : '';
            
            compressionText.textContent = `✅ 压缩成功！最终大小: ${finalSizeText}${changesText}`;
        } else {
            compressionStatus.className = 'compression-status error';
            compressionText.textContent = `❌ 无法压缩到1M以下，建议减少素材或时长`;
        }
        
        // 延长显示时间以便用户查看详情
        setTimeout(() => {
            compressionStatus.style.display = 'none';
        }, 5000);
    }
    
    // 显示压缩结果
    showCompressionResult(success, originalSize, finalSize, finalQuality, attempts) {
        const compressionStatus = document.getElementById('compressionStatus');
        const compressionText = document.getElementById('compressionText');
        
        if (success) {
            compressionStatus.className = 'compression-status success';
            const originalSizeText = this.formatFileSize(originalSize);
            const finalSizeText = this.formatFileSize(finalSize);
            const compressionRatio = ((originalSize - finalSize) / originalSize * 100).toFixed(1);
            
            if (attempts > 1) {
                compressionText.textContent = `✅ 压缩成功！${originalSizeText} → ${finalSizeText} (节省${compressionRatio}%)，质量: ${finalQuality}`;
            } else {
                compressionText.textContent = `✅ 文件已符合微信要求：${finalSizeText}`;
            }
        } else {
            compressionStatus.className = 'compression-status error';
            compressionText.textContent = `❌ 压缩失败，请尝试减少持续时间或素材数量`;
        }
        
        // 3秒后自动隐藏状态
        setTimeout(() => {
            compressionStatus.style.display = 'none';
        }, 3000);
    }
    
    // 参数调整辅助方法
    adjustSettings(originalSettings, adjustmentType, value) {
        const settings = { ...originalSettings };
        
        switch (adjustmentType) {
            case 'quality':
                settings.quality = value;
                break;
            case 'fps':
                settings.fps = value;
                break;
            case 'duration':
                settings.duration = Math.floor(originalSettings.duration * value);
                break;
        }
        
        return settings;
    }
    
    // 带设置的生成方法
    async generateWithSettings(settings) {
        return new Promise((resolve, reject) => {
            const totalFrames = settings.duration * settings.fps;
            
            // 创建GIF
            const gif = new GIF({
                workers: 2,
                quality: settings.quality,
                width: settings.width,
                height: settings.height,
                workerScript: 'js/gif.worker.js'
            });
            
            // 生成帧的异步函数
            const generateFrames = async () => {
                for (let i = 0; i < totalFrames; i++) {
                    // 更新动画时间
                    this.currentTime = (i / settings.fps);
                    this.animationState.time = this.currentTime;
                    
                    // 更新媒体索引
                    if (this.uploadedFiles.length > 1) {
                        this.updateCurrentMediaIndex();
                    }
                    
                    // 临时调整canvas尺寸用于渲染
                    const originalWidth = this.canvas.width;
                    const originalHeight = this.canvas.height;
                    
                    if (settings.width !== 300 || settings.height !== 300) {
                        this.canvas.width = settings.width;
                        this.canvas.height = settings.height;
                        this.ctx = this.canvas.getContext('2d');
                    }
                    
                    // 渲染当前帧
                    this.render();
                    
                    // 添加到GIF
                    gif.addFrame(this.canvas, { delay: Math.floor(1000 / settings.fps) });
                    
                    // 恢复原始canvas尺寸
                    if (settings.width !== 300 || settings.height !== 300) {
                        this.canvas.width = originalWidth;
                        this.canvas.height = originalHeight;
                        this.ctx = this.canvas.getContext('2d');
                    }
                    
                    // 让浏览器有时间更新UI
                    await new Promise(resolve => setTimeout(resolve, 3));
                }
            };
            
            // 处理GIF完成事件
            gif.on('finished', (blob) => {
                resolve({ blob, settings });
            });
            
            gif.on('error', (error) => {
                reject(error);
            });
            
            // 开始生成
            generateFrames().then(() => {
                gif.render();
            }).catch(reject);
        });
    }
    
    // 智能预估算法
    estimateOptimalSettings(baseSettings, targetSize) {
        const complexityFactor = this.uploadedFiles.length * 0.1 + 1;
        const currentEstimate = baseSettings.duration * baseSettings.fps * baseSettings.width * baseSettings.height * complexityFactor * 0.001;
        
        if (currentEstimate <= targetSize) {
            return baseSettings;
        }
        
        // 预估最优参数组合
        const ratio = targetSize / currentEstimate;
        const newSettings = { ...baseSettings };
        
        if (ratio > 0.7) {
            // 轻度压缩：仅调整质量
            newSettings.quality = Math.min(20, Math.max(1, Math.ceil(baseSettings.quality * 1.5)));
        } else if (ratio > 0.5) {
            // 中度压缩：质量+帧率
            newSettings.quality = 15;
            newSettings.fps = 8;
        } else {
            // 重度压缩：质量+帧率+时长调整（保持尺寸300×300）
            newSettings.quality = 18;
            newSettings.fps = 6;
            newSettings.duration = Math.floor(baseSettings.duration * 0.8);
        }
        
        return newSettings;
    }
    
    // 增强版智能自适应压缩算法
    async optimizeForWechatEnhanced(originalSettings) {
        const maxSize = 1024 * 1024; // 1MB
        const compressionSteps = [
            {
                type: 'quality',
                name: '质量优化',
                values: [10, 12, 15, 18, 20],
                impact: 'medium'
            },
            {
                type: 'fps',
                name: '帧率优化',
                values: [10, 8, 6],
                impact: 'high'
            },
            {
                type: 'duration',
                name: '时长优化',
                values: [1.0, 0.9, 0.8, 0.7],
                impact: 'high'
            }
        ];
        
        let currentSettings = { ...originalSettings };
        let bestResult = null;
        let totalAttempts = 0;
        
        // 智能预估起始点
        const estimatedSettings = this.estimateOptimalSettings(originalSettings, maxSize / 1024 / 1024);
        currentSettings = estimatedSettings;
        
        this.updateCompressionProgressEnhanced('预估最优参数', 0, compressionSteps.length);
        
        // 渐进式多维度压缩
        for (let stepIndex = 0; stepIndex < compressionSteps.length; stepIndex++) {
            const step = compressionSteps[stepIndex];
            this.updateCompressionProgressEnhanced(step.name, stepIndex + 1, compressionSteps.length);
            
            let stepSuccess = false;
            
            for (const value of step.values) {
                totalAttempts++;
                
                // 跳过当前值（避免重复测试）
                if ((step.type === 'quality' && value === currentSettings.quality) ||
                    (step.type === 'fps' && value === currentSettings.fps) ||
                    (step.type === 'duration' && value === 1.0 && currentSettings.duration === originalSettings.duration)) {
                    continue;
                }
                
                try {
                    const testSettings = this.adjustSettings(currentSettings, step.type, value);
                    const result = await this.generateWithSettings(testSettings);
                    
                    this.updateCompressionProgressEnhanced(
                        `${step.name}: ${this.formatFileSize(result.blob.size)}`,
                        stepIndex + 1,
                        compressionSteps.length,
                        result.blob.size
                    );
                    
                    if (result.blob.size <= maxSize) {
                        bestResult = result;
                        currentSettings = testSettings;
                        stepSuccess = true;
                        
                        // 如果已经达到目标，提前结束
                        this.showCompressionResultEnhanced(
                            true,
                            originalSettings,
                            bestResult.settings,
                            bestResult.blob.size,
                            totalAttempts,
                            stepIndex + 1
                        );
                        
                        return {
                            success: true,
                            blob: bestResult.blob,
                            settings: bestResult.settings,
                            originalSettings: originalSettings,
                            attempts: totalAttempts,
                            stepsUsed: stepIndex + 1
                        };
                    }
                    
                    // 保存当前最佳结果
                    if (!bestResult || result.blob.size < bestResult.blob.size) {
                        bestResult = result;
                        currentSettings = testSettings;
                    }
                    
                } catch (error) {
                    console.error(`压缩步骤 ${step.name} 值 ${value} 失败:`, error);
                    continue;
                }
            }
            
            // 如果当前步骤没有改善，继续下一步骤
            if (!stepSuccess && bestResult) {
                currentSettings = bestResult.settings;
            }
        }
        
        // 所有步骤完成后的最终结果
        if (bestResult) {
            const success = bestResult.blob.size <= maxSize;
            this.showCompressionResultEnhanced(
                success,
                originalSettings,
                bestResult.settings,
                bestResult.blob.size,
                totalAttempts,
                compressionSteps.length
            );
            
            return {
                success: success,
                blob: bestResult.blob,
                settings: bestResult.settings,
                originalSettings: originalSettings,
                attempts: totalAttempts,
                stepsUsed: compressionSteps.length
            };
        }
        
        // 完全失败的情况
        this.showCompressionResultEnhanced(false, originalSettings, originalSettings, 0, totalAttempts, compressionSteps.length);
        return {
            success: false,
            blob: null,
            error: '无法压缩到目标大小'
        };
    }
    
    // 旧版智能自适应压缩核心算法（保持向后兼容）
    async optimizeForWechat(originalQuality) {
        const maxSize = 1024 * 1024; // 1MB
        let currentQuality = originalQuality;
        let attempts = 0;
        const maxAttempts = 5;
        let firstBlob = null;
        
        while (attempts < maxAttempts) {
            attempts++;
            this.updateCompressionProgress(attempts, maxAttempts);
            
            try {
                const blob = await this.generateWithQuality(currentQuality);
                
                // 记录第一次生成的结果作为原始大小参考
                if (attempts === 1) {
                    firstBlob = blob;
                }
                
                this.updateCompressionProgress(attempts, maxAttempts, blob.size);
                
                // 检查是否满足大小要求
                if (blob.size <= maxSize) {
                    const originalSize = firstBlob ? firstBlob.size : blob.size;
                    this.showCompressionResult(true, originalSize, blob.size, currentQuality, attempts);
                    return {
                        success: true,
                        blob: blob,
                        finalQuality: currentQuality,
                        compressed: attempts > 1,
                        originalSize: originalSize,
                        finalSize: blob.size
                    };
                }
                
                // 如果是最后一次尝试，返回当前结果
                if (attempts >= maxAttempts) {
                    break;
                }
                
                // 智能质量调整算法
                const compressionRatio = blob.size / maxSize;
                const qualityReduction = Math.sqrt(compressionRatio);
                currentQuality = Math.min(20, Math.max(1, Math.ceil(currentQuality * qualityReduction)));
                
                // 避免质量调整过小的无效循环
                if (currentQuality >= 19) {
                    currentQuality = 20;
                    break;
                }
                
            } catch (error) {
                console.error(`压缩尝试 ${attempts} 失败:`, error);
                break;
            }
        }
        
        // 最后一次尝试使用最低质量
        try {
            const finalBlob = await this.generateWithQuality(20);
            const originalSize = firstBlob ? firstBlob.size : finalBlob.size;
            
            if (finalBlob.size <= maxSize) {
                this.showCompressionResult(true, originalSize, finalBlob.size, 20, attempts + 1);
                return {
                    success: true,
                    blob: finalBlob,
                    finalQuality: 20,
                    compressed: true,
                    originalSize: originalSize,
                    finalSize: finalBlob.size
                };
            } else {
                this.showCompressionResult(false, originalSize, finalBlob.size, 20, attempts + 1);
                return {
                    success: false,
                    blob: finalBlob,
                    finalQuality: 20,
                    compressed: true,
                    originalSize: originalSize,
                    finalSize: finalBlob.size
                };
            }
        } catch (error) {
            console.error('最终压缩尝试失败:', error);
            this.showCompressionResult(false, 0, 0, 20, attempts);
            return {
                success: false,
                blob: null,
                error: error
            };
        }
    }
    
    // 初始化自定义字体选择器
    initCustomFontSelector() {
        this.selectedFontFamily = 'Arial, sans-serif'; // 默认字体
        
        const header = document.getElementById('fontSelectorHeader');
        const dropdown = document.getElementById('fontOptionsDropdown');
        const options = dropdown.querySelectorAll('.font-option');
        
        // 点击头部切换下拉菜单
        header.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = header.classList.contains('active');
            
            if (isActive) {
                header.classList.remove('active');
                dropdown.style.display = 'none';
            } else {
                header.classList.add('active');
                dropdown.style.display = 'block';
            }
        });
        
        // 选择字体选项
        options.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const fontValue = option.dataset.value;
                const fontName = option.textContent;
                
                // 更新选中状态
                options.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                
                // 更新头部显示
                const selectedFontSpan = header.querySelector('.selected-font');
                selectedFontSpan.textContent = fontName;
                selectedFontSpan.style.fontFamily = fontValue;
                
                // 更新应用设置
                this.selectedFontFamily = fontValue;
                this.updateTextSettings();
                
                // 关闭下拉菜单
                header.classList.remove('active');
                dropdown.style.display = 'none';
            });
        });
        
        // 点击外部关闭下拉菜单
        document.addEventListener('click', (e) => {
            if (!header.contains(e.target) && !dropdown.contains(e.target)) {
                header.classList.remove('active');
                dropdown.style.display = 'none';
            }
        });
    }
    
    updateGifSettings() {
        const duration = document.getElementById('gifDuration').value;
        const quality = document.getElementById('gifQuality').value;
        
        document.getElementById('durationValue').textContent = duration + 's';
        document.getElementById('qualityValue').textContent = quality;
    }
    
    async generateGif() {
        if (this.uploadedFiles.length === 0) {
            alert('请先上传图片或视频');
            return;
        }
        
        // 检查播放状态，如果暂停则提示用户先播放
        if (!this.isPlaying) {
            this.showPlayingWarning();
            return;
        }
        
        const generateBtn = document.getElementById('generateBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const wechatOptimize = document.getElementById('wechatOptimize').checked;
        
        generateBtn.disabled = true;
        generateBtn.textContent = '生成中...';
        progressContainer.style.display = 'block';
        
        try {
            const quality = parseInt(document.getElementById('gifQuality').value);
            
            if (wechatOptimize) {
                // 使用微信优化模式（增强版）
                progressText.textContent = '正在智能优化...';
                
                const duration = parseInt(document.getElementById('gifDuration').value);
                const originalSettings = {
                    quality: quality,
                    fps: 10,
                    duration: duration,
                    width: 300,
                    height: 300
                };
                
                const result = await this.optimizeForWechatEnhanced(originalSettings);
                
                if (result.success && result.blob) {
                    const url = URL.createObjectURL(result.blob);
                    this.showResult(url, result.blob.size, result.settings);
                    
                    this.generatedGifUrl = url;
                    this.generatedGifBlob = result.blob;
                } else {
                    // 即使压缩失败，也显示结果让用户选择
                    if (result.blob) {
                        const url = URL.createObjectURL(result.blob);
                        this.showResult(url, result.blob.size);
                        
                        this.generatedGifUrl = url;
                        this.generatedGifBlob = result.blob;
                    } else {
                        throw new Error('GIF生成失败');
                    }
                }
            } else {
                // 使用标准模式（原有逻辑）
                const duration = parseInt(document.getElementById('gifDuration').value);
                const fps = 10;
                const totalFrames = duration * fps;
                
                // 创建GIF
                const gif = new GIF({
                    workers: 2,
                    quality: quality,
                    width: 300,
                    height: 300,
                    workerScript: 'js/gif.worker.js'
                });
                
                // 生成帧
                for (let i = 0; i < totalFrames; i++) {
                    const progress = (i / totalFrames) * 100;
                    progressFill.style.width = progress + '%';
                    progressText.textContent = Math.round(progress) + '%';
                    
                    // 更新动画时间
                    this.currentTime = (i / fps);
                    this.animationState.time = this.currentTime;
                    
                    // 更新媒体索引（使用统一的切换逻辑）
                    if (this.uploadedFiles.length > 1) {
                        this.updateCurrentMediaIndex();
                    }
                    
                    // 渲染当前帧
                    this.render();
                    
                    // 添加到GIF
                    gif.addFrame(this.canvas, { delay: 100 });
                    
                    // 让浏览器有时间更新UI
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                
                // 渲染GIF
                gif.on('finished', (blob) => {
                    const url = URL.createObjectURL(blob);
                    this.showResult(url, blob.size);
                    
                    generateBtn.disabled = false;
                    generateBtn.textContent = '🎬 生成 GIF';
                    downloadBtn.disabled = false;
                    progressContainer.style.display = 'none';
                    
                    this.generatedGifUrl = url;
                    this.generatedGifBlob = blob;
                });
                
                gif.render();
                return; // 标准模式直接返回，等待gif.on('finished')回调
            }
            
            // 微信优化模式完成后重置UI状态
            generateBtn.disabled = false;
            generateBtn.textContent = '🎬 生成 GIF';
            downloadBtn.disabled = false;
            progressContainer.style.display = 'none';
            
        } catch (error) {
            console.error('生成GIF时出错:', error);
            alert('生成GIF时出错，请重试');
            
            generateBtn.disabled = false;
            generateBtn.textContent = '🎬 生成 GIF';
            progressContainer.style.display = 'none';
            
            // 隐藏压缩状态
            const compressionStatus = document.getElementById('compressionStatus');
            compressionStatus.style.display = 'none';
        }
    }
    
    showResult(url, fileSize, settings = null) {
        const resultSection = document.getElementById('resultSection');
        const resultGif = document.getElementById('resultGif');
        const fileSizeSpan = document.getElementById('fileSize');
        const fileDimensions = document.getElementById('fileDimensions');
        
        resultGif.src = url;
        
        // 处理不同格式的文件大小显示
        if (typeof fileSize === 'string') {
            // PNG格式，fileSize已经是格式化的字符串（如 'PNG'）
            fileSizeSpan.textContent = this.estimatePngSize();
        } else {
            // GIF格式，fileSize是数字
            fileSizeSpan.textContent = this.formatFileSize(fileSize);
        }
        
        // 根据settings参数显示实际尺寸或默认尺寸
        if (settings && settings.width && settings.height) {
            fileDimensions.textContent = `${settings.width}×${settings.height}`;
        } else {
            fileDimensions.textContent = '300×300';
        }
        
        resultSection.style.display = 'block';
        resultSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    generatePng() {
        const dataURL = this.canvas.toDataURL('image/png', 1.0);
        
        this.generatedPngUrl = dataURL;
        this.currentFormat = 'PNG';
        
        const downloadBtn = document.getElementById('downloadBtn');
        downloadBtn.disabled = false;
        
        this.showResult(dataURL, 'PNG');
    }
    
    estimatePngSize() {
        // 估算PNG数据URL的大小
        if (this.generatedPngUrl) {
            const base64Length = this.generatedPngUrl.split(',')[1].length;
            const sizeInBytes = Math.round(base64Length * 0.75); // Base64编码膨胀系数约为4/3
            return this.formatFileSize(sizeInBytes);
        }
        return '估算中...';
    }
    
    downloadPng() {
        if (!this.generatedPngUrl) return;
        
        const link = document.createElement('a');
        link.download = 'dynamic-emoji-' + Date.now() + '.png';
        link.href = this.generatedPngUrl;
        link.click();
    }
    
    download() {
        if (this.currentFormat === 'PNG') {
            this.downloadPng();
        } else if (this.generatedGifUrl) {
            this.downloadGif();
        }
    }
    
    downloadGif() {
        if (!this.generatedGifUrl) return;
        
        const link = document.createElement('a');
        link.download = 'dynamic-emoji-' + Date.now() + '.gif';
        link.href = this.generatedGifUrl;
        link.click();
    }
    
    reset() {
        if (confirm('确定要重置所有设置吗？')) {
            // 清理上传的文件
            this.uploadedFiles.forEach(fileObj => {
                URL.revokeObjectURL(fileObj.url);
            });
            this.uploadedFiles = [];
            this.currentMediaIndex = 0;
            
            // 重置UI
            document.getElementById('fileList').innerHTML = '';
            document.getElementById('textInput').value = '';
            document.getElementById('fontSize').value = 24;
            document.getElementById('textColor').value = '#ffffff';
            // 重置自定义字体选择器
            this.selectedFontFamily = 'Arial, sans-serif';
            const fontHeader = document.getElementById('fontSelectorHeader');
            const selectedFontSpan = fontHeader.querySelector('.selected-font');
            selectedFontSpan.textContent = 'Arial';
            selectedFontSpan.style.fontFamily = 'Arial, sans-serif';
            
            // 重置选中状态
            const fontOptions = document.querySelectorAll('.font-option');
            fontOptions.forEach(opt => opt.classList.remove('selected'));
            const arialOption = document.querySelector('.font-option[data-value="Arial, sans-serif"]');
            if (arialOption) {
                arialOption.classList.add('selected');
            }
            document.getElementById('fontWeight').value = 'normal';
            document.getElementById('animationType').value = 'none';
            document.getElementById('textX').value = 200;
            document.getElementById('textY').value = 200;
            document.getElementById('gifDuration').value = 3;
            document.getElementById('gifQuality').value = 10;
            document.getElementById('wechatOptimize').checked = true;
            
            // 重置状态
            this.textSettings = {
                text: '',
                x: 200,
                y: 200,
                fontSize: 24,
                color: '#ffffff',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'normal',
                animationType: 'none'
            };
            
            this.animationState = {
                time: 0,
                bounceOffset: 0,
                fadeOpacity: 1,
                rotateAngle: 0,
                shakeOffset: 0,
                typewriterIndex: 0
            };
            
            // 隐藏结果和压缩状态
            document.getElementById('resultSection').style.display = 'none';
            document.getElementById('downloadBtn').disabled = true;
            document.getElementById('compressionStatus').style.display = 'none';
            
            // 清理生成的GIF和PNG
            if (this.generatedGifUrl) {
                URL.revokeObjectURL(this.generatedGifUrl);
                this.generatedGifUrl = null;
                this.generatedGifBlob = null;
            }
            
            this.generatedPngUrl = null;
            this.currentFormat = null;
            
            // 暂停播放并重绘
            this.pause();
            this.drawPlaceholder();
            
            // 更新显示值
            document.getElementById('fontSizeValue').textContent = '24px';
            document.getElementById('durationValue').textContent = '3s';
            document.getElementById('qualityValue').textContent = '10';
        }
    }
    
    // 显示视频抽帧模态框
    showFrameExtractionModal(fileIndex) {
        const fileObj = this.uploadedFiles[fileIndex];
        if (!fileObj || fileObj.type !== 'video' || !fileObj.element) {
            alert('无效的视频文件');
            return;
        }
        
        const modal = document.getElementById('frameExtractionModal');
        const video = fileObj.element;
        
        // 设置当前处理的视频
        this.currentExtractionFile = {
            index: fileIndex,
            fileObj: fileObj,
            video: video
        };
        
        // 重置模态框状态
        this.resetModalState();
        
        // 显示视频信息
        this.updateVideoInfo(video);
        
        // 显示模态框
        modal.style.display = 'flex';
        
        // 设置事件监听器
        this.setupModalEventListeners();
    }
    
    // 重置模态框状态
    resetModalState() {
        // 重置输入值
        document.getElementById('frameInterval').value = 1;
        document.getElementById('maxFrames').value = 20;
        document.getElementById('frameIntervalValue').textContent = '1.0s';
        document.getElementById('maxFramesValue').textContent = '20帧';
        
        // 清空预览网格
        document.getElementById('framePreviewGrid').innerHTML = '<div class="frame-preview-empty">点击"预览抽帧"查看提取的帧</div>';
        
        // 重置按钮状态
        document.getElementById('extractFramesBtn').disabled = true;
        document.getElementById('previewFramesBtn').disabled = false;
        
        // 隐藏进度条
        document.getElementById('extractionProgress').style.display = 'none';
        
        // 清理之前的预览帧
        if (this.previewFrames) {
            this.previewFrames.forEach(frame => {
                if (frame.url) URL.revokeObjectURL(frame.url);
            });
            this.previewFrames = [];
        }
    }
    
    // 更新视频信息显示
    updateVideoInfo(video) {
        const duration = video.duration || 0;
        const durationText = duration > 0 ? `${duration.toFixed(1)}秒` : '未知';
        document.getElementById('videoDuration').textContent = durationText;
        
        // 计算预计抽帧数
        this.updateEstimatedFrames();
    }
    
    // 更新预计抽帧数
    updateEstimatedFrames() {
        const video = this.currentExtractionFile?.video;
        if (!video || !video.duration) {
            document.getElementById('estimatedFrames').textContent = '-';
            return;
        }
        
        const interval = parseFloat(document.getElementById('frameInterval').value);
        const maxFrames = parseInt(document.getElementById('maxFrames').value);
        const duration = video.duration;
        
        const possibleFrames = Math.floor(duration / interval) + 1;
        const actualFrames = Math.min(possibleFrames, maxFrames);
        
        document.getElementById('estimatedFrames').textContent = `${actualFrames}帧`;
    }
    
    // 设置模态框事件监听器
    setupModalEventListeners() {
        // 避免重复绑定
        if (this.modalListenersSetup) return;
        this.modalListenersSetup = true;
        
        // 关闭模态框
        document.getElementById('closeFrameModal').addEventListener('click', () => {
            this.closeFrameExtractionModal();
        });
        
        document.getElementById('cancelExtractionBtn').addEventListener('click', () => {
            this.closeFrameExtractionModal();
        });
        
        // 点击模态框外部关闭
        document.getElementById('frameExtractionModal').addEventListener('click', (e) => {
            if (e.target.id === 'frameExtractionModal') {
                this.closeFrameExtractionModal();
            }
        });
        
        // 抽帧间隔变化
        document.getElementById('frameInterval').addEventListener('input', (e) => {
            document.getElementById('frameIntervalValue').textContent = parseFloat(e.target.value).toFixed(1) + 's';
            this.updateEstimatedFrames();
        });
        
        // 最大抽帧数变化
        document.getElementById('maxFrames').addEventListener('input', (e) => {
            document.getElementById('maxFramesValue').textContent = e.target.value + '帧';
            this.updateEstimatedFrames();
        });
        
        // 预览抽帧
        document.getElementById('previewFramesBtn').addEventListener('click', () => {
            this.previewFrameExtraction();
        });
        
        // 确认抽帧
        document.getElementById('extractFramesBtn').addEventListener('click', () => {
            this.extractFramesFromVideo();
        });
    }
    
    // 关闭抽帧模态框
    closeFrameExtractionModal() {
        const modal = document.getElementById('frameExtractionModal');
        modal.style.display = 'none';
        
        // 清理资源
        if (this.previewFrames) {
            this.previewFrames.forEach(frame => {
                if (frame.url) URL.revokeObjectURL(frame.url);
            });
            this.previewFrames = [];
        }
        
        this.currentExtractionFile = null;
    }
    
    // 预览抽帧
    async previewFrameExtraction() {
        if (!this.currentExtractionFile) return;
        
        const video = this.currentExtractionFile.video;
        const interval = parseFloat(document.getElementById('frameInterval').value);
        const maxFrames = parseInt(document.getElementById('maxFrames').value);
        
        // 验证视频状态
        if (!video.duration || video.duration === 0) {
            alert('视频未完全加载，请稍后重试');
            return;
        }
        
        // 移动端额外检查
        if (this.isMobile && video.readyState < 3) {
            const loadingMsg = this.isIOS ? 
                'iOS需要视频完全加载才能抽帧，请等待视频加载完成' : 
                '移动设备需要视频完全加载才能抽帧，请稍后重试';
            alert(loadingMsg);
            
            // 尝试加载视频数据
            video.load();
            return;
        }
        
        // 计算抽帧时间点
        const timePoints = this.calculateFrameTimePoints(video.duration, interval, maxFrames);
        
        if (timePoints.length === 0) {
            alert('无法计算抽帧时间点，请检查设置参数');
            return;
        }
        
        // 禁用相关按钮并显示进度
        const previewBtn = document.getElementById('previewFramesBtn');
        const extractBtn = document.getElementById('extractFramesBtn');
        const grid = document.getElementById('framePreviewGrid');
        
        previewBtn.disabled = true;
        previewBtn.textContent = '生成预览中...';
        extractBtn.disabled = true;
        
        // 显示处理进度
        grid.innerHTML = '<div class="frame-preview-empty">正在生成预览，请稍候...</div>';
        
        try {
            // 清理之前的预览帧
            if (this.previewFrames) {
                this.previewFrames.forEach(frame => {
                    if (frame.url) URL.revokeObjectURL(frame.url);
                });
            }
            
            this.previewFrames = [];
            
            // 逐个生成预览帧
            for (let i = 0; i < timePoints.length; i++) {
                const time = timePoints[i];
                
                // 更新进度提示
                grid.innerHTML = `<div class="frame-preview-empty">正在生成预览 ${i + 1}/${timePoints.length}...</div>`;
                
                try {
                    const canvas = await this.createCanvasFromVideoFrame(video, time);
                    const dataURL = canvas.toDataURL('image/png', 0.95);
                    
                    // 验证DataURL是否有效
                    if (!dataURL || dataURL === 'data:,') {
                        throw new Error('Canvas转换为DataURL失败');
                    }
                    
                    this.previewFrames.push({
                        time: time,
                        canvas: canvas,
                        dataURL: dataURL,
                        url: dataURL // 兼容现有显示代码
                    });
                    
                    console.log(`预览帧 ${i + 1} 创建成功: ${time}s, DataURL长度: ${dataURL.length}`);
                    
                    // 每生成几帧就更新一次显示
                    if ((i + 1) % 3 === 0 || i === timePoints.length - 1) {
                        this.updatePreviewGrid();
                    }
                    
                } catch (frameError) {
                    console.warn(`第 ${i + 1} 帧生成失败:`, frameError);
                    // 跳过失败的帧，继续处理下一帧
                }
                
                // 给UI更新的时间
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // 最终更新预览显示
            this.updatePreviewGrid();
            
            if (this.previewFrames.length > 0) {
                // 启用确认抽帧按钮
                extractBtn.disabled = false;
                console.log(`成功生成 ${this.previewFrames.length} 个预览帧`);
            } else {
                grid.innerHTML = '<div class="frame-preview-empty">预览生成失败，请重试</div>';
            }
            
        } catch (error) {
            console.error('预览抽帧失败:', error);
            grid.innerHTML = '<div class="frame-preview-empty">预览生成失败，请重试</div>';
            alert(`预览抽帧失败: ${error.message}`);
        } finally {
            // 恢复预览按钮
            previewBtn.disabled = false;
            previewBtn.textContent = '🔍 预览抽帧';
        }
    }
    
    // 计算抽帧时间点
    calculateFrameTimePoints(duration, interval, maxFrames) {
        const timePoints = [];
        let currentTime = 0;
        
        while (currentTime <= duration && timePoints.length < maxFrames) {
            timePoints.push(Math.min(currentTime, duration - 0.1)); // 避免超出视频时长
            currentTime += interval;
        }
        
        return timePoints;
    }
    
    // 从视频特定时间点创建canvas
    createCanvasFromVideoFrame(video, time) {
        return new Promise((resolve, reject) => {
            // 验证输入参数
            if (!video || !video.videoWidth || !video.videoHeight) {
                reject(new Error('无效的视频对象'));
                return;
            }
            
            if (time < 0 || time > video.duration) {
                reject(new Error(`无效的时间点: ${time}，视频时长: ${video.duration}`));
                return;
            }
            
            // 移动端特殊处理
            if (this.isMobile && !video.readyState >= 2) {
                console.warn('移动端视频未准备好，尝试加载数据');
                video.load();
            }
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 设置canvas尺寸为项目标准尺寸
            canvas.width = 300;
            canvas.height = 300;
            
            // 保存视频原始状态
            const wasPlaying = !video.paused;
            const originalTime = video.currentTime;
            
            let timeoutId;
            let seekedHandler;
            
            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                if (seekedHandler) video.removeEventListener('seeked', seekedHandler);
            };
            
            const restoreVideoState = () => {
                try {
                    video.currentTime = originalTime;
                    if (wasPlaying) {
                        video.play().catch(err => {
                            console.warn('恢复播放失败:', err);
                        });
                    }
                } catch (err) {
                    console.warn('恢复视频状态失败:', err);
                }
            };
            
            // 创建seeked事件处理器
            seekedHandler = () => {
                cleanup();
                
                try {
                    // 验证视频已跳转到正确时间（允许0.1秒误差）
                    if (Math.abs(video.currentTime - time) > 0.1) {
                        console.warn(`视频时间跳转不准确: 期望${time}s, 实际${video.currentTime}s`);
                    }
                    
                    // 计算视频在1:1画布中的缩放和位置
                    const videoWidth = video.videoWidth;
                    const videoHeight = video.videoHeight;
                    
                    // 计算居中裁剪参数
                    const scale = Math.max(300 / videoWidth, 300 / videoHeight);
                    const scaledWidth = videoWidth * scale;
                    const scaledHeight = videoHeight * scale;
                    const x = (300 - scaledWidth) / 2;
                    const y = (300 - scaledHeight) / 2;
                    
                    // 清空画布并设置背景
                    ctx.clearRect(0, 0, 300, 300);
                    ctx.fillStyle = '#f8f9fa';
                    ctx.fillRect(0, 0, 300, 300);
                    
                    // 绘制视频帧
                    try {
                        ctx.drawImage(video, x, y, scaledWidth, scaledHeight);
                    } catch (drawError) {
                        // 移动端可能的安全错误处理
                        if (this.isMobile) {
                            console.error('移动端Canvas绘制失败，可能是CORS或格式问题:', drawError);
                            reject(new Error('视频无法在Canvas中绘制，请确保视频格式兼容'));
                            return;
                        }
                        throw drawError;
                    }
                    
                    // 验证Canvas内容是否有效
                    const imageData = ctx.getImageData(0, 0, 300, 300);
                    const hasContent = imageData.data.some((value, index) => {
                        // 跳过alpha通道，检查RGB是否有非背景色数据
                        if (index % 4 === 3) return false;
                        return value !== 248 && value !== 249 && value !== 250; // 背景色#f8f9fa的RGB值
                    });
                    
                    if (!hasContent) {
                        console.warn('Canvas内容似乎为空，但继续处理');
                    }
                    
                    console.log(`成功抽取视频帧: 时间${time}s, Canvas尺寸${canvas.width}x${canvas.height}`);
                    
                    // 恢复视频状态后返回Canvas
                    restoreVideoState();
                    resolve(canvas);
                    
                } catch (error) {
                    console.error('绘制视频帧失败:', error);
                    restoreVideoState();
                    reject(error);
                }
            };
            
            // 添加超时机制
            timeoutId = setTimeout(() => {
                cleanup();
                restoreVideoState();
                reject(new Error(`视频抽帧超时: ${time}s`));
            }, 10000); // 增加到10秒超时
            
            // 监听seeked事件
            video.addEventListener('seeked', seekedHandler);
            
            try {
                // 暂停视频并跳转到指定时间
                video.pause();
                
                // 移动端可能需要额外的准备
                if (this.isMobile && video.readyState < 3) {
                    console.log('移动端视频未完全准备好，等待加载');
                    video.addEventListener('loadeddata', () => {
                        video.currentTime = time;
                    }, { once: true });
                    return;
                }
                
                // 使用更精确的时间设置
                const targetTime = Math.min(Math.max(time, 0), video.duration - 0.1);
                video.currentTime = targetTime;
                
                console.log(`开始抽帧: 跳转到${targetTime}s`);
                
            } catch (error) {
                cleanup();
                restoreVideoState();
                reject(new Error(`设置视频时间失败: ${error.message}`));
            }
        });
    }
    
    // 注：convertCanvasToImageFile方法已移除，现在直接使用DataURL
    
    // 更新预览网格显示
    updatePreviewGrid() {
        const grid = document.getElementById('framePreviewGrid');
        grid.innerHTML = '';
        
        if (!this.previewFrames || this.previewFrames.length === 0) {
            grid.innerHTML = '<div class="frame-preview-empty">暂无预览帧</div>';
            return;
        }
        
        this.previewFrames.forEach((frame, index) => {
            const item = document.createElement('div');
            item.className = 'frame-preview-item';
            
            item.innerHTML = `
                <img src="${frame.url}" alt="Frame ${index + 1}" class="frame-preview-img">
                <div class="frame-preview-info">
                    <div class="frame-preview-time">${frame.time.toFixed(1)}s</div>
                    <div>帧 ${index + 1}</div>
                </div>
            `;
            
            grid.appendChild(item);
        });
    }
    
    // 核心抽帧方法
    async extractFramesFromVideo() {
        if (!this.previewFrames || this.previewFrames.length === 0) {
            alert('请先预览抽帧');
            return;
        }
        
        const fileObj = this.currentExtractionFile.fileObj;
        const baseName = fileObj.name.replace(/\.[^/.]+$/, ''); // 移除扩展名
        
        // 显示进度
        const progressContainer = document.getElementById('extractionProgress');
        const progressFill = document.getElementById('extractionProgressFill');
        const progressText = document.getElementById('extractionProgressText');
        
        progressContainer.style.display = 'block';
        document.getElementById('extractFramesBtn').disabled = true;
        
        const extractedFrames = [];
        
        try {
            for (let i = 0; i < this.previewFrames.length; i++) {
                const frame = this.previewFrames[i];
                const progress = ((i + 1) / this.previewFrames.length) * 100;
                
                // 更新进度
                progressFill.style.width = progress + '%';
                progressText.textContent = `正在抽帧... ${Math.round(progress)}%`;
                
                // 生成文件名
                const filename = `${baseName}_frame_${String(i + 1).padStart(3, '0')}.png`;
                
                // 直接使用DataURL，无需转换为File对象
                if (frame.dataURL) {
                    extractedFrames.push({
                        filename: filename,
                        dataURL: frame.dataURL,
                        time: frame.time,
                        originalVideoIndex: this.currentExtractionFile.index,
                        canvas: frame.canvas // 保留canvas引用以备用
                    });
                    
                    console.log(`抽帧 ${i + 1} 准备完成: ${filename}, DataURL长度: ${frame.dataURL.length}`);
                } else {
                    console.warn(`第 ${i + 1} 帧DataURL无效，跳过`);
                }
                
                // 让UI有时间更新
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            // 添加抽取的帧到文件列表
            await this.addExtractedFramesToFileList(extractedFrames);
            
            // 显示成功消息
            alert(`成功抽取了 ${extractedFrames.length} 帧图片`);
            
            // 关闭模态框
            this.closeFrameExtractionModal();
            
        } catch (error) {
            console.error('抽帧失败:', error);
            alert('抽帧失败，请重试');
        } finally {
            progressContainer.style.display = 'none';
            document.getElementById('extractFramesBtn').disabled = false;
        }
    }
    
    // 将抽取的帧添加到文件列表
    async addExtractedFramesToFileList(frames) {
        const addedIndices = []; // 记录添加的文件索引
        
        for (const frameData of frames) {
            if (!frameData.dataURL || !frameData.filename) {
                console.warn('跳过无效的抽取帧', frameData);
                continue;
            }
            
            // 估算DataURL对应的文件大小（Base64编码大约是原始大小的4/3）
            const estimatedSize = Math.round((frameData.dataURL.length - 22) * 0.75); // 减去data:image/png;base64,前缀
            
            // 创建文件对象，标记为抽取帧
            const fileObj = {
                name: frameData.filename,
                size: this.formatFileSize(estimatedSize),
                type: 'image',
                dataURL: frameData.dataURL, // 直接使用DataURL
                url: frameData.dataURL, // 兼容性URL
                element: null,
                isExtractedFrame: true, // 标记为抽取帧
                extractedFrom: frameData.originalVideoIndex, // 原视频索引
                frameTime: frameData.time, // 抽取时间点
                ready: false // 加载状态标记
            };
            
            // 添加到文件列表
            const newIndex = this.uploadedFiles.length;
            this.uploadedFiles.push(fileObj);
            addedIndices.push(newIndex);
            
            console.log(`添加抽取帧到列表: ${frameData.filename} (索引: ${newIndex}, DataURL长度: ${frameData.dataURL.length})`);
            
            try {
                // 创建图片元素
                await this.createMediaElement(fileObj);
                console.log(`抽取帧准备完成: ${frameData.filename}`);
            } catch (error) {
                console.error(`抽取帧创建失败: ${frameData.filename}`, error);
                fileObj.error = '创建失败';
            }
        }
        
        // 更新文件列表显示
        this.updateFileList();
        
        // 如果添加了文件，更新当前显示和播放状态
        if (addedIndices.length > 0) {
            // 如果这是第一批文件，从第一个开始播放
            if (this.uploadedFiles.length === frames.length) {
                this.currentMediaIndex = 0;
                this.currentTime = 0; // 重置时间
                this.play();
            } else {
                // 如果已有文件在播放，继续当前播放状态
                if (this.isPlaying) {
                    // 重新渲染以包含新的抽取帧
                    this.render();
                } else {
                    // 如果没在播放，渲染当前帧
                    this.render();
                }
            }
            
            console.log(`成功添加 ${addedIndices.length} 个抽取帧到文件列表，当前总文件数: ${this.uploadedFiles.length}`);
        }
    }

    // ======================== 工具方法 ========================
    
    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        return function (...args) {
            const currentTime = Date.now();
            
            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    }
    
    updatePreviewPositionOnScroll() {
        try {
            if (!this.previewState?.isVisible || !this.previewState?.currentElement) {
                return;
            }
            
            const previewContainer = document.getElementById('filePreview');
            if (!previewContainer || previewContainer.style.display !== 'block') {
                return;
            }
            
            // 检查元素是否仍在DOM中
            if (!document.contains(this.previewState.currentElement)) {
                this.hideFilePreview();
                return;
            }
            
            // 重新计算位置
            const mockEvent = {
                target: this.previewState.currentElement
            };
            this.positionAndShowPreview(previewContainer, mockEvent);
            
        } catch (error) {
            console.error('滚动时更新预览位置失败:', error);
            this.hideFilePreview();
        }
    }
    
    // 检查位置是否在当前视窗内完全可见（使用视窗坐标系）
    isPositionVisible(left, top, width, height) {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // 视窗边界（纯视窗坐标系，不添加滚动偏移）
        const viewportLeft = 0;
        const viewportTop = 0;
        const viewportRight = viewportWidth;
        const viewportBottom = viewportHeight;
        
        // 计算预览框的边界
        const previewLeft = left;
        const previewTop = top;
        const previewRight = left + width;
        const previewBottom = top + height;
        
        // 检查预览框是否完全在当前视窗内
        const isInViewport = (
            previewLeft >= viewportLeft &&
            previewTop >= viewportTop &&
            previewRight <= viewportRight &&
            previewBottom <= viewportBottom
        );
        
        console.log(`[可见性检查] 预览框边界: (${previewLeft}, ${previewTop}, ${previewRight}, ${previewBottom})`);
        console.log(`[可见性检查] 视窗边界: (${viewportLeft}, ${viewportTop}, ${viewportRight}, ${viewportBottom})`);
        console.log(`[可见性检查] 完全可见: ${isInViewport}`);
        
        // 额外的安全边距检查（至少保留5px边距）
        const safeMargin = 5;
        const isSafelyVisible = (
            previewLeft >= viewportLeft + safeMargin &&
            previewTop >= viewportTop + safeMargin &&
            previewRight <= viewportRight - safeMargin &&
            previewBottom <= viewportBottom - safeMargin
        );
        
        console.log(`[可见性检查] 安全可见(含5px边距): ${isSafelyVisible}`);
        
        return isSafelyVisible;
    }
    
    // 计算最优预览位置（使用视窗坐标系）
    calculateOptimalPosition(targetRect) {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        const containerWidth = 200;
        const containerHeight = 200;
        const margin = 10;
        
        console.log(`[位置计算] 目标元素(视窗坐标): (${targetRect.left}, ${targetRect.top}, ${targetRect.right}, ${targetRect.bottom})`);
        console.log(`[位置计算] 视窗尺寸: ${viewportWidth}x${viewportHeight}`);
        
        // 计算元素在视窗中的相对位置，用于智能选择策略
        const elementCenterY = targetRect.top + targetRect.height / 2;
        const viewportCenterY = viewportHeight / 2;
        const isInLowerHalf = elementCenterY > viewportCenterY;
        
        console.log(`[位置计算] 元素位置分析: 中心Y=${elementCenterY}, 视窗中心Y=${viewportCenterY}, 在下半部分=${isInLowerHalf}`);
        
        // 根据元素位置动态调整策略优先级
        let strategies;
        if (isInLowerHalf) {
            // 元素在下半部分，优先使用上方位置
            console.log(`[位置计算] 使用下半部分优化策略（优先上方）`);
            strategies = [
                {
                    name: '上方',
                    calculate: () => ({
                        left: targetRect.left,
                        top: targetRect.top - containerHeight - margin
                    })
                },
                {
                    name: '右上角',
                    calculate: () => ({
                        left: targetRect.right + margin,
                        top: targetRect.top - containerHeight - margin
                    })
                },
                {
                    name: '左上角',
                    calculate: () => ({
                        left: targetRect.left - containerWidth - margin,
                        top: targetRect.top - containerHeight - margin
                    })
                },
                {
                    name: '右侧',
                    calculate: () => ({
                        left: targetRect.right + margin,
                        top: targetRect.top
                    })
                },
                {
                    name: '左侧',
                    calculate: () => ({
                        left: targetRect.left - containerWidth - margin,
                        top: targetRect.top
                    })
                },
                {
                    name: '居中',
                    calculate: () => ({
                        left: (viewportWidth - containerWidth) / 2,
                        top: (viewportHeight - containerHeight) / 2
                    })
                }
            ];
        } else {
            // 元素在上半部分，使用常规策略
            console.log(`[位置计算] 使用上半部分常规策略`);
            strategies = [
                {
                    name: '右侧',
                    calculate: () => ({
                        left: targetRect.right + margin,
                        top: targetRect.top
                    })
                },
                {
                    name: '左侧',
                    calculate: () => ({
                        left: targetRect.left - containerWidth - margin,
                        top: targetRect.top
                    })
                },
                {
                    name: '下方',
                    calculate: () => ({
                        left: targetRect.left,
                        top: targetRect.bottom + margin
                    })
                },
                {
                    name: '上方',
                    calculate: () => ({
                        left: targetRect.left,
                        top: targetRect.top - containerHeight - margin
                    })
                },
                {
                    name: '右上角',
                    calculate: () => ({
                        left: targetRect.right + margin,
                        top: targetRect.top - containerHeight - margin
                    })
                },
                {
                    name: '左上角',
                    calculate: () => ({
                        left: targetRect.left - containerWidth - margin,
                        top: targetRect.top - containerHeight - margin
                    })
                },
                {
                    name: '居中',
                    calculate: () => ({
                        left: (viewportWidth - containerWidth) / 2,
                        top: (viewportHeight - containerHeight) / 2
                    })
                }
            ];
        }
        
        // 测试每个策略，选择第一个可见的位置
        for (const strategy of strategies) {
            const position = strategy.calculate();
            console.log(`[位置计算] 测试策略: ${strategy.name} => (${position.left}, ${position.top})`);
            
            if (this.isPositionVisible(position.left, position.top, containerWidth, containerHeight)) {
                console.log(`[位置计算] 选择策略: ${strategy.name}`);
                return {
                    left: position.left,
                    top: position.top,
                    strategy: strategy.name
                };
            }
        }
        
        // 如果没有完全可见的位置，使用智能后备策略
        console.log(`[位置计算] 所有策略都不可见，使用智能后备策略`);
        
        // 强制居中，但确保不会超出视窗边界
        const safeMargin = 10;
        const centeredLeft = Math.max(
            safeMargin,
            Math.min(
                (viewportWidth - containerWidth) / 2,
                viewportWidth - containerWidth - safeMargin
            )
        );
        const centeredTop = Math.max(
            safeMargin,
            Math.min(
                (viewportHeight - containerHeight) / 2,
                viewportHeight - containerHeight - safeMargin
            )
        );
        
        console.log(`[位置计算] 智能后备位置: (${centeredLeft}, ${centeredTop})`);
        
        return {
            left: centeredLeft,
            top: centeredTop,
            strategy: '智能居中(后备)'
        };
    }

    // 缩略图预览相关方法已移除，现在直接通过缩略图查看文件内容
    
    // 清理所有资源（用于页面卸载时）
    cleanup() {
        try {
            console.log(`[预览调试] 开始显示预览 - 文件: ${fileObj?.name}, 类型: ${fileObj?.type}, 索引: ${fileObj?.index || 'unknown'}`);
            
            const previewContainer = document.getElementById('filePreview');
            const previewImage = document.getElementById('previewImage');
            
            if (!previewContainer || !previewImage || !fileObj || !event?.target) {
                console.log(`[预览调试] 预检查失败 - 容器: ${!!previewContainer}, 图片: ${!!previewImage}, 文件: ${!!fileObj}, 事件: ${!!event?.target}`);
                return;
            }
            
            // 记录触发元素信息
            const rect = event.target.getBoundingClientRect();
            console.log(`[预览调试] 触发元素位置: left=${rect.left}, top=${rect.top}, right=${rect.right}, bottom=${rect.bottom}`);
            
            // 只为图片显示预览
            if (fileObj.type === 'image') {
                console.log(`[预览调试] 图片文件确认 - 是否抽取帧: ${fileObj.isExtractedFrame}`);
                
                // 先隐藏之前的预览
                if (this.previewState.isVisible) {
                    console.log(`[预览调试] 隐藏之前的预览`);
                    this.hideFilePreview();
                }
                
                // 更新预览状态
                this.previewState.isVisible = true;
                this.previewState.currentElement = event.target;
                this.previewState.currentFileObj = fileObj;
                
                // 设置图片源
                const imageSrc = fileObj.isExtractedFrame ? 
                    (fileObj.dataURL || fileObj.url) : fileObj.url;
                
                console.log(`[预览调试] 图片源: ${imageSrc ? '有效' : '无效'}, 长度: ${imageSrc?.length || 0}`);
                
                if (!imageSrc) {
                    console.warn('图片源为空，无法显示预览');
                    return;
                }
                
                // 预加载图片以确保显示正常
                const tempImg = new Image();
                tempImg.onload = () => {
                    console.log(`[预览调试] 图片预加载成功 - 尺寸: ${tempImg.width}x${tempImg.height}`);
                    previewImage.src = imageSrc;
                    this.positionAndShowPreview(previewContainer, event);
                };
                tempImg.onerror = () => {
                    console.warn('[预览调试] 图片加载失败:', imageSrc.substring(0, 100) + '...');
                    this.hideFilePreview();
                };
                tempImg.src = imageSrc;
            } else {
                console.log(`[预览调试] 非图片文件，跳过预览 - 类型: ${fileObj.type}`);
            }
        } catch (error) {
            console.error('[预览调试] 显示文件预览失败:', error);
            this.hideFilePreview();
        }
    }
    
    positionAndShowPreview(container, event) {
        try {
            console.log(`[位置调试] 开始计算预览框位置`);
            
            if (!container || !event?.target) {
                console.log(`[位置调试] 参数检查失败 - 容器: ${!!container}, 事件: ${!!event?.target}`);
                return;
            }
            
            const rect = event.target.getBoundingClientRect();
            console.log(`[位置调试] 目标元素边界: left=${rect.left}, top=${rect.top}, right=${rect.right}, bottom=${rect.bottom}, width=${rect.width}, height=${rect.height}`);
            
            // 添加坐标系统验证信息
            const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
            const scrollY = window.pageYOffset || document.documentElement.scrollTop;
            console.log(`[坐标验证] 当前滚动位置: scrollX=${scrollX}, scrollY=${scrollY}`);
            console.log(`[坐标验证] 视窗尺寸: width=${window.innerWidth}, height=${window.innerHeight}`);
            console.log(`[坐标验证] getBoundingClientRect返回视窗坐标，无需添加滚动偏移`);
            
            // 检查元素是否在视窗内
            if (rect.width === 0 || rect.height === 0) {
                console.log(`[位置调试] 元素尺寸无效，跳过`);
                return;
            }
            
            // 使用新的智能位置计算
            const optimalPosition = this.calculateOptimalPosition(rect);
            console.log(`[位置调试] 智能位置计算结果: (${optimalPosition.left}, ${optimalPosition.top}) 策略: ${optimalPosition.strategy}`);
            
            // 应用位置
            const finalLeft = Math.round(optimalPosition.left);
            const finalTop = Math.round(optimalPosition.top);
            container.style.left = finalLeft + 'px';
            container.style.top = finalTop + 'px';
            container.style.display = 'block';
            
            console.log(`[位置调试] 最终位置应用: left=${finalLeft}px, top=${finalTop}px, display=block`);
            
            // 验证最终位置的可见性
            const isActuallyVisible = this.isPositionVisible(finalLeft, finalTop, 200, 200);
            console.log(`[位置调试] 最终位置可见性验证: ${isActuallyVisible}`);
            
        } catch (error) {
            console.error('[位置调试] 定位预览框失败:', error);
        }
    }
    
    hideFilePreview() {
        try {
            const previewContainer = document.getElementById('filePreview');
            const previewImage = document.getElementById('previewImage');
            
            if (previewContainer) {
                previewContainer.style.display = 'none';
            }
            
            // 清理图片源，释放内存
            if (previewImage) {
                previewImage.src = '';
            }
            
            // 清理预览状态
            this.previewState.isVisible = false;
            this.previewState.currentElement = null;
            this.previewState.currentFileObj = null;
            
        } catch (error) {
            console.error('隐藏预览失败:', error);
        }
    }
    
    // 清理所有资源（用于页面卸载时）
    cleanup() {
        
        // 清理媒体资源
        this.uploadedFiles.forEach(fileObj => {
            if (fileObj.url && fileObj.url.startsWith('blob:')) {
                URL.revokeObjectURL(fileObj.url);
            }
        });
    }
    
    // 显示需要播放的警告对话框
    showPlayingWarning() {
        const result = confirm('预览区域当前处于暂停状态，只能生成静态GIF图片。\n\n请先点击播放按钮开始预览，然后再生成动态GIF。\n\n点击"确定"开始播放，点击"取消"继续生成静态GIF。');
        
        if (result) {
            // 用户选择开始播放
            this.play();
        } else {
            // 用户选择继续生成静态GIF，直接调用generateGif但跳过播放检查
            this.generateStaticGif();
        }
    }
    
    // 生成静态GIF（跳过播放状态检查）
    async generateStaticGif() {
        if (this.uploadedFiles.length === 0) {
            alert('请先上传图片或视频');
            return;
        }
        
        const generateBtn = document.getElementById('generateBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const wechatOptimize = document.getElementById('wechatOptimize').checked;
        
        generateBtn.disabled = true;
        generateBtn.textContent = '生成中...';
        progressContainer.style.display = 'block';
        
        try {
            const quality = parseInt(document.getElementById('gifQuality').value);
            const duration = parseFloat(document.getElementById('gifDuration').value);
            
            // 使用当前状态生成静态帧
            const frames = [];
            const canvas = document.createElement('canvas');
            canvas.width = 300;
            canvas.height = 300;
            const ctx = canvas.getContext('2d');
            
            // 只生成一帧静态图像 - 手动渲染到指定canvas
            this.renderCurrentFrameToCanvas(ctx);
            const imageData = ctx.getImageData(0, 0, 300, 300);
            frames.push(imageData);
            
            progressText.textContent = '正在生成静态GIF...';
            progressFill.style.width = '50%';
            
            const originalSettings = {
                quality: quality,
                fps: 10,
                duration: duration,
                width: 300,
                height: 300
            };
            
            const gifBlob = await this.createGifFromFrames(frames, originalSettings, wechatOptimize, (progress) => {
                const percentage = 50 + (progress * 50);
                progressFill.style.width = percentage + '%';
                progressText.textContent = `生成进度: ${Math.round(percentage)}%`;
            });
            
            this.displayResult(gifBlob, originalSettings);
            
        } catch (error) {
            console.error('生成静态GIF时出错:', error);
            alert('生成失败，请重试');
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = '生成GIF';
            progressContainer.style.display = 'none';
        }
    }
    
    // 将当前帧渲染到指定的canvas上下文
    renderCurrentFrameToCanvas(targetCtx) {
        const currentFile = this.uploadedFiles[this.currentMediaIndex];
        if (!currentFile || !currentFile.element) {
            // 如果没有文件，绘制占位符
            targetCtx.fillStyle = '#f8f9fa';
            targetCtx.fillRect(0, 0, 300, 300);
            return;
        }
        
        // 清空画布
        targetCtx.clearRect(0, 0, 300, 300);
        
        // 绘制背景媒体
        const element = currentFile.element;
        let sourceWidth, sourceHeight;
        
        if (currentFile.type === 'image' || currentFile.type === 'extracted_frame') {
            sourceWidth = element.naturalWidth;
            sourceHeight = element.naturalHeight;
        } else {
            sourceWidth = element.videoWidth;
            sourceHeight = element.videoHeight;
        }
        
        if (sourceWidth === 0 || sourceHeight === 0) return;
        
        // 计算缩放和定位参数（1:1比例居中裁剪）
        const scale = Math.max(300 / sourceWidth, 300 / sourceHeight);
        const scaledWidth = sourceWidth * scale;
        const scaledHeight = sourceHeight * scale;
        const x = (300 - scaledWidth) / 2;
        const y = (300 - scaledHeight) / 2;
        
        // 绘制媒体元素
        targetCtx.drawImage(element, x, y, scaledWidth, scaledHeight);
        
        // 绘制文字（如果有）
        if (this.textSettings.text) {
            targetCtx.save();
            
            // 设置文字样式
            targetCtx.font = `${this.textSettings.fontWeight} ${this.textSettings.fontSize}px ${this.textSettings.fontFamily}`;
            targetCtx.fillStyle = this.textSettings.color;
            targetCtx.strokeStyle = '#000000';
            targetCtx.lineWidth = 2;
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = 'middle';
            
            // 绘制多行文字（描边+填充）
            this.drawMultilineTextToContext(targetCtx, this.textSettings.text);
            
            targetCtx.restore();
        }
    }
    
    // 生成80x80像素的文件缩略图
    generateThumbnail(fileObj) {
        return new Promise((resolve) => {
            try {
                if (!fileObj || !fileObj.element) {
                    resolve(null);
                    return;
                }
                
                // 创建80x80的缩略图Canvas
                const thumbnailCanvas = document.createElement('canvas');
                thumbnailCanvas.width = 80;
                thumbnailCanvas.height = 80;
                const ctx = thumbnailCanvas.getContext('2d');
                
                // 设置背景色
                ctx.fillStyle = '#f8f9fa';
                ctx.fillRect(0, 0, 80, 80);
                
                const element = fileObj.element;
                let sourceWidth, sourceHeight;
                
                // 根据文件类型获取尺寸
                if (fileObj.type === 'image' || fileObj.type === 'extracted_frame') {
                    sourceWidth = element.naturalWidth || element.width;
                    sourceHeight = element.naturalHeight || element.height;
                } else if (fileObj.type === 'video') {
                    sourceWidth = element.videoWidth;
                    sourceHeight = element.videoHeight;
                }
                
                if (!sourceWidth || !sourceHeight || sourceWidth === 0 || sourceHeight === 0) {
                    console.warn('无法获取文件尺寸，使用占位符');
                    // 绘制占位符
                    ctx.fillStyle = '#dee2e6';
                    ctx.fillRect(15, 15, 50, 50);
                    ctx.fillStyle = '#6c757d';
                    ctx.font = '24px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(fileObj.type === 'video' ? '🎬' : '🖼️', 40, 45);
                    
                    const thumbnailDataURL = thumbnailCanvas.toDataURL('image/png', 0.8);
                    resolve(thumbnailDataURL);
                    return;
                }
                
                // 计算1:1比例居中裁剪参数
                const scale = Math.max(80 / sourceWidth, 80 / sourceHeight);
                const scaledWidth = sourceWidth * scale;
                const scaledHeight = sourceHeight * scale;
                const x = (80 - scaledWidth) / 2;
                const y = (80 - scaledHeight) / 2;
                
                // 绘制媒体内容
                try {
                    ctx.drawImage(element, x, y, scaledWidth, scaledHeight);
                    
                    // 为视频添加播放标识
                    if (fileObj.type === 'video') {
                        ctx.save();
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                        ctx.beginPath();
                        ctx.arc(40, 40, 16, 0, Math.PI * 2);
                        ctx.fill();
                        
                        ctx.fillStyle = 'white';
                        ctx.beginPath();
                        ctx.moveTo(33, 28);
                        ctx.lineTo(33, 52);
                        ctx.lineTo(50, 40);
                        ctx.closePath();
                        ctx.fill();
                        ctx.restore();
                    }
                    
                    // 转换为DataURL
                    const quality = fileObj.type === 'video' ? 0.9 : 0.8;
                    const format = fileObj.type === 'video' ? 'image/jpeg' : 'image/png';
                    const thumbnailDataURL = thumbnailCanvas.toDataURL(format, quality);
                    
                    console.log(`缩略图生成成功: ${fileObj.name} (${thumbnailDataURL.length} bytes)`);
                    resolve(thumbnailDataURL);
                    
                } catch (drawError) {
                    console.warn('缩略图绘制失败，使用占位符:', drawError);
                    // 绘制错误占位符
                    ctx.clearRect(0, 0, 80, 80);
                    ctx.fillStyle = '#f8d7da';
                    ctx.fillRect(0, 0, 80, 80);
                    ctx.fillStyle = '#721c24';
                    ctx.font = '32px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('❌', 40, 50);
                    
                    const thumbnailDataURL = thumbnailCanvas.toDataURL('image/png', 0.8);
                    resolve(thumbnailDataURL);
                }
                
            } catch (error) {
                console.error('缩略图生成失败:', error);
                resolve(null);
            }
        });
    }
    
    // 为视频文件生成首帧缩略图
    generateVideoThumbnail(fileObj) {
        return new Promise((resolve) => {
            if (!fileObj || fileObj.type !== 'video' || !fileObj.element) {
                resolve(null);
                return;
            }
            
            const video = fileObj.element;
            const originalTime = video.currentTime;
            const wasPlaying = !video.paused;
            
            // 暂停视频并跳转到0.5秒处抽取帧
            video.pause();
            
            const seekToFrame = () => {
                const targetTime = Math.min(0.5, video.duration * 0.1); // 0.5秒或10%处
                video.currentTime = targetTime;
            };
            
            const onSeeked = () => {
                video.removeEventListener('seeked', onSeeked);
                
                // 生成缩略图
                this.generateThumbnail(fileObj).then((thumbnail) => {
                    // 恢复视频状态
                    video.currentTime = originalTime;
                    if (wasPlaying) {
                        video.play().catch(() => {
                            // 播放恢复失败，忽略错误
                        });
                    }
                    resolve(thumbnail);
                });
            };
            
            video.addEventListener('seeked', onSeeked);
            
            // 设置超时保护
            setTimeout(() => {
                video.removeEventListener('seeked', onSeeked);
                // 使用当前帧生成缩略图
                this.generateThumbnail(fileObj).then(resolve);
            }, 2000);
            
            seekToFrame();
        });
    }
}

// 初始化应用 - 防止重复初始化
let generator;
if (!window.generatorInitialized) {
    document.addEventListener('DOMContentLoaded', () => {
        generator = new DynamicEmojiGenerator();
        window.generatorInitialized = true;
        console.log('✅ 动态表情包生成器已初始化');
        
        // 页面卸载时清理资源
        window.addEventListener('beforeunload', () => {
            if (generator) {
                generator.cleanup();
            }
        });
        
        // 页面隐藏时隐藏预览
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && generator) {
                generator.hideFilePreview();
            }
        });
    });
}