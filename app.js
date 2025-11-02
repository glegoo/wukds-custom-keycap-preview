// 键帽配色预览工具核心逻辑

class KeycapPreview {
    constructor() {
        this.canvas = document.getElementById('previewCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.originalImageData = null;
        this.currentColors = { ...CONFIG.originalColors };
        this.colorInputs = {};
        this.updateTimer = null;
        
        // 色卡相关
        this.colorCardCanvases = {
            card1: document.getElementById('colorCard1'),
            card2: document.getElementById('colorCard2')
        };
        this.colorCardContexts = {
            card1: this.colorCardCanvases.card1.getContext('2d'),
            card2: this.colorCardCanvases.card2.getContext('2d')
        };
        this.colorCardImages = {
            card1: null,
            card2: null
        };
        this.currentSelectingLetter = null;
        this.selectedColorInfo = {
            number: null,
            color: null
        };
        
        // 存储颜色编号（用于保存方案）
        this.colorNumbers = {
            A: null,
            B: null,
            C: null,
            D: null,
            E: null,
            F: null
        };
        
        // 图层相关（用于精确颜色替换）
        this.layerImages = {
            A: null,
            B: null,
            C: null,
            D: null,
            E: null,
            F: null
        };
        this.layerImageData = {
            A: null,
            B: null,
            C: null,
            D: null,
            E: null,
            F: null
        };
        
        // 背景图层相关
        this.bgLayerImages = {
            B: null,
            C: null,
            D: null,
            E: null,
            F: null
        };
        this.bgLayerImageData = {
            B: null,
            C: null,
            D: null,
            E: null,
            F: null
        };
        
        this.init();
    }

    // 初始化
    async init() {
        // 初始化颜色输入框
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(letter => {
            const input = document.getElementById(`color${letter}`);
            this.colorInputs[letter] = input;
            input.value = CONFIG.originalColors[letter];
            input.addEventListener('input', () => this.onColorChange(letter));
        });

        // 初始化方案管理功能
        this.initSchemeManager();

        // 初始化操作按钮
        document.getElementById('resetBtn').addEventListener('click', () => this.resetColors());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportImage());
        document.getElementById('generateNoteBtn').addEventListener('click', () => this.openNoteModal());

        // 初始化色卡选择器
        this.initColorCardPicker();

        // 初始化备注生成功能
        this.initNoteGenerator();

        // 加载图片
        await this.loadImage();
        
        // 加载图层图片（必须在原始图片加载之后，需要知道Canvas尺寸）
        await this.loadLayers();
        
        // 加载背景图层图片
        await this.loadBgLayers();
        
        // 加载色卡图片
        await this.loadColorCards();
    }

    // 加载图片
    async loadImage() {
        const loading = document.getElementById('loading');
        loading.classList.remove('hidden');

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                // 设置Canvas尺寸
                const maxWidth = 1200;
                const scale = Math.min(maxWidth / img.width, 1);
                this.canvas.width = img.width * scale;
                this.canvas.height = img.height * scale;

                // 绘制图片
                this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);

                // 保存原始图像数据
                this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

                loading.classList.add('hidden');
                resolve();
            };

            img.onerror = () => {
                loading.classList.add('hidden');
                alert('图片加载失败，请检查图片路径是否正确');
                reject(new Error('图片加载失败'));
            };

            img.src = CONFIG.imagePath;
        });
    }

    // 加载图层图片
    async loadLayers() {
        if (!this.originalImageData) {
            throw new Error('必须先加载原始图片');
        }

        const targetWidth = this.canvas.width;
        const targetHeight = this.canvas.height;

        // 创建临时Canvas用于处理图层
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = targetWidth;
        tempCanvas.height = targetHeight;
        const tempCtx = tempCanvas.getContext('2d');

        // 加载所有图层
        const loadPromises = ['A', 'B', 'C', 'D', 'E', 'F'].map(letter => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                img.onload = () => {
                    // 清空临时Canvas
                    tempCtx.clearRect(0, 0, targetWidth, targetHeight);
                    
                    // 将图层图片绘制到临时Canvas，缩放到目标尺寸
                    tempCtx.drawImage(img, 0, 0, targetWidth, targetHeight);
                    
                    // 提取ImageData
                    const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
                    
                    // 存储图片和ImageData
                    this.layerImages[letter] = img;
                    this.layerImageData[letter] = imageData;
                    
                    resolve();
                };
                
                img.onerror = () => {
                    console.error(`图层 ${letter} 加载失败: ${CONFIG.layerPaths[letter]}`);
                    reject(new Error(`图层 ${letter} 加载失败`));
                };
                
                img.src = CONFIG.layerPaths[letter];
            });
        });

        try {
            await Promise.all(loadPromises);
            console.log('所有图层加载完成');
            
            // 调试：检查图层数据
            ['A', 'B', 'C', 'D', 'E', 'F'].forEach(letter => {
                const layerData = this.layerImageData[letter];
                if (layerData) {
                    const samplePixels = [];
                    for (let i = 0; i < Math.min(100, layerData.data.length); i += 400) {
                        const r = layerData.data[i];
                        const g = layerData.data[i + 1];
                        const b = layerData.data[i + 2];
                        const a = layerData.data[i + 3];
                        const brightness = (r + g + b) / 3;
                        samplePixels.push({ r, g, b, a, brightness });
                    }
                    console.log(`图层 ${letter} 样本像素:`, samplePixels.slice(0, 5));
                }
            });
        } catch (error) {
            console.error('图层加载错误:', error);
            alert('部分图层加载失败，请检查图层文件是否存在');
        }
    }

    // 加载背景图层图片
    async loadBgLayers() {
        if (!this.originalImageData) {
            throw new Error('必须先加载原始图片');
        }

        const targetWidth = this.canvas.width;
        const targetHeight = this.canvas.height;

        // 创建临时Canvas用于处理图层
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = targetWidth;
        tempCanvas.height = targetHeight;
        const tempCtx = tempCanvas.getContext('2d');

        // 加载所有背景图层（B, C, D, E, F）
        const loadPromises = ['B', 'C', 'D', 'E', 'F'].map(letter => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                img.onload = () => {
                    // 清空临时Canvas
                    tempCtx.clearRect(0, 0, targetWidth, targetHeight);
                    
                    // 将图层图片绘制到临时Canvas，缩放到目标尺寸
                    tempCtx.drawImage(img, 0, 0, targetWidth, targetHeight);
                    
                    // 提取ImageData
                    const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
                    
                    // 存储图片和ImageData
                    this.bgLayerImages[letter] = img;
                    this.bgLayerImageData[letter] = imageData;
                    
                    resolve();
                };
                
                img.onerror = () => {
                    console.error(`背景图层 ${letter} 加载失败: ${CONFIG.bgLayerPaths[letter]}`);
                    reject(new Error(`背景图层 ${letter} 加载失败`));
                };
                
                img.src = CONFIG.bgLayerPaths[letter];
            });
        });

        try {
            await Promise.all(loadPromises);
            console.log('所有背景图层加载完成');
        } catch (error) {
            console.error('背景图层加载错误:', error);
            alert('部分背景图层加载失败，请检查图层文件是否存在');
        }
    }

    // 根据主颜色和亮度系数计算背景颜色
    calculateBgColor(letter, mainColorHex) {
        // 获取亮度系数（D、E、F使用C的系数）
        let coefficients = CONFIG.brightnessCoefficients[letter];
        if (!coefficients) {
            // D、E、F使用C的系数
            coefficients = CONFIG.brightnessCoefficients.C;
        }

        // 将主颜色转换为RGB
        const mainRgb = this.hexToRgb(mainColorHex);

        // 应用亮度系数计算背景颜色
        const bgR = Math.round(mainRgb.r * coefficients.r);
        const bgG = Math.round(mainRgb.g * coefficients.g);
        const bgB = Math.round(mainRgb.b * coefficients.b);

        // 转换回十六进制
        return this.rgbToHex(bgR, bgG, bgB);
    }

    // 颜色变化处理（防抖）
    onColorChange(letter) {
        const newColor = this.colorInputs[letter].value;
        const oldColor = this.currentColors[letter];
        this.currentColors[letter] = newColor;
        
        // 如果颜色改变了且不是从色卡选择的，清除编号
        // 因为手动调整颜色后，编号可能不再准确
        if (oldColor !== newColor && this.colorNumbers[letter] !== null) {
            // 检查新颜色是否与当前编号对应的颜色匹配
            // 如果不匹配，清除编号
            this.colorNumbers[letter] = null;
            const numberElement = document.getElementById(`colorNumber${letter}`);
            if (numberElement) {
                numberElement.textContent = '';
            }
        }

        // 防抖处理，避免频繁更新
        clearTimeout(this.updateTimer);
        this.updateTimer = setTimeout(() => {
            this.updatePreview();
        }, 100);
    }

    // 更新预览（基于图层掩码的精确替换）
    updatePreview() {
        if (!this.originalImageData) return;

        // 检查图层是否已加载
        const layersReady = ['A', 'B', 'C', 'D', 'E', 'F'].every(letter => {
            return this.layerImageData[letter] !== null;
        });

        // 检查背景图层是否已加载（B, C, D, E, F）
        const bgLayersReady = ['B', 'C', 'D', 'E', 'F'].every(letter => {
            return this.bgLayerImageData[letter] !== null;
        });

        if (!layersReady) {
            console.warn('图层未完全加载，无法更新预览');
            return;
        }

        if (!bgLayersReady) {
            console.warn('背景图层未完全加载，背景颜色可能无法正确显示');
        }

        // 创建新的ImageData副本
        const imageData = new ImageData(
            new Uint8ClampedArray(this.originalImageData.data),
            this.originalImageData.width,
            this.originalImageData.height
        );

        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        // 计算每个颜色区域的新颜色值
        const colorTransforms = {};
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(letter => {
            const newHex = this.currentColors[letter];
            const newRgb = this.hexToRgb(newHex);
            
            // 只存储新颜色的RGB值
            colorTransforms[letter] = {
                new: newRgb
            };
        });

        // 计算背景颜色（B, C, D, E, F有背景图层）
        const bgColorTransforms = {};
        ['B', 'C', 'D', 'E', 'F'].forEach(letter => {
            const mainColorHex = this.currentColors[letter];
            const bgColorHex = this.calculateBgColor(letter, mainColorHex);
            const bgRgb = this.hexToRgb(bgColorHex);
            
            bgColorTransforms[letter] = {
                new: bgRgb
            };
        });

        // 遍历每个像素
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];

                // 跳过透明像素
                if (a < 128) continue;

                // 按优先级顺序检查图层（A -> B -> C -> D -> E -> F）
                let matchedLayer = null;
                for (const letter of ['A', 'B', 'C', 'D', 'E', 'F']) {
                    const layerData = this.layerImageData[letter];
                    if (!layerData) continue;

                    // 获取该像素在图层中的值
                    const layerIndex = (y * width + x) * 4;
                    const layerR = layerData.data[layerIndex];
                    const layerG = layerData.data[layerIndex + 1];
                    const layerB = layerData.data[layerIndex + 2];
                    const layerA = layerData.data[layerIndex + 3];

                    // 判断该像素是否属于当前图层
                    // 图层掩码格式可能有多种：
                    // 1. 白色区域（RGB接近255）表示属于该颜色区域，黑色/透明区域表示不属于
                    // 2. 黑色区域（RGB接近0）表示属于该颜色区域，白色/透明区域表示不属于
                    // 3. 非透明区域（alpha > 0）表示属于该颜色区域，透明区域表示不属于
                    // 
                    // 采用最通用的策略：只要图层像素不透明（alpha>128），就认为属于该图层
                    // 这样可以适配大多数图层掩码格式（白色表示区域或黑色表示区域都可以）
                    const isInLayer = layerA > 128;

                    if (isInLayer) {
                        matchedLayer = letter;
                        break; // 找到第一个匹配的图层就停止
                    }
                }

                // 如果找到匹配的图层，直接应用新颜色
                if (matchedLayer) {
                    const transform = colorTransforms[matchedLayer];
                    const { new: newColor } = transform;

                    // 直接应用新颜色，不进行任何偏移计算
                    data[i] = newColor.r;
                    data[i + 1] = newColor.g;
                    data[i + 2] = newColor.b;
                } else {
                    // 检查背景图层（B, C, D, E, F）
                    // 背景图层应该在主图层之后应用
                    let matchedBgLayer = null;
                    for (const letter of ['B', 'C', 'D', 'E', 'F']) {
                        const bgLayerData = this.bgLayerImageData[letter];
                        if (!bgLayerData) continue;

                        // 获取该像素在背景图层中的值
                        const bgLayerIndex = (y * width + x) * 4;
                        const bgLayerR = bgLayerData.data[bgLayerIndex];
                        const bgLayerG = bgLayerData.data[bgLayerIndex + 1];
                        const bgLayerB = bgLayerData.data[bgLayerIndex + 2];
                        const bgLayerA = bgLayerData.data[bgLayerIndex + 3];

                        // 判断该像素是否属于当前背景图层
                        const isInBgLayer = bgLayerA > 128;

                        if (isInBgLayer) {
                            matchedBgLayer = letter;
                            break; // 找到第一个匹配的背景图层就停止
                        }
                    }

                    // 如果找到匹配的背景图层，应用背景颜色
                    if (matchedBgLayer) {
                        const bgTransform = bgColorTransforms[matchedBgLayer];
                        const { new: bgColor } = bgTransform;

                        // 直接应用背景颜色
                        data[i] = bgColor.r;
                        data[i + 1] = bgColor.g;
                        data[i + 2] = bgColor.b;
                    }
                }
            }
        }

        // 将处理后的数据绘制到Canvas
        this.ctx.putImageData(imageData, 0, 0);
    }

    // 计算颜色距离（RGB空间欧氏距离）
    colorDistance(color1, color2) {
        const dr = color1.r - color2.r;
        const dg = color1.g - color2.g;
        const db = color1.b - color2.b;
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    // 十六进制转RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    // 初始化方案管理功能
    initSchemeManager() {
        const saveBtn = document.getElementById('saveSchemeBtn');
        const nameInput = document.getElementById('schemeNameInput');

        // 保存方案
        saveBtn.addEventListener('click', () => {
            const schemeName = nameInput.value.trim();
            if (!schemeName) {
                alert('请输入方案名称');
                return;
            }
            this.saveScheme(schemeName);
            nameInput.value = '';
        });

        // 回车保存
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            }
        });

        // 加载已保存的方案列表
        this.loadSavedSchemesList();
    }

    // 保存方案
    saveScheme(name) {
        const scheme = {
            name: name,
            colors: { ...this.currentColors },
            colorNumbers: { ...this.colorNumbers },
            createdAt: new Date().toISOString()
        };

        // 从localStorage获取已保存的方案列表
        const savedSchemes = this.getSavedSchemes();
        savedSchemes.push(scheme);

        // 保存到localStorage
        localStorage.setItem('wukds_color_schemes', JSON.stringify(savedSchemes));

        // 刷新方案列表
        this.loadSavedSchemesList();

        alert(`方案 "${name}" 已保存！`);
    }

    // 获取已保存的方案列表
    getSavedSchemes() {
        const stored = localStorage.getItem('wukds_color_schemes');
        return stored ? JSON.parse(stored) : [];
    }

    // 加载已保存的方案列表
    loadSavedSchemesList() {
        const container = document.getElementById('savedSchemesList');
        const schemes = this.getSavedSchemes();

        if (schemes.length === 0) {
            container.innerHTML = '<p class="no-schemes">暂无保存的方案</p>';
            return;
        }

        container.innerHTML = schemes.map((scheme, index) => {
            const date = new Date(scheme.createdAt).toLocaleString('zh-CN');
            return `
                <div class="scheme-item">
                    <div class="scheme-info">
                        <div class="scheme-name">${this.escapeHtml(scheme.name)}</div>
                        <div class="scheme-meta">保存时间: ${date}</div>
                        <div class="scheme-colors">
                            ${['A', 'B', 'C', 'D', 'E', 'F'].map(letter => {
                                const color = scheme.colors[letter];
                                const number = scheme.colorNumbers && scheme.colorNumbers[letter];
                                return `<span class="color-tag">${letter}: ${number ? `色号${number}` : color}</span>`;
                            }).join('')}
                        </div>
                    </div>
                    <div class="scheme-actions">
                        <button class="btn-load" onclick="keycapPreview.loadScheme(${index})">加载</button>
                        <button class="btn-delete" onclick="keycapPreview.deleteScheme(${index})">删除</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 加载方案
    loadScheme(index) {
        const schemes = this.getSavedSchemes();
        if (index < 0 || index >= schemes.length) {
            alert('方案不存在');
            return;
        }

        const scheme = schemes[index];
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(letter => {
            this.currentColors[letter] = scheme.colors[letter];
            this.colorInputs[letter].value = scheme.colors[letter];
            
            // 恢复颜色编号
            if (scheme.colorNumbers && scheme.colorNumbers[letter]) {
                this.colorNumbers[letter] = scheme.colorNumbers[letter];
                const numberElement = document.getElementById(`colorNumber${letter}`);
                if (numberElement) {
                    numberElement.textContent = `色号: ${scheme.colorNumbers[letter]}`;
                }
            } else {
                this.colorNumbers[letter] = null;
                const numberElement = document.getElementById(`colorNumber${letter}`);
                if (numberElement) {
                    numberElement.textContent = '';
                }
            }
        });

        this.updatePreview();
        alert(`方案 "${scheme.name}" 已加载！`);
    }

    // 删除方案
    deleteScheme(index) {
        if (!confirm('确定要删除这个方案吗？')) {
            return;
        }

        const schemes = this.getSavedSchemes();
        if (index < 0 || index >= schemes.length) {
            alert('方案不存在');
            return;
        }

        schemes.splice(index, 1);
        localStorage.setItem('wukds_color_schemes', JSON.stringify(schemes));
        this.loadSavedSchemesList();
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 重置为原始配色
    resetColors() {
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(letter => {
            const originalColor = CONFIG.originalColors[letter];
            this.currentColors[letter] = originalColor;
            this.colorInputs[letter].value = originalColor;
            this.colorNumbers[letter] = null;
            
            const numberElement = document.getElementById(`colorNumber${letter}`);
            if (numberElement) {
                numberElement.textContent = '';
            }
        });
        this.updatePreview();
    }

    // 初始化色卡选择器
    initColorCardPicker() {
        const modal = document.getElementById('colorCardModal');
        const closeModal = document.getElementById('closeModal');
        const confirmBtn = document.getElementById('confirmColorBtn');

        // 为每个颜色选择器添加色卡按钮事件
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(letter => {
            const btn = document.querySelector(`[data-letter="${letter}"]`);
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.currentSelectingLetter = letter;
                    modal.classList.add('show');
                });
            }
        });

        // 关闭模态框
        const closeModalHandler = () => {
            modal.classList.remove('show');
            this.selectedColorInfo = { number: null, color: null };
            const selectedInfo = document.getElementById('selectedColorInfo');
            if (selectedInfo) {
                selectedInfo.style.display = 'none';
            }
            // 重置键帽颜色为默认值
            this.updateKeycapPreview('#8B1A1A');
        };

        closeModal.addEventListener('click', closeModalHandler);

        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModalHandler();
            }
        });

        // 确认选择
        confirmBtn.addEventListener('click', () => {
            if (this.selectedColorInfo.color && this.currentSelectingLetter) {
                this.applyColorFromCard(this.currentSelectingLetter, this.selectedColorInfo.color, this.selectedColorInfo.number);
                modal.classList.remove('show');
                this.selectedColorInfo = { number: null, color: null };
                const selectedInfo = document.getElementById('selectedColorInfo');
                if (selectedInfo) {
                    selectedInfo.style.display = 'none';
                }
                // 重置键帽颜色为默认值
                this.updateKeycapPreview('#8B1A1A');
            }
        });

        // 为两个色卡Canvas添加点击事件
        this.colorCardCanvases.card1.addEventListener('click', (e) => this.handleColorCardClick(e, 'card1'));
        this.colorCardCanvases.card2.addEventListener('click', (e) => this.handleColorCardClick(e, 'card2'));
    }

    // 加载色卡图片
    async loadColorCards() {
        const loadCard = (cardKey, imagePath) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                img.onload = () => {
                    const canvas = this.colorCardCanvases[cardKey];
                    const ctx = this.colorCardContexts[cardKey];
                    
                    // 设置Canvas尺寸，保持宽高比
                    const maxWidth = 1000;
                    const scale = Math.min(maxWidth / img.width, 1);
                    canvas.width = img.width * scale;
                    canvas.height = img.height * scale;
                    
                    // 绘制图片
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    this.colorCardImages[cardKey] = img;
                    resolve();
                };
                
                img.onerror = () => {
                    console.error(`色卡 ${cardKey} 加载失败`);
                    reject(new Error(`色卡 ${cardKey} 加载失败`));
                };
                
                img.src = imagePath;
            });
        };

        try {
            await Promise.all([
                loadCard('card1', CONFIG.colorCardPaths.card1),
                loadCard('card2', CONFIG.colorCardPaths.card2)
            ]);
        } catch (error) {
            console.error('色卡加载错误:', error);
        }
    }

    // 处理色卡点击事件
    handleColorCardClick(event, cardKey) {
        const canvas = this.colorCardCanvases[cardKey];
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = Math.floor((event.clientX - rect.left) * scaleX);
        const y = Math.floor((event.clientY - rect.top) * scaleY);
        
        // 获取点击位置的颜色
        const imageData = this.colorCardContexts[cardKey].getImageData(x, y, 1, 1);
        const r = imageData.data[0];
        const g = imageData.data[1];
        const b = imageData.data[2];
        
        // 计算颜色编号
        const colorNumber = this.getColorNumberFromClick(x, y, cardKey);
        
        if (colorNumber) {
            const colorHex = this.rgbToHex(r, g, b);
            this.selectedColorInfo = {
                number: colorNumber,
                color: colorHex
            };
            
            // 更新键帽颜色预览
            this.updateKeycapPreview(colorHex);
            
            // 显示选择信息
            document.getElementById('selectedColorNumber').textContent = colorNumber;
            document.getElementById('selectedColorHex').textContent = colorHex.toUpperCase();
            document.getElementById('selectedColorInfo').style.display = 'flex';
        }
    }

    // 根据点击位置计算颜色编号
    getColorNumberFromClick(x, y, cardKey) {
        const layout = CONFIG.colorCardLayout;
        const canvas = this.colorCardCanvases[cardKey];
        
        // 计算键帽的尺寸（需要考虑图片的实际布局）
        // 假设色卡图片有一定的边距和间距
        // 需要根据实际图片调整这些值
        const paddingTop = canvas.height * 0.1;    // 顶部边距（标题区域）
        const paddingBottom = canvas.height * 0.1;  // 底部边距（说明文字区域）
        const paddingLeft = canvas.width * 0.05;   // 左侧边距
        const paddingRight = canvas.width * 0.05;   // 右侧边距
        
        const usableWidth = canvas.width - paddingLeft - paddingRight;
        const usableHeight = canvas.height - paddingTop - paddingBottom;
        
        const keycapWidth = usableWidth / layout.cols;
        const keycapHeight = usableHeight / layout.rows;
        
        // 计算点击位置所在的行和列
        const col = Math.floor((x - paddingLeft) / keycapWidth);
        const row = Math.floor((y - paddingTop) / keycapHeight);
        
        // 检查是否在有效范围内
        if (col < 0 || col >= layout.cols || row < 0 || row >= layout.rows) {
            return null;
        }
        
        // 计算颜色编号
        let colorNumber;
        if (cardKey === 'card1') {
            colorNumber = layout.card1Start + row * layout.cols + col;
            if (colorNumber > layout.card1End) return null;
        } else {
            colorNumber = layout.card2Start + row * layout.cols + col;
            if (colorNumber > layout.card2End) return null;
        }
        
        return colorNumber;
    }

    // RGB转十六进制
    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    // 更新键帽预览颜色
    updateKeycapPreview(colorHex) {
        const keycapTop = document.getElementById('keycapTop');      // 最顶层：使用选择的颜色
        const keycapSide = document.getElementById('keycapSide');    // 中间层：浅一些的阴影
        const keycapBottom = document.getElementById('keycapBottom'); // 最底层：最深的阴影
        
        if (!keycapTop || !keycapBottom || !keycapSide) return;
        
        const rgb = this.hexToRgb(colorHex);
        
        // 最顶层：使用选择的颜色（原色）
        keycapTop.setAttribute('fill', colorHex);
        
        // 中间层（侧面）：浅一些的阴影（降低亮度约30%）
        const mediumDarkR = Math.max(0, Math.floor(rgb.r * 0.7));
        const mediumDarkG = Math.max(0, Math.floor(rgb.g * 0.7));
        const mediumDarkB = Math.max(0, Math.floor(rgb.b * 0.7));
        const mediumDarkHex = this.rgbToHex(mediumDarkR, mediumDarkG, mediumDarkB);
        keycapSide.setAttribute('fill', mediumDarkHex);
        
        // 最底层（底部）：最深的阴影（降低亮度约50%）
        const darkestR = Math.max(0, Math.floor(rgb.r * 0.5));
        const darkestG = Math.max(0, Math.floor(rgb.g * 0.5));
        const darkestB = Math.max(0, Math.floor(rgb.b * 0.5));
        const darkestHex = this.rgbToHex(darkestR, darkestG, darkestB);
        keycapBottom.setAttribute('fill', darkestHex);
    }

    // 应用从色卡选择的颜色
    applyColorFromCard(letter, colorHex, colorNumber) {
        this.currentColors[letter] = colorHex;
        this.colorInputs[letter].value = colorHex;
        this.colorNumbers[letter] = colorNumber; // 保存编号
        
        // 显示颜色编号
        const numberElement = document.getElementById(`colorNumber${letter}`);
        if (numberElement) {
            numberElement.textContent = `色号: ${colorNumber}`;
        }
        
        // 更新预览
        this.updatePreview();
    }

    // 导出图片
    exportImage() {
        try {
            // 创建下载链接
            this.canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `wukds-keycap-${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 'image/png');
        } catch (error) {
            alert('导出失败，请重试');
            console.error('导出错误:', error);
        }
    }

    // 打开生成备注模态框
    openNoteModal() {
        const modal = document.getElementById('noteModal');
        modal.classList.add('show');
        
        // 清空输入和结果
        document.getElementById('yearInput').value = '';
        document.getElementById('wordInput').value = '';
        const noteResult = document.getElementById('noteResult');
        noteResult.style.display = 'none';
    }

    // 初始化备注生成功能
    initNoteGenerator() {
        const noteModal = document.getElementById('noteModal');
        const closeNoteModal = document.getElementById('closeNoteModal');
        const generateBtn = document.getElementById('generateNoteConfirmBtn');
        const copyBtn = document.getElementById('copyNoteBtn');
        const yearInput = document.getElementById('yearInput');
        const wordInput = document.getElementById('wordInput');

        // 关闭模态框
        const closeHandler = () => {
            noteModal.classList.remove('show');
        };

        closeNoteModal.addEventListener('click', closeHandler);
        noteModal.addEventListener('click', (e) => {
            if (e.target === noteModal) {
                closeHandler();
            }
        });

        // 年份输入限制为数字
        yearInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });

        // 单词输入限制为字母
        wordInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^A-Za-z]/g, '');
        });

        // 生成备注
        generateBtn.addEventListener('click', () => {
            this.generateNote();
        });

        // 复制备注
        copyBtn.addEventListener('click', () => {
            this.copyNote();
        });

        // 回车生成
        yearInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                generateBtn.click();
            }
        });
        wordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                generateBtn.click();
            }
        });
    }

    // 生成备注
    generateNote() {
        const year = document.getElementById('yearInput').value.trim();
        const word = document.getElementById('wordInput').value.trim();
        const noteResult = document.getElementById('noteResult');
        const noteText = document.getElementById('noteText');

        // 验证年份
        if (!year || year.length !== 4) {
            alert('请输入4位数字年份');
            return;
        }

        // 验证单词
        if (!word || word.length === 0) {
            alert('请输入英文单词');
            return;
        }

        // 检查色卡编号是否完整
        const missingColors = [];
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(letter => {
            if (!this.colorNumbers[letter]) {
                missingColors.push(letter);
            }
        });

        if (missingColors.length > 0) {
            alert(`请先为以下颜色选择色卡编号：${missingColors.join(', ')}`);
            return;
        }

        // 生成备注
        const noteParts = [];
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(letter => {
            noteParts.push(`${letter}-${this.colorNumbers[letter]}`);
        });
        noteParts.push(year);
        noteParts.push(word);

        const note = noteParts.join(', ');

        // 显示结果
        noteText.value = note;
        noteResult.style.display = 'block';

        // 自动复制
        this.copyNote();
    }

    // 复制备注到剪贴板
    async copyNote() {
        const noteText = document.getElementById('noteText');
        
        if (!noteText.value) {
            alert('请先生成备注');
            return;
        }

        try {
            await navigator.clipboard.writeText(noteText.value);
            alert('备注已复制到剪贴板！');
        } catch (error) {
            // 降级方案：使用传统方法
            noteText.select();
            document.execCommand('copy');
            alert('备注已复制到剪贴板！');
        }
    }
}

// 页面加载完成后初始化
let keycapPreview;
document.addEventListener('DOMContentLoaded', () => {
    keycapPreview = new KeycapPreview();
});

