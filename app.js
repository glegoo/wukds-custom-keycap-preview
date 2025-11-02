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

    // 更新预览
    updatePreview() {
        if (!this.originalImageData) return;

        // 创建新的ImageData副本
        const imageData = new ImageData(
            new Uint8ClampedArray(this.originalImageData.data),
            this.originalImageData.width,
            this.originalImageData.height
        );

        const data = imageData.data;
        const tolerance = CONFIG.colorTolerance;
        const backgroundTolerance = CONFIG.backgroundTolerance || tolerance;

        // 计算每个颜色区域的变换系数
        const colorTransforms = {};
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(letter => {
            const originalHex = CONFIG.originalColors[letter];
            const newHex = this.currentColors[letter];
            const originalRgb = this.hexToRgb(originalHex);
            const newRgb = this.hexToRgb(newHex);
            
            // 存储原始颜色和新颜色的RGB值
            const transform = {
                original: originalRgb,
                new: newRgb
            };
            
            colorTransforms[letter] = transform;
        });

        // 遍历每个像素
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // 跳过透明像素
            if (a < 128) continue;

            const pixelColor = { r, g, b };

            // 检查每个颜色区域，找到最佳匹配
            // 对于B、C、D、E、F（背景相关颜色），使用更大的容差
            let bestMatch = null;
            let minDistance = Infinity;

            for (const letter of ['A', 'B', 'C', 'D', 'E', 'F']) {
                const transform = colorTransforms[letter];
                const distance = this.colorDistance(pixelColor, transform.original);
                
                // A（字符颜色）使用标准容差，B-F（主体和色带颜色，包括背景）使用更大的容差
                const currentTolerance = letter === 'A' ? tolerance : backgroundTolerance;

                if (distance <= currentTolerance && distance < minDistance) {
                    minDistance = distance;
                    bestMatch = { letter, transform, distance };
                }
            }

            // 如果找到匹配，应用变换
            if (bestMatch) {
                const { transform } = bestMatch;
                const { original, new: newColor } = transform;

                // 计算像素相对于原始颜色的偏移量
                const deltaR = r - original.r;
                const deltaG = g - original.g;
                const deltaB = b - original.b;

                // 统一算法：保持颜色的相对关系
                // 对于每个RGB通道，计算相对偏移比例，然后应用到新颜色
                let newR, newG, newB;

                // 计算相对偏移比例（相对于原始颜色的变化比例）
                // 例如：原始rgb(5,5,5)，像素rgb(5,5,6)，deltaB=1，ratioB=1/5=0.2
                const ratioR = original.r !== 0 ? deltaR / original.r : (deltaR !== 0 ? deltaR / 1 : 0);
                const ratioG = original.g !== 0 ? deltaG / original.g : (deltaG !== 0 ? deltaG / 1 : 0);
                const ratioB = original.b !== 0 ? deltaB / original.b : (deltaB !== 0 ? deltaB / 1 : 0);

                // 应用相同的相对比例到新颜色
                // 例如：新颜色rgb(255,255,255)，ratioB=0.2，则newB=255*(1+0.2)=306->255
                newR = Math.max(0, Math.min(255, newColor.r * (1 + ratioR)));
                newG = Math.max(0, Math.min(255, newColor.g * (1 + ratioG)));
                newB = Math.max(0, Math.min(255, newColor.b * (1 + ratioB)));

                data[i] = Math.round(newR);
                data[i + 1] = Math.round(newG);
                data[i + 2] = Math.round(newB);
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

