// 键帽配色预览工具核心逻辑

class KeycapPreview {
    constructor() {
        this.canvas = document.getElementById('previewCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentColors = { ...CONFIG.originalColors };
        this.colorInputs = {};
        this.updateTimer = null;
        this.toastTimer = null;
        
        // 色卡相关
        this.colorCardCanvas = document.getElementById('colorCardPlate');
        this.colorCardContext = this.colorCardCanvas.getContext('2d');
        this.colorCardImage = null;
        this.colorCardMagnifier = document.getElementById('colorCardMagnifier');
        this.currentSelectingLetter = 'A'; // 默认选中 A
        this.selectedColorInfo = {
            number: null,
            color: null
        };
        // 放大镜相关
        this.magnifierVisible = false;
        this.magnifierZoom = 2.5; // 放大倍数
        this.magnifierHeight = 150; // 放大镜高度（像素）
        
        // 存储颜色编号（用于保存方案）
        this.colorNumbers = {
            A: null,
            B: null,
            C: null,
            D: null,
            E: null,
            F: null
        };
        
        // 图层相关（图层叠加顺序：Frame -> A -> B -> C -> D -> E -> F）
        this.layerImages = {
            Frame: null,
            A: null,
            B: null,
            C: null,
            D: null,
            E: null,
            F: null
        };
        
        // 文字配置
        this.textConfig = {
            year: '1970',
            word: 'Music',
            wordSpace: '' // 英文单词（空格），非必填
        };
        
        // 字体加载状态
        this.fontsLoaded = {
            stapel: false,
            fresty: false
        };
        
        // Canvas缩放比例（用于坐标转换）
        this.canvasScale = 1;
        
        this.init();
    }

    // 初始化
    async init() {
        // 初始化颜色输入框（内部存储）
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(letter => {
            this.colorInputs[letter] = document.createElement('input');
            this.colorInputs[letter].type = 'color';
            this.colorInputs[letter].value = CONFIG.originalColors[letter];
        });

        // 初始化选项卡
        this.initColorTabs();

        // 初始化当前颜色输入框
        this.initCurrentColorInput();

        // 初始化方案管理功能
        this.initSchemeManager();

        // 初始化操作按钮
        document.getElementById('resetBtn').addEventListener('click', () => this.resetColors());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportImage());
        document.getElementById('generateNoteBtn').addEventListener('click', () => this.generateAndCopyNote());

        // 初始化色卡选择器
        this.initColorCardPicker();

        // 初始化备注生成功能
        this.initNoteGenerator();
        
        // 初始化文字配置输入限制
        this.initTextConfigInputs();
        
        // 加载字体
        await this.loadFonts();

        // 加载图层图片（将设置Canvas尺寸）
        await this.loadLayers();
        
        // 加载色卡图片
        await this.loadColorCards();
    }

    // 加载图层图片
    async loadLayers() {
        const loading = document.getElementById('loading');
        loading.classList.remove('hidden');
        
        try {
            // 先加载 Frame 图层以确定 Canvas 尺寸
            const frameImg = await this.loadSingleLayer('Frame');
            
            // 设置Canvas尺寸（保持原始尺寸或适当缩放）
            const maxWidth = 1200;
            const scale = Math.min(maxWidth / frameImg.width, 1);
            this.canvas.width = frameImg.width * scale;
            this.canvas.height = frameImg.height * scale;
            this.canvasScale = scale; // 保存缩放比例

            // 加载其余图层（Frame已加载，跳过）
            const loadPromises = ['A', 'B', 'C', 'D', 'E', 'F'].map(layerName => {
                return this.loadSingleLayer(layerName);
            });

            await Promise.all(loadPromises);
            console.log('所有图层加载完成');
            
            // 初始渲染
            this.updatePreview();
            
            loading.classList.add('hidden');
        } catch (error) {
            console.error('图层加载错误:', error);
            this.showToast('部分图层加载失败，请检查图层文件是否存在', 'error');
            loading.classList.add('hidden');
        }
    }

    // 加载单个图层
    loadSingleLayer(layerName) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                this.layerImages[layerName] = img;
                resolve(img);
            };
            
            img.onerror = () => {
                console.error(`图层 ${layerName} 加载失败: ${CONFIG.layerPaths[layerName]}`);
                reject(new Error(`图层 ${layerName} 加载失败`));
            };
            
            img.src = CONFIG.layerPaths[layerName];
        });
    }


    // 颜色变化处理（防抖）
    onColorChange(letter) {
        const newColor = this.colorInputs[letter].value;
        const oldColor = this.currentColors[letter];
        this.currentColors[letter] = newColor;
        
        // 更新选项卡颜色
        this.updateTabColor(letter);
        
        // 如果颜色改变了且不是从色卡选择的，清除编号
        // 因为手动调整颜色后，编号可能不再准确
        if (oldColor !== newColor && this.colorNumbers[letter] !== null) {
            // 检查新颜色是否与当前编号对应的颜色匹配
            // 如果不匹配，清除编号
            this.colorNumbers[letter] = null;
            // 如果当前显示的是这个字母，更新显示
            if (letter === this.currentSelectingLetter) {
                this.updateCurrentColorDisplay();
            }
        }

        // 防抖处理，避免频繁更新
        clearTimeout(this.updateTimer);
        this.updateTimer = setTimeout(() => {
            this.updatePreview();
        }, 100);
    }

    // 更新预览（图层叠加，从底到顶：F -> E -> D -> C -> B -> A -> Frame）
    updatePreview() {
        // 检查所有图层是否已加载
        const layerOrder = ['Frame', 'A', 'B', 'C', 'D', 'E', 'F'];
        const layersReady = layerOrder.every(layerName => {
            return this.layerImages[layerName] !== null;
        });

        if (!layersReady) {
            console.warn('图层未完全加载，无法更新预览');
            return;
        }

        // 清空Canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制智能背景（根据主题色B自动选择最佳背景方案）
        const backgroundColorB = this.currentColors.B || CONFIG.originalColors.B;
        this.drawSmartBackground(backgroundColorB);

        // 创建临时Canvas用于处理图层颜色替换
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        // 按从底到顶的顺序绘制图层：F -> E -> D -> C -> B -> A -> Frame
        const drawOrder = ['F', 'E', 'D', 'C', 'B', 'A', 'Frame'];
        
        for (const layerName of drawOrder) {
            const layerImg = this.layerImages[layerName];
            if (!layerImg) continue;

            // Frame 图层直接绘制，不做颜色替换
            if (layerName === 'Frame') {
                this.ctx.drawImage(layerImg, 0, 0, this.canvas.width, this.canvas.height);
                continue;
            }

            // 颜色图层（A-F）：如果用户配置了颜色，需要替换非透明像素的颜色
            const userColor = this.currentColors[layerName];
            if (userColor) {
                // 清空临时Canvas
                tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
                
                // 绘制原始图层到临时Canvas
                tempCtx.drawImage(layerImg, 0, 0, tempCanvas.width, tempCanvas.height);
                
                // 获取像素数据
                const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                const data = imageData.data;
                
                // 将用户配置的颜色转换为RGB
                const newRgb = this.hexToRgb(userColor);
                
                // 替换非透明像素的颜色
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i + 3] > 0) { // 非透明像素
                        data[i] = newRgb.r;     // R
                        data[i + 1] = newRgb.g; // G
                        data[i + 2] = newRgb.b; // B
                        // alpha 保持不变
                    }
                }
                
                // 将处理后的数据写回临时Canvas
                tempCtx.putImageData(imageData, 0, 0);
                
                // 将处理后的图层绘制到主Canvas（使用 source-over 叠加模式）
                this.ctx.drawImage(tempCanvas, 0, 0);
            } else {
                // 如果没有配置颜色，直接绘制原始图层
                this.ctx.drawImage(layerImg, 0, 0, this.canvas.width, this.canvas.height);
            }
        }

        // 在右下角绘制文字 "WUKDS"
        this.drawWatermark();
        
        // 绘制用户配置的文字（年份和单词）- 必须在所有图层之后绘制，确保在最上层
        this.ctx.globalCompositeOperation = 'source-over'; // 确保使用正常叠加模式
        this.drawUserText();
        
        // 绘制色卡号列表（竖列排列）
        this.drawColorNumbers();
        
        // 在坐标(80, 80)处绘制"年份 单词"
        this.drawYearWord();
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

    // 将颜色变暗（factor: 0-1，值越小越暗）
    darkenColor(hex, factor = 0.7) {
        const rgb = this.hexToRgb(hex);
        const darkR = Math.max(0, Math.floor(rgb.r * factor));
        const darkG = Math.max(0, Math.floor(rgb.g * factor));
        const darkB = Math.max(0, Math.floor(rgb.b * factor));
        return this.rgbToHex(darkR, darkG, darkB);
    }

    // 将颜色变亮（factor: >1，值越大越亮）
    lightenColor(hex, factor = 1.3) {
        const rgb = this.hexToRgb(hex);
        const lightR = Math.min(255, Math.floor(rgb.r * factor));
        const lightG = Math.min(255, Math.floor(rgb.g * factor));
        const lightB = Math.min(255, Math.floor(rgb.b * factor));
        return this.rgbToHex(lightR, lightG, lightB);
    }

    // 计算颜色亮度（0-255，值越大越亮）
    getColorBrightness(hex) {
        const rgb = this.hexToRgb(hex);
        // 使用加权平均计算亮度（人眼对不同颜色的敏感度不同）
        return (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114);
    }

    // RGB转HSL
    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return { h: h * 360, s, l };
    }

    // HSL转RGB
    hslToRgb(h, s, l) {
        h /= 360;
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    // 获取色相环上的互补色（更准确的算法）
    getComplementaryColor(hex) {
        const rgb = this.hexToRgb(hex);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
        // 色相旋转180度
        const complementaryHue = (hsl.h + 180) % 360;
        // 调整亮度和饱和度以确保对比度
        const newSaturation = Math.min(0.4, hsl.s * 0.6); // 降低饱和度，更柔和
        const newLightness = hsl.l < 0.3 ? 0.85 : 0.15; // 如果原色很暗，互补色要很亮；反之亦然
        const complementaryRgb = this.hslToRgb(complementaryHue, newSaturation, newLightness);
        return this.rgbToHex(complementaryRgb.r, complementaryRgb.g, complementaryRgb.b);
    }

    // 计算两个颜色的对比度（WCAG标准）
    getContrastRatio(color1, color2) {
        const getLuminance = (hex) => {
            const rgb = this.hexToRgb(hex);
            const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
                val = val / 255;
                return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };

        const lum1 = getLuminance(color1);
        const lum2 = getLuminance(color2);
        const lighter = Math.max(lum1, lum2);
        const darker = Math.min(lum1, lum2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    // 绘制智能背景（根据主题色自动选择最佳背景方案）
    drawSmartBackground(themeColor) {
        const brightness = this.getColorBrightness(themeColor);
        let bgColor;
        
        if (brightness < 50) {
            // 极暗色（接近黑色）：使用浅色背景
            // 方案1：使用互补色的浅色版本
            const complementary = this.getComplementaryColor(themeColor);
            bgColor = this.lightenColor(complementary, 2.2);
            
            // 如果互补色还是太暗，使用浅灰色作为后备
            const complementaryBrightness = this.getColorBrightness(bgColor);
            if (complementaryBrightness < 180) {
                bgColor = '#E8E8E8'; // 浅灰色
            }
        } else if (brightness < 120) {
            // 中等偏暗：使用主题色变暗，但不要太暗
            bgColor = this.darkenColor(themeColor, 0.55);
            
            // 确保背景色与主题色有足够对比度
            const contrastRatio = this.getContrastRatio(themeColor, bgColor);
            if (contrastRatio < 1.5) {
                // 对比度不够，使用稍亮的背景
                bgColor = this.darkenColor(themeColor, 0.65);
            }
        } else if (brightness < 200) {
            // 中等亮度：使用主题色变暗
            bgColor = this.darkenColor(themeColor, 0.5);
        } else {
            // 亮色：使用主题色变暗
            bgColor = this.darkenColor(themeColor, 0.45);
        }
        
        // 最终检查：确保背景色不会太暗或太亮
        const bgBrightness = this.getColorBrightness(bgColor);
        if (bgBrightness < 30) {
            // 背景太暗，使用浅灰色
            bgColor = '#E0E0E0';
        } else if (bgBrightness > 240) {
            // 背景太亮，稍微变暗
            bgColor = this.darkenColor(bgColor, 0.9);
        }
        
        // 绘制背景
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // 在右下角绘制水印文字
    drawWatermark() {
        const text = 'WUKDS';
        const padding = 80; // 距离边缘的间距
        const fontSize = Math.max(36, this.canvas.width * 0.05); // 增大字体，根据canvas大小自适应
        
        // 检查字体是否可用
        const stapelAvailable = this.fontsLoaded.stapel || 
            document.fonts.check('20px "Stapel Narrow Extra Bold Italic"') ||
            document.fonts.check('1em "Stapel Narrow Extra Bold Italic"');
        
        // 设置文字样式
        if (stapelAvailable) {
            this.ctx.font = `${fontSize}px "Stapel Narrow Extra Bold Italic"`;
        } else {
            // 如果字体未加载，使用默认字体
            this.ctx.font = `bold ${fontSize}px Arial, sans-serif`;
            console.warn('Stapel字体未加载，WUKDS水印使用默认字体');
        }
        this.ctx.textBaseline = 'bottom';
        
        // 颜色映射：W->C, U->D, K->E, D->F, S->A
        const colorMap = {
            'W': 'C',
            'U': 'D',
            'K': 'E',
            'D': 'F',
            'S': 'A'
        };
        
        // 固定字母间距（使用字体大小的固定比例）
        const letterSpacing = fontSize * 0.05; // 固定间距
        
        // 先计算所有字母的总宽度（包括间距）
        let totalWidth = 0;
        const letterWidths = [];
        for (let i = 0; i < text.length; i++) {
            const letter = text[i];
            const width = this.ctx.measureText(letter).width;
            letterWidths.push(width);
            totalWidth += width;
            // 除了最后一个字母，其他都要加上间距
            if (i < text.length - 1) {
                totalWidth += letterSpacing;
            }
        }
        
        // 计算起始位置（右下角，确保不超出范围）
        const x = Math.max(padding, this.canvas.width - padding - totalWidth);
        const y = this.canvas.height - padding;
        
        // 绘制文字阴影设置
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        this.ctx.shadowBlur = 4;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 2;
        
        // 从左到右逐个绘制每个字母，使用对应的颜色
        let currentX = x;
        for (let i = 0; i < text.length; i++) {
            const letter = text[i];
            const colorLetter = colorMap[letter];
            const color = this.currentColors[colorLetter] || CONFIG.originalColors[colorLetter];
            
            // 设置当前字母的颜色
            this.ctx.fillStyle = color;
            
            // 绘制字母
            this.ctx.fillText(letter, currentX, y);
            
            // 移动到下一个字母的位置（向右移动，包括字母宽度和固定间距）
            currentX += letterWidths[i] + letterSpacing;
        }
        
        // 重置阴影
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
    }

    // 初始化方案管理功能
    initSchemeManager() {
        const saveBtn = document.getElementById('saveSchemeBtn');
        const loadBtn = document.getElementById('loadSchemeBtn');
        const loadModal = document.getElementById('loadSchemeModal');
        const closeLoadModal = document.getElementById('closeLoadSchemeModal');

        // 保存方案
        saveBtn.addEventListener('click', () => {
            // 使用"年份 单词"作为方案名称
            const year = this.textConfig.year || '';
            const word = this.textConfig.word || '';
            
            if (!year && !word) {
                this.showToast('请先输入年份和单词', 'warning');
                return;
            }
            
            // 组合方案名称：年份 单词
            const schemeName = word ? `${year} ${word}` : year;
            this.saveScheme(schemeName);
        });

        // 打开加载方案弹窗
        loadBtn.addEventListener('click', () => {
            this.openLoadSchemeModal();
        });

        // 关闭加载方案弹窗
        const closeHandler = () => {
            loadModal.classList.remove('show');
        };
        closeLoadModal.addEventListener('click', closeHandler);
        loadModal.addEventListener('click', (e) => {
            if (e.target === loadModal) {
                closeHandler();
            }
        });

        // 加载已保存的方案列表（弹窗中的列表）
        this.loadSavedSchemesList();
    }

    // 保存方案
    saveScheme(name) {
        const scheme = {
            name: name,
            colors: { ...this.currentColors },
            colorNumbers: { ...this.colorNumbers },
            textConfig: { ...this.textConfig }, // 保存年份和单词
            createdAt: new Date().toISOString()
        };

        // 从localStorage获取已保存的方案列表
        const savedSchemes = this.getSavedSchemes();
        savedSchemes.push(scheme);

        // 保存到localStorage
        localStorage.setItem('wukds_color_schemes', JSON.stringify(savedSchemes));

        // 刷新方案列表（弹窗中的列表）
        this.loadSavedSchemesList();

        this.showToast(`方案 "${name}" 已保存！`, 'success');
    }

    // 获取已保存的方案列表
    getSavedSchemes() {
        const stored = localStorage.getItem('wukds_color_schemes');
        return stored ? JSON.parse(stored) : [];
    }

    // 打开加载方案弹窗
    openLoadSchemeModal() {
        const modal = document.getElementById('loadSchemeModal');
        // 刷新方案列表
        this.loadSavedSchemesList();
        modal.classList.add('show');
    }

    // 加载已保存的方案列表（渲染到弹窗中）
    loadSavedSchemesList() {
        const container = document.getElementById('savedSchemesListModal');
        const schemes = this.getSavedSchemes();

        if (schemes.length === 0) {
            container.innerHTML = '<p class="no-schemes">暂无保存的方案</p>';
            return;
        }

        container.innerHTML = schemes.map((scheme, index) => {
            const date = new Date(scheme.createdAt).toLocaleString('zh-CN');
            const year = scheme.textConfig && scheme.textConfig.year ? scheme.textConfig.year : '';
            const word = scheme.textConfig && scheme.textConfig.word ? scheme.textConfig.word : '';
            const yearWordInfo = (year || word) ? `<div class="scheme-meta">年份: ${year || '-'} | 单词: ${word || '-'}</div>` : '';
            return `
                <div class="scheme-item">
                    <div class="scheme-info">
                        <div class="scheme-name">${this.escapeHtml(scheme.name)}</div>
                        <div class="scheme-meta">保存时间: ${date}</div>
                        ${yearWordInfo}
                        <div class="scheme-colors">
                            ${['A', 'B', 'C', 'D', 'E', 'F'].map(letter => {
                                const color = scheme.colors[letter];
                                const number = scheme.colorNumbers && scheme.colorNumbers[letter];
                                return `<span class="color-tag">${letter}: ${number ? `色号${number}` : color}</span>`;
                            }).join('')}
                        </div>
                    </div>
                    <div class="scheme-actions">
                        <button class="btn-load" onclick="keycapPreview.loadSchemeFromModal(${index})">加载</button>
                        <button class="btn-delete" onclick="keycapPreview.deleteSchemeFromModal(${index})">删除</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 从弹窗加载方案
    loadSchemeFromModal(index) {
        const schemes = this.getSavedSchemes();
        if (index < 0 || index >= schemes.length) {
            this.showToast('方案不存在', 'error');
            return;
        }

        const scheme = schemes[index];
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(letter => {
            this.currentColors[letter] = scheme.colors[letter];
            this.colorInputs[letter].value = scheme.colors[letter];
            
            // 恢复颜色编号
            if (scheme.colorNumbers && scheme.colorNumbers[letter]) {
                this.colorNumbers[letter] = scheme.colorNumbers[letter];
            } else {
                this.colorNumbers[letter] = null;
            }
        });

        // 恢复年份和单词
        if (scheme.textConfig) {
            this.textConfig.year = scheme.textConfig.year || '1970';
            this.textConfig.word = scheme.textConfig.word || 'Music';
            this.textConfig.wordSpace = scheme.textConfig.wordSpace || '';
            
            // 更新输入框
            const yearInput = document.getElementById('yearInputConfig');
            const wordInput = document.getElementById('wordInputConfig');
            const wordSpaceInput = document.getElementById('wordSpaceInputConfig');
            if (yearInput) {
                yearInput.value = this.textConfig.year;
            }
            if (wordInput) {
                wordInput.value = this.textConfig.word;
            }
            if (wordSpaceInput) {
                wordSpaceInput.value = this.textConfig.wordSpace;
            }
        }

        // 更新所有选项卡颜色
        this.updateAllTabColors();
        // 更新当前颜色显示
        this.updateCurrentColorDisplay();
        this.updatePreview();
        
        // 关闭弹窗
        const modal = document.getElementById('loadSchemeModal');
        modal.classList.remove('show');
        
        this.showToast(`方案 "${scheme.name}" 已加载！`, 'success');
    }

    // 加载方案（保留原有方法以兼容可能的其他调用）
    loadScheme(index) {
        this.loadSchemeFromModal(index);
    }

    // 从弹窗删除方案
    deleteSchemeFromModal(index) {
        if (!confirm('确定要删除这个方案吗？')) {
            return;
        }

        const schemes = this.getSavedSchemes();
        if (index < 0 || index >= schemes.length) {
            this.showToast('方案不存在', 'error');
            return;
        }

        const schemeName = schemes[index].name;
        schemes.splice(index, 1);
        localStorage.setItem('wukds_color_schemes', JSON.stringify(schemes));
        this.loadSavedSchemesList();
        this.showToast(`方案 "${schemeName}" 已删除`, 'success');
    }

    // 删除方案（保留原有方法以兼容可能的其他调用）
    deleteScheme(index) {
        this.deleteSchemeFromModal(index);
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 显示 Toast 提示
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.getElementById('toast');
        if (!toast) return;

        // 清除之前的定时器
        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
        }

        // 移除之前的类型类
        toast.classList.remove('success', 'error', 'warning', 'info');
        // 添加新的类型类
        toast.classList.add(type);
        
        // 设置消息内容
        toast.textContent = message;
        
        // 显示 toast
        toast.classList.remove('hide');
        toast.classList.add('show');

        // 自动隐藏
        this.toastTimer = setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => {
                toast.classList.remove('show', 'hide');
            }, 300);
        }, duration);
    }

    // 初始化颜色选项卡
    initColorTabs() {
        const tabs = document.querySelectorAll('.color-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const letter = tab.getAttribute('data-letter');
                this.switchColorTab(letter);
            });
        });
        // 更新所有选项卡的颜色
        this.updateAllTabColors();
        // 默认选中 A
        this.switchColorTab('A');
    }

    // 切换颜色选项卡
    switchColorTab(letter) {
        this.currentSelectingLetter = letter;
        
        // 更新选项卡状态
        document.querySelectorAll('.color-tab').forEach(tab => {
            if (tab.getAttribute('data-letter') === letter) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // 更新当前颜色显示
        this.updateCurrentColorDisplay();
    }

    // 更新所有选项卡的颜色显示
    updateAllTabColors() {
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(letter => {
            this.updateTabColor(letter);
        });
    }

    // 更新单个选项卡的颜色显示
    updateTabColor(letter) {
        const tab = document.querySelector(`.color-tab[data-letter="${letter}"]`);
        if (!tab) return;

        const color = this.currentColors[letter] || CONFIG.originalColors[letter];
        
        // 设置背景颜色
        tab.style.backgroundColor = color;
        
        // 根据颜色亮度设置文字颜色
        const brightness = this.getColorBrightness(color);
        if (brightness < 128) {
            tab.setAttribute('data-brightness', 'dark');
        } else {
            tab.setAttribute('data-brightness', 'light');
        }
    }

    // 初始化当前颜色输入框
    initCurrentColorInput() {
        const colorInput = document.getElementById('currentColorInput');
        const hexInput = document.getElementById('currentColorHex');
        
        // 颜色选择器变化
        colorInput.addEventListener('input', () => {
            const letter = this.currentSelectingLetter;
            const newColor = colorInput.value;
            this.currentColors[letter] = newColor;
            this.colorInputs[letter].value = newColor;
            hexInput.value = newColor.toUpperCase();
            
            // 更新选项卡颜色
            this.updateTabColor(letter);
            
            // 清除编号（手动调整颜色后）
            if (this.colorNumbers[letter] !== null) {
                this.colorNumbers[letter] = null;
                this.updateCurrentColorDisplay();
            }
            
            // 更新预览
            this.onColorChange(letter);
        });
        
        // 初始显示
        this.updateCurrentColorDisplay();
    }

    // 更新当前颜色显示
    updateCurrentColorDisplay() {
        const letter = this.currentSelectingLetter;
        const color = this.currentColors[letter];
        const colorNumber = this.colorNumbers[letter];
        
        // 更新标签
        const label = document.getElementById('currentColorLabel');
        const tab = document.querySelector(`[data-letter="${letter}"]`);
        if (tab && label) {
            const tabLabel = tab.getAttribute('data-label');
            label.textContent = `${letter} - ${tabLabel}`;
        }
        
        // 更新颜色编号
        const numberElement = document.getElementById('currentColorNumber');
        if (numberElement) {
            numberElement.textContent = colorNumber ? `色号: ${colorNumber}` : '';
        }
        
        // 更新颜色输入框
        const colorInput = document.getElementById('currentColorInput');
        const hexInput = document.getElementById('currentColorHex');
        if (colorInput && hexInput) {
            colorInput.value = color;
            hexInput.value = color.toUpperCase();
        }
    }

    // 重置为原始配色
    resetColors() {
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(letter => {
            const originalColor = CONFIG.originalColors[letter];
            this.currentColors[letter] = originalColor;
            this.colorInputs[letter].value = originalColor;
            this.colorNumbers[letter] = null;
        });
        
        // 重置年份和单词为默认值
        this.textConfig.year = '1970';
        this.textConfig.word = 'Music';
        this.textConfig.wordSpace = '';
        
        // 更新年份和单词输入框
        const yearInput = document.getElementById('yearInputConfig');
        const wordInput = document.getElementById('wordInputConfig');
        const wordSpaceInput = document.getElementById('wordSpaceInputConfig');
        if (yearInput) {
            yearInput.value = this.textConfig.year;
        }
        if (wordInput) {
            wordInput.value = this.textConfig.word;
        }
        if (wordSpaceInput) {
            wordSpaceInput.value = this.textConfig.wordSpace;
        }
        
        // 更新所有选项卡颜色
        this.updateAllTabColors();
        this.updateCurrentColorDisplay();
        this.updatePreview();
    }

    // 初始化色卡选择器
    initColorCardPicker() {
        // 为色卡Canvas添加点击事件
        this.colorCardCanvas.addEventListener('click', (e) => this.handleColorCardClick(e));
        
        // 添加鼠标移动事件（放大镜效果）
        this.colorCardCanvas.addEventListener('mousemove', (e) => this.handleColorCardMouseMove(e));
        this.colorCardCanvas.addEventListener('mouseenter', () => this.showMagnifier());
        this.colorCardCanvas.addEventListener('mouseleave', () => this.hideMagnifier());
    }

    // 加载色卡图片
    async loadColorCards() {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                // 设置Canvas尺寸，适应控制面板宽度（约350px，减去padding约310px）
                const maxWidth = 310;
                const scale = Math.min(maxWidth / img.width, 1);
                this.colorCardCanvas.width = img.width * scale;
                this.colorCardCanvas.height = img.height * scale;
                
                // 绘制图片
                this.colorCardContext.drawImage(img, 0, 0, this.colorCardCanvas.width, this.colorCardCanvas.height);
                
                this.colorCardImage = img;
                resolve();
            };
            
            img.onerror = () => {
                console.error('色卡加载失败');
                reject(new Error('色卡加载失败'));
            };
            
            img.src = CONFIG.colorCardPaths.plate;
        });
    }

    // 处理色卡点击事件
    handleColorCardClick(event) {
        const canvas = this.colorCardCanvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = Math.floor((event.clientX - rect.left) * scaleX);
        const y = Math.floor((event.clientY - rect.top) * scaleY);
        
        // 计算颜色编号
        const colorNumber = this.getColorNumberFromClick(x, y);
        
        if (colorNumber && this.currentSelectingLetter) {
            // 获取点击位置的颜色
            const imageData = this.colorCardContext.getImageData(x, y, 1, 1);
            const r = imageData.data[0];
            const g = imageData.data[1];
            const b = imageData.data[2];
            const colorHex = this.rgbToHex(r, g, b);
            
            // 立即应用颜色
            this.applyColorFromCard(this.currentSelectingLetter, colorHex, colorNumber);
        } else {
            // 调试信息：如果无法获取编号，输出调试信息
            console.log('点击位置:', { x, y, canvasWidth: canvas.width, canvasHeight: canvas.height });
        }
    }

    // 根据点击位置计算颜色编号
    // 图片是15列12行的矩形方阵，共180个色号（1-180）
    getColorNumberFromClick(x, y) {
        const layout = CONFIG.colorCardLayout;
        const canvas = this.colorCardCanvas;
        
        // 15列12行的网格布局
        // 直接从canvas尺寸计算每个单元格的尺寸（假设图片填满整个canvas）
        const cellWidth = canvas.width / layout.cols;   // 每列的宽度
        const cellHeight = canvas.height / layout.rows; // 每行的高度
        
        // 计算点击位置所在的行和列（从0开始）
        const col = Math.floor(x / cellWidth);
        const row = Math.floor(y / cellHeight);
        
        // 调试信息
        console.log('点击计算:', {
            x, y,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            cellWidth,
            cellHeight,
            col,
            row,
            layoutCols: layout.cols,
            layoutRows: layout.rows
        });
        
        // 检查是否在有效范围内
        if (col < 0 || col >= layout.cols || row < 0 || row >= layout.rows) {
            console.log('超出范围:', { col, row, maxCol: layout.cols - 1, maxRow: layout.rows - 1 });
            return null;
        }
        
        // 计算颜色编号（从1开始，从左到右、从上到下）
        // 公式：编号 = 1 + 行号 * 列数 + 列号
        // 例如：第1行第1列 = 1 + 0*15 + 0 = 1
        //      第1行第15列 = 1 + 0*15 + 14 = 15
        //      第2行第1列 = 1 + 1*15 + 0 = 16
        //      第12行第15列 = 1 + 11*15 + 14 = 180
        const colorNumber = layout.start + row * layout.cols + col;
        
        // 检查编号是否在有效范围内
        if (colorNumber < layout.start || colorNumber > layout.end) {
            console.log('编号超出范围:', { colorNumber, start: layout.start, end: layout.end });
            return null;
        }
        
        console.log('成功计算编号:', colorNumber);
        return colorNumber;
    }

    // 显示放大镜
    showMagnifier() {
        if (this.colorCardMagnifier) {
            this.magnifierVisible = true;
            this.colorCardMagnifier.style.display = 'block';
        }
    }

    // 隐藏放大镜
    hideMagnifier() {
        if (this.colorCardMagnifier) {
            this.magnifierVisible = false;
            this.colorCardMagnifier.style.display = 'none';
        }
    }

    // 处理色卡鼠标移动事件（放大镜效果）
    handleColorCardMouseMove(event) {
        if (!this.magnifierVisible || !this.colorCardMagnifier || !this.colorCardImage) {
            return;
        }

        const canvas = this.colorCardCanvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        // 计算鼠标在canvas上的坐标
        const canvasX = (event.clientX - rect.left) * scaleX;
        const canvasY = (event.clientY - rect.top) * scaleY;
        
        // 计算原始图片的坐标
        const originalScaleX = this.colorCardImage.width / canvas.width;
        const originalScaleY = this.colorCardImage.height / canvas.height;
        const originalX = canvasX * originalScaleX;
        const originalY = canvasY * originalScaleY;
        
        // 获取放大镜的宽度（与色卡同宽）
        const magnifierWidth = rect.width;
        
        // 创建临时canvas用于放大
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = magnifierWidth;
        tempCanvas.height = this.magnifierHeight;
        const tempCtx = tempCanvas.getContext('2d');
        
        // 计算源区域大小（放大镜显示的区域）
        const sourceHeight = this.magnifierHeight / this.magnifierZoom;
        const sourceWidth = magnifierWidth / this.magnifierZoom;
        
        // 计算源区域的起始位置（以鼠标位置为中心）
        let sourceX = originalX - sourceWidth / 2;
        let sourceY = originalY - sourceHeight / 2;
        
        // 确保源区域不超出图片边界
        sourceX = Math.max(0, Math.min(this.colorCardImage.width - sourceWidth, sourceX));
        sourceY = Math.max(0, Math.min(this.colorCardImage.height - sourceHeight, sourceY));
        
        // 绘制放大后的区域（长方形）
        tempCtx.drawImage(
            this.colorCardImage,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, magnifierWidth, this.magnifierHeight
        );
        
        // 在放大镜中心绘制固定的十字线（帮助用户了解鼠标对应的位置）
        const centerX = magnifierWidth / 2;
        const centerY = this.magnifierHeight / 2;
        tempCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        tempCtx.lineWidth = 2;
        tempCtx.beginPath();
        // 垂直线
        tempCtx.moveTo(centerX, 0);
        tempCtx.lineTo(centerX, this.magnifierHeight);
        // 水平线
        tempCtx.moveTo(0, centerY);
        tempCtx.lineTo(magnifierWidth, centerY);
        tempCtx.stroke();
        
        // 更新放大镜内容（位置固定，不需要移动）
        this.colorCardMagnifier.style.backgroundImage = `url(${tempCanvas.toDataURL()})`;
        
        // 获取当前鼠标位置的颜色信息
        const imageData = this.colorCardContext.getImageData(
            Math.floor(canvasX), 
            Math.floor(canvasY), 
            1, 
            1
        );
        const r = imageData.data[0];
        const g = imageData.data[1];
        const b = imageData.data[2];
        const colorHex = this.rgbToHex(r, g, b);
        
        // 计算颜色编号
        const colorNumber = this.getColorNumberFromClick(Math.floor(canvasX), Math.floor(canvasY));
        
        // 更新放大镜中显示的颜色信息
        const colorInfo = this.colorCardMagnifier.querySelector('.magnifier-color-info');
        if (colorInfo) {
            let infoText = colorHex.toUpperCase();
            if (colorNumber) {
                infoText = `色号 #${colorNumber} - ${infoText}`;
            }
            colorInfo.textContent = infoText;
            colorInfo.style.backgroundColor = colorHex;
        }
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
        
        // 更新选项卡颜色
        this.updateTabColor(letter);
        
        // 如果当前显示的是这个字母，更新显示
        if (letter === this.currentSelectingLetter) {
            this.updateCurrentColorDisplay();
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
            this.showToast('导出失败，请重试', 'error');
            console.error('导出错误:', error);
        }
    }

    // 初始化文字配置输入限制
    initTextConfigInputs() {
        const yearInput = document.getElementById('yearInputConfig');
        const wordInput = document.getElementById('wordInputConfig');
        const wordSpaceInput = document.getElementById('wordSpaceInputConfig');
        
        // 设置初始值
        if (yearInput) {
            yearInput.value = this.textConfig.year;
        }
        if (wordInput) {
            wordInput.value = this.textConfig.word;
        }
        if (wordSpaceInput) {
            wordSpaceInput.value = this.textConfig.wordSpace || '';
        }
        
        // 年份输入限制为数字
        if (yearInput) {
            yearInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
                this.textConfig.year = e.target.value;
                // 防抖更新预览
                clearTimeout(this.updateTimer);
                this.updateTimer = setTimeout(() => {
                    this.updatePreview();
                }, 100);
            });
        }
        
        // 单词输入限制为字母
        if (wordInput) {
            wordInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^A-Za-z]/g, '');
                this.textConfig.word = e.target.value;
                // 防抖更新预览
                clearTimeout(this.updateTimer);
                this.updateTimer = setTimeout(() => {
                    this.updatePreview();
                }, 100);
            });
        }
        
        // 单词（空格）输入限制为字母
        if (wordSpaceInput) {
            wordSpaceInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^A-Za-z]/g, '');
                this.textConfig.wordSpace = e.target.value;
                // 防抖更新预览
                clearTimeout(this.updateTimer);
                this.updateTimer = setTimeout(() => {
                    this.updatePreview();
                }, 100);
            });
        }
    }
    
    // 加载字体
    async loadFonts() {
        return new Promise((resolve) => {
            // 使用document.fonts API加载字体
            const stapelFont = new FontFace(
                'Stapel Narrow Extra Bold Italic',
                `url(${encodeURI('assets/fonts/ERASB.TTF')})`
            );
            
            const frestyFont = new FontFace(
                'Fresty Personal Use Only',
                `url(${encodeURI('assets/fonts/Riverside.ttf')})`
            );
            
            Promise.all([stapelFont.load(), frestyFont.load()])
                .then((fonts) => {
                    fonts.forEach(font => {
                        document.fonts.add(font);
                        console.log('字体已添加到文档:', font.family, font.status);
                    });
                    // 等待字体真正可用
                    return document.fonts.ready;
                })
                .then(() => {
                    // 给一点时间让字体完全可用
                    return new Promise(resolve => setTimeout(resolve, 100));
                })
                .then(() => {
                    // 验证字体是否真正加载成功（尝试多种检查方式）
                    const stapelCheck1 = document.fonts.check('20px "Stapel Narrow Extra Bold Italic"');
                    const stapelCheck2 = document.fonts.check('1em "Stapel Narrow Extra Bold Italic"');
                    this.fontsLoaded.stapel = stapelCheck1 || stapelCheck2;
                    
                    const frestyCheck1 = document.fonts.check('30px "Fresty Personal Use Only"');
                    const frestyCheck2 = document.fonts.check('1em "Fresty Personal Use Only"');
                    this.fontsLoaded.fresty = frestyCheck1 || frestyCheck2;
                    
                    // 如果检查失败，检查字体是否在文档中
                    if (!this.fontsLoaded.fresty) {
                        const frestyInFonts = Array.from(document.fonts).some(font => 
                            font.family === 'Fresty Personal Use Only' && font.status === 'loaded'
                        );
                        if (frestyInFonts) {
                            console.log('字体在文档中找到，但check()返回false，将尝试使用');
                            this.fontsLoaded.fresty = true; // 强制设为true，尝试使用
                        }
                    }
                    
                    if (!this.fontsLoaded.stapel) {
                        const stapelInFonts = Array.from(document.fonts).some(font => 
                            font.family === 'Stapel Narrow Extra Bold Italic' && font.status === 'loaded'
                        );
                        if (stapelInFonts) {
                            console.log('Stapel字体在文档中找到，但check()返回false，将尝试使用');
                            this.fontsLoaded.stapel = true;
                        }
                    }
                    
                    console.log('字体加载完成', {
                        stapel: this.fontsLoaded.stapel,
                        fresty: this.fontsLoaded.fresty,
                        allFonts: Array.from(document.fonts).map(f => ({ family: f.family, status: f.status }))
                    });
                    resolve();
                })
                .catch((error) => {
                    console.error('字体加载失败:', error);
                    // 即使字体加载失败，也继续执行
                    resolve();
                });
        });
    }
    
    // 绘制用户配置的文字
    drawUserText() {
        // 原始坐标（基于原始图片尺寸）
        const originalYearX = 780;
        const originalYearY = 400;
        const originalWord1X = 780;
        const originalWord1Y = 418;
        const originalWord2X = 470;
        const originalWord2Y = 515;
        
        // 根据Canvas缩放比例调整坐标
        const yearX = originalYearX * this.canvasScale;
        const yearY = originalYearY * this.canvasScale;
        const word1X = originalWord1X * this.canvasScale;
        const word1Y = originalWord1Y * this.canvasScale;
        const word2X = originalWord2X * this.canvasScale;
        const word2Y = originalWord2Y * this.canvasScale;
        
        // 根据Canvas缩放比例调整字号
        const yearFontSize = 18 * this.canvasScale;
        const word1FontSize = 11 * this.canvasScale;
        const word2FontSize = 22 * this.canvasScale;
        
        // 获取元素B的颜色用于文字渲染
        const textColor = this.currentColors.B || CONFIG.originalColors.B;
        
        // 检查字体是否可用（如果FontFace API失败，尝试使用CSS定义的字体）
        // 即使检查失败，也尝试绘制（有时字体已加载但check()返回false）
        const stapelAvailable = this.fontsLoaded.stapel || 
            document.fonts.check('20px "Stapel Narrow Extra Bold Italic"') ||
            document.fonts.check('1em "Stapel Narrow Extra Bold Italic"');
        const frestyAvailable = this.fontsLoaded.fresty || 
            document.fonts.check('30px "Fresty Personal Use Only"') ||
            document.fonts.check('1em "Fresty Personal Use Only"');
        
        // 绘制年份文字：位置(780, 400)，字体 ERASB.TTF，字号20px，斜体10度，文字间距-0.4
        if (this.textConfig.year && stapelAvailable) {
            this.ctx.save();
            this.ctx.globalCompositeOperation = 'source-over'; // 确保文字在最上层
            this.ctx.font = `${yearFontSize}px "Stapel Narrow Extra Bold Italic"`;
            this.ctx.fillStyle = textColor; // 使用元素B的颜色
            this.ctx.textBaseline = 'top';
            this.ctx.textAlign = 'left';
            
            // 移动到绘制位置并应用斜体变换（10度）
            this.ctx.translate(yearX, yearY);
            const skewX = Math.tan(-10 * Math.PI / 180); // 10度转弧度，计算斜体倾斜值
            this.ctx.transform(1, 0, skewX, 1, 0, 0);
            
            // 文字间距-0.4（字体大小的-0.4倍）
            const letterSpacing = -0.05 * yearFontSize;
            const yearText = this.textConfig.year;
            let currentX = 0;
            
            // 逐个字符绘制，实现文字间距
            for (let i = 0; i < yearText.length; i++) {
                const char = yearText[i];
                this.ctx.fillText(char, currentX, 0);
                // 计算字符宽度并加上间距
                const charWidth = this.ctx.measureText(char).width;
                currentX += charWidth + letterSpacing;
            }
            
            this.ctx.restore();
        } else if (this.textConfig.year) {
            console.warn('年份文字未绘制：字体未加载或内容为空', {
                year: this.textConfig.year,
                stapelLoaded: this.fontsLoaded.stapel,
                stapelAvailable
            });
        }
        
        // 绘制单词第一处：位置(780, 415)，字体 ERASB.TTF，字号16px，首字母大写，斜体10度
        if (this.textConfig.word && stapelAvailable) {
            const capitalizedWord = this.capitalizeFirstLetter(this.textConfig.word);
            this.ctx.save();
            this.ctx.globalCompositeOperation = 'source-over'; // 确保文字在最上层
            this.ctx.font = `${word1FontSize}px "Stapel Narrow Extra Bold Italic"`;
            this.ctx.fillStyle = textColor; // 使用元素B的颜色
            this.ctx.textBaseline = 'top';
            this.ctx.textAlign = 'left';
            
            // 移动到绘制位置并应用斜体变换（10度）
            this.ctx.translate(word1X, word1Y);
            const skewX = Math.tan(-10 * Math.PI / 180); // 10度转弧度，计算斜体倾斜值
            this.ctx.transform(1, 0, skewX, 1, 0, 0);
            
            this.ctx.fillText(capitalizedWord, 0, 0);
            this.ctx.restore();
        } else if (this.textConfig.word) {
            console.warn('单词第一处未绘制：字体未加载或内容为空', {
                word: this.textConfig.word,
                stapelLoaded: this.fontsLoaded.stapel,
                stapelAvailable
            });
        }
        
        // 绘制单词第二处：位置(467, 509)，字体 Riverside.ttf，字号30px，首字母大写
        // 优先使用 wordSpace，如果没有则使用 word
        // 即使字体检查失败，也尝试绘制（字体可能已加载但check()有问题）
        const wordToDraw = (this.textConfig.wordSpace && this.textConfig.wordSpace.trim()) 
            ? this.textConfig.wordSpace 
            : this.textConfig.word;
        
        if (wordToDraw) {
            const capitalizedWord = this.capitalizeFirstLetter(wordToDraw);
            this.ctx.save();
            this.ctx.globalCompositeOperation = 'source-over'; // 确保文字在最上层
            this.ctx.font = `${word2FontSize}px "Fresty Personal Use Only"`;
            this.ctx.fillStyle = textColor; // 使用元素B的颜色
            this.ctx.textBaseline = 'top';
            this.ctx.textAlign = 'left';
            
            // 尝试绘制文字
            try {
                this.ctx.fillText(capitalizedWord, word2X, word2Y);
                // 如果绘制成功但没有字体，可能会回退到默认字体，但至少会显示文字
                if (!frestyAvailable) {
                    console.warn('Fresty字体可能未正确加载，但已尝试绘制文字', {
                        word: capitalizedWord,
                        font: this.ctx.font
                    });
                }
            } catch (error) {
                console.error('绘制单词第二处时出错:', error);
            }
            this.ctx.restore();
        }
    }
    
    // 绘制色卡号列表（竖列排列）
    drawColorNumbers() {
        // 原始坐标（基于原始图片尺寸）
        const originalX = 900;
        const originalY = 640;
        
        // 根据Canvas缩放比例调整坐标
        const x = originalX * this.canvasScale;
        const startY = originalY * this.canvasScale;
        
        // 根据Canvas缩放比例调整字号
        const fontSize = 40 * this.canvasScale;
        
        // 获取A的配色
        const textColor = this.currentColors.F || CONFIG.originalColors.F;
        
        // 检查字体是否可用
        const stapelAvailable = this.fontsLoaded.stapel || 
            document.fonts.check('20px "Stapel Narrow Extra Bold Italic"') ||
            document.fonts.check('1em "Stapel Narrow Extra Bold Italic"');
        
        if (!stapelAvailable) {
            console.warn('Stapel字体未加载，无法绘制色卡号');
            return;
        }
        
        // 设置文字样式
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'source-over'; // 确保文字在最上层
        this.ctx.font = `${fontSize}px "Stapel Narrow Extra Bold Italic"`;
        this.ctx.fillStyle = textColor; // 使用A的配色
        this.ctx.textBaseline = 'top';
        this.ctx.textAlign = 'left';
        
        // 竖列排列所有字母的色卡号
        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
        const lineHeight = fontSize * 1.2; // 行高为字号的1.2倍
        
        letters.forEach((letter, index) => {
            const y = startY + index * lineHeight;
            const colorNumber = this.colorNumbers[letter];
            
            // 如果有色卡号，显示 "A-xx"，否则显示 "A-"（色卡号为空）
            const text = colorNumber ? `${letter} - ${colorNumber}` : `${letter} -`;
            
            this.ctx.fillText(text, x, y);
        });
        
        this.ctx.restore();
    }
    
    // 在坐标(80, 80)处绘制"年份 单词"
    drawYearWord() {
        // 原始坐标（基于原始图片尺寸）
        const originalX = 80;
        const originalY = 80;
        
        // 根据Canvas缩放比例调整坐标
        const x = originalX * this.canvasScale;
        const y = originalY * this.canvasScale;
        
        // 根据Canvas缩放比例调整字号
        const fontSize = 80 * this.canvasScale;
        
        // 获取年份和单词
        const year = this.textConfig.year || '';
        const word = this.textConfig.word || '';
        
        // 如果没有内容，不绘制
        if (!year && !word) {
            return;
        }
        
        // 组合文本：年份 单词
        const text = word ? `${year} ${word}` : year;
        
        // 检查字体是否可用
        const stapelAvailable = this.fontsLoaded.stapel || 
            document.fonts.check('20px "Stapel Narrow Extra Bold Italic"') ||
            document.fonts.check('1em "Stapel Narrow Extra Bold Italic"');
        
        if (!stapelAvailable) {
            console.warn('Stapel字体未加载，无法绘制年份单词');
            return;
        }
        
        // 设置文字样式
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'source-over'; // 确保文字在最上层
        this.ctx.font = `${fontSize}px "Stapel Narrow Extra Bold Italic"`;
        // 使用A的配色（或者根据需求使用其他颜色）
        const textColor = this.currentColors.F || CONFIG.originalColors.F;
        this.ctx.fillStyle = textColor;
        this.ctx.textBaseline = 'top';
        this.ctx.textAlign = 'left';
        
        // 绘制文字
        this.ctx.fillText(text, x, y);
        
        this.ctx.restore();
    }
    
    // 首字母大写
    capitalizeFirstLetter(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }
    
    // 打开生成备注模态框（保留方法以兼容可能的其他调用）
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

    // 生成并复制备注（新方法，直接复制到剪贴板）
    generateAndCopyNote() {
        // 从文字配置区域获取输入
        const yearInput = document.getElementById('yearInputConfig');
        const wordInput = document.getElementById('wordInputConfig');
        
        const year = yearInput ? yearInput.value.trim() : '';
        const word = wordInput ? wordInput.value.trim() : '';

        // 验证年份
        if (!year || year.length !== 4) {
            this.showToast('请输入4位数字年份', 'warning');
            return;
        }

        // 验证单词
        if (!word || word.length === 0) {
            this.showToast('请输入英文单词', 'warning');
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
            this.showToast(`请先为以下颜色选择色卡编号：${missingColors.join(', ')}`, 'warning');
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

        // 直接复制到剪贴板
        this.copyNoteToClipboard(note);
    }
    
    // 生成备注（保留方法以兼容模态框）
    generateNote() {
        const year = document.getElementById('yearInput').value.trim();
        const word = document.getElementById('wordInput').value.trim();
        const noteResult = document.getElementById('noteResult');
        const noteText = document.getElementById('noteText');

        // 验证年份
        if (!year || year.length !== 4) {
            this.showToast('请输入4位数字年份', 'warning');
            return;
        }

        // 验证单词
        if (!word || word.length === 0) {
            this.showToast('请输入英文单词', 'warning');
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
            this.showToast(`请先为以下颜色选择色卡编号：${missingColors.join(', ')}`, 'warning');
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
    
    // 复制备注到剪贴板（新方法，接受参数）
    async copyNoteToClipboard(note) {
        if (!note) {
            this.showToast('备注内容为空', 'warning');
            return;
        }

        try {
            await navigator.clipboard.writeText(note);
            this.showToast('备注已复制到剪贴板！', 'success');
        } catch (error) {
            // 降级方案：使用传统方法
            const textarea = document.createElement('textarea');
            textarea.value = note;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showToast('备注已复制到剪贴板！', 'success');
        }
    }

    // 复制备注到剪贴板
    async copyNote() {
        const noteText = document.getElementById('noteText');
        
        if (!noteText.value) {
            this.showToast('请先生成备注', 'warning');
            return;
        }

        try {
            await navigator.clipboard.writeText(noteText.value);
            this.showToast('备注已复制到剪贴板！', 'success');
        } catch (error) {
            // 降级方案：使用传统方法
            noteText.select();
            document.execCommand('copy');
            this.showToast('备注已复制到剪贴板！', 'success');
        }
    }
}

// 页面加载完成后初始化
let keycapPreview;
document.addEventListener('DOMContentLoaded', () => {
    keycapPreview = new KeycapPreview();
});


