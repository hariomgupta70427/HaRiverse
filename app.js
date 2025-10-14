class HaRiverseApp {
    constructor() {
        this.currentTab = 'screenshot';
        this.colorHistory = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#84cc16', '#06b6d4'];
        this.isCapturing = false;
        this.isPickingColor = false;
        this.isMeasuring = false;
        this.settings = {
            theme: 'auto',
            defaultFormat: 'png',
            quality: 'high'
        };
        
        this.init();
    }

    init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupApp();
            });
        } else {
            this.setupApp();
        }
    }

    setupApp() {
        this.loadSettings();
        this.bindEvents();
        this.initializeQRContent();
        this.updateColorDisplay('#6366f1');
        this.updateColorPalette();
        console.log('HaRiverse app initialized');
    }

    bindEvents() {
        // Tab navigation
        const tabButtons = document.querySelectorAll('.tab-btn');
        console.log('Found tab buttons:', tabButtons.length);
        
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = e.currentTarget.getAttribute('data-tab');
                console.log('Tab clicked:', tab);
                this.switchTab(tab);
            });
        });

        // Screenshot functionality
        const captureBtn = document.getElementById('captureBtn');
        if (captureBtn) {
            captureBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Capture button clicked');
                this.captureFullPage();
            });
        }

        // Color picker functionality
        const pickColorBtn = document.getElementById('pickColorBtn');
        if (pickColorBtn) {
            pickColorBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Pick color button clicked');
                this.pickColor();
            });
        }

        // Copy color codes
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const copyType = e.currentTarget.getAttribute('data-copy');
                this.copyColorCode(copyType);
            });
        });

        // Color palette clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('palette-color')) {
                const color = e.target.getAttribute('data-color');
                if (color) {
                    this.updateColorDisplay(color);
                }
            }
        });

        // Page ruler functionality
        const startRulerBtn = document.getElementById('startRulerBtn');
        if (startRulerBtn) {
            startRulerBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.startRuler();
            });
        }

        // QR code functionality
        const generateQrBtn = document.getElementById('generateQrBtn');
        if (generateQrBtn) {
            generateQrBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.generateQRCode();
            });
        }

        const downloadQrBtn = document.getElementById('downloadQrBtn');
        if (downloadQrBtn) {
            downloadQrBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.downloadQRCode();
            });
        }

        // Settings modal
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openSettings();
            });
        }

        const closeSettings = document.getElementById('closeSettings');
        if (closeSettings) {
            closeSettings.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeSettings();
            });
        }

        const saveSettings = document.getElementById('saveSettings');
        if (saveSettings) {
            saveSettings.addEventListener('click', (e) => {
                e.preventDefault();
                this.saveSettings();
            });
        }

        const resetSettings = document.getElementById('resetSettings');
        if (resetSettings) {
            resetSettings.addEventListener('click', (e) => {
                e.preventDefault();
                this.resetSettings();
            });
        }

        // Modal backdrop click
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target.id === 'settingsModal') {
                    this.closeSettings();
                }
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case '1':
                        e.preventDefault();
                        this.switchTab('screenshot');
                        break;
                    case '2':
                        e.preventDefault();
                        this.switchTab('colorpicker');
                        break;
                    case '3':
                        e.preventDefault();
                        this.switchTab('ruler');
                        break;
                    case '4':
                        e.preventDefault();
                        this.switchTab('qr');
                        break;
                }
            }
        });
    }

    switchTab(tabName) {
        console.log('Switching to tab:', tabName);
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeTabBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTabBtn) {
            activeTabBtn.classList.add('active');
        }

        // Update tab panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        const activePanel = document.getElementById(tabName);
        if (activePanel) {
            activePanel.classList.add('active');
        }

        this.currentTab = tabName;
        console.log('Tab switched to:', tabName);
    }

    async captureFullPage() {
        if (this.isCapturing) return;

        console.log('Starting screenshot capture');
        this.isCapturing = true;
        const btn = document.getElementById('captureBtn');
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const status = document.getElementById('screenshotStatus');

        if (btn) {
            btn.classList.add('loading');
            btn.disabled = true;
        }
        
        if (progressContainer) {
            progressContainer.classList.remove('hidden');
        }
        
        if (status) {
            status.textContent = '';
            status.className = 'feature-status';
        }

        try {
            // Simulate screenshot capture process
            const steps = [
                'Preparing capture...',
                'Analyzing page structure...',
                'Capturing visible area...',
                'Scrolling and capturing...',
                'Processing images...',
                'Generating final image...',
                'Preparing download...'
            ];

            for (let i = 0; i < steps.length; i++) {
                if (progressText) {
                    progressText.textContent = steps[i];
                }
                if (progressFill) {
                    progressFill.style.width = `${((i + 1) / steps.length) * 100}%`;
                }
                await this.delay(400);
            }

            // Get selected format and quality
            const formatSelect = document.getElementById('screenshotFormat');
            const qualitySelect = document.getElementById('screenshotQuality');
            const format = formatSelect ? formatSelect.value : 'png';
            const quality = qualitySelect ? qualitySelect.value : 'high';

            // Create a demo canvas and download
            await this.createDemoScreenshot(format, quality);

            if (status) {
                status.textContent = `Screenshot captured successfully in ${format.toUpperCase()} format!`;
                status.className = 'feature-status success';
            }

            this.showToast('success', 'Screenshot Captured', `Full page screenshot saved as ${format.toUpperCase()}`);

        } catch (error) {
            console.error('Screenshot error:', error);
            if (status) {
                status.textContent = 'Failed to capture screenshot. Please try again.';
                status.className = 'feature-status error';
            }
            this.showToast('error', 'Capture Failed', 'Unable to capture screenshot');
        } finally {
            if (btn) {
                btn.classList.remove('loading');
                btn.disabled = false;
            }
            this.isCapturing = false;
            
            setTimeout(() => {
                if (progressContainer) {
                    progressContainer.classList.add('hidden');
                }
            }, 1000);
        }
    }

    async createDemoScreenshot(format, quality) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set dimensions based on quality
        const dimensions = {
            high: [1920, 1080],
            medium: [1280, 720],
            low: [854, 480]
        };
        
        const [width, height] = dimensions[quality] || dimensions.high;
        canvas.width = width;
        canvas.height = height;

        // Create a demo screenshot
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#6366f1');
        gradient.addColorStop(0.5, '#8b5cf6');
        gradient.addColorStop(1, '#ec4899');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Add some demo content
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(50, 50, width - 100, height - 100);
        
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('HaRiverse Extension', width / 2, height / 2 - 50);
        
        ctx.font = '24px Arial';
        ctx.fillText('Demo Screenshot Capture', width / 2, height / 2);
        
        ctx.font = '18px Arial';
        ctx.fillText(`Format: ${format.toUpperCase()} | Quality: ${quality}`, width / 2, height / 2 + 50);
        
        ctx.fillText(`Timestamp: ${new Date().toLocaleString()}`, width / 2, height / 2 + 80);

        // Download the image
        return new Promise((resolve) => {
            const callback = (blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `hariverse-screenshot-${Date.now()}.${format}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                resolve();
            };

            if (format === 'pdf') {
                // For PDF, we'd use a library like jsPDF, but for demo purposes just use PNG
                canvas.toBlob(callback, 'image/png');
            } else {
                const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
                canvas.toBlob(callback, mimeType, format === 'jpg' ? 0.9 : 1);
            }
        });
    }

    async pickColor() {
        if (this.isPickingColor) return;

        console.log('Starting color picker');
        const btn = document.getElementById('pickColorBtn');
        if (btn) {
            btn.classList.add('loading');
            btn.disabled = true;
        }
        this.isPickingColor = true;

        try {
            let color = null;

            // Try to use the modern EyeDropper API
            if ('EyeDropper' in window) {
                const eyeDropper = new EyeDropper();
                const result = await eyeDropper.open();
                color = result.sRGBHex;
            } else {
                // Fallback: simulate color picking
                await this.delay(1000);
                const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd', '#98d8c8', '#f7dc6f'];
                color = colors[Math.floor(Math.random() * colors.length)];
                this.showToast('info', 'Demo Mode', 'Color picker simulated - random color selected');
            }

            if (color) {
                this.updateColorDisplay(color);
                this.addToColorHistory(color);
                this.showToast('success', 'Color Picked', `Color ${color} copied to palette`);
            }

        } catch (error) {
            console.error('Color picker error:', error);
            if (error.name !== 'AbortError') {
                this.showToast('error', 'Color Pick Failed', 'Unable to pick color from page');
            }
        } finally {
            if (btn) {
                btn.classList.remove('loading');
                btn.disabled = false;
            }
            this.isPickingColor = false;
        }
    }

    updateColorDisplay(hexColor) {
        const rgb = this.hexToRgb(hexColor);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

        const colorSwatch = document.getElementById('colorSwatch');
        const hexValue = document.getElementById('hexValue');
        const rgbValue = document.getElementById('rgbValue');
        const hslValue = document.getElementById('hslValue');

        if (colorSwatch) colorSwatch.style.backgroundColor = hexColor;
        if (hexValue) hexValue.value = hexColor;
        if (rgbValue) rgbValue.value = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        if (hslValue) hslValue.value = `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;
    }

    addToColorHistory(color) {
        if (!this.colorHistory.includes(color)) {
            this.colorHistory.unshift(color);
            if (this.colorHistory.length > 8) {
                this.colorHistory.pop();
            }
            this.updateColorPalette();
        }
    }

    updateColorPalette() {
        const palette = document.getElementById('colorPalette');
        if (!palette) return;
        
        palette.innerHTML = '';
        
        this.colorHistory.forEach(color => {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'palette-color';
            colorDiv.style.backgroundColor = color;
            colorDiv.setAttribute('data-color', color);
            palette.appendChild(colorDiv);
        });
    }

    copyColorCode(type) {
        const inputs = {
            hex: document.getElementById('hexValue'),
            rgb: document.getElementById('rgbValue'),
            hsl: document.getElementById('hslValue')
        };

        const input = inputs[type];
        if (input && input.value) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(input.value).then(() => {
                    this.showToast('success', 'Copied!', `${type.toUpperCase()} color code copied to clipboard`);
                }).catch(() => {
                    this.fallbackCopy(input);
                });
            } else {
                this.fallbackCopy(input);
            }
        }
    }

    fallbackCopy(input) {
        try {
            input.select();
            input.setSelectionRange(0, 99999); // For mobile devices
            document.execCommand('copy');
            this.showToast('success', 'Copied!', 'Color code copied to clipboard');
        } catch (err) {
            this.showToast('error', 'Copy Failed', 'Could not copy to clipboard');
        }
    }

    startRuler() {
        const btn = document.getElementById('startRulerBtn');
        
        if (this.isMeasuring) {
            this.stopRuler();
            return;
        }

        if (btn) {
            btn.innerHTML = '<span class="btn-icon">🛑</span>Stop Measuring';
            btn.classList.add('btn--secondary');
        }
        this.isMeasuring = true;

        // Simulate measurements
        this.simulateRulerMeasurements();
        
        this.showToast('info', 'Ruler Active', 'Click anywhere on the page to measure elements');
    }

    stopRuler() {
        const btn = document.getElementById('startRulerBtn');
        if (btn) {
            btn.innerHTML = '<span class="btn-icon">📏</span>Start Measuring';
            btn.classList.remove('btn--secondary');
        }
        this.isMeasuring = false;
    }

    simulateRulerMeasurements() {
        if (!this.isMeasuring) return;

        const widthEl = document.getElementById('measureWidth');
        const heightEl = document.getElementById('measureHeight');
        const distanceEl = document.getElementById('measureDistance');
        const unitSelect = document.getElementById('rulerUnit');
        const unit = unitSelect ? unitSelect.value : 'px';

        // Generate random measurements for demo
        const width = Math.floor(Math.random() * 500) + 100;
        const height = Math.floor(Math.random() * 300) + 50;
        const distance = Math.floor(Math.random() * 200) + 25;

        if (widthEl) widthEl.textContent = `${width}${unit}`;
        if (heightEl) heightEl.textContent = `${height}${unit}`;
        if (distanceEl) distanceEl.textContent = `${distance}${unit}`;

        if (this.isMeasuring) {
            setTimeout(() => this.simulateRulerMeasurements(), 2000);
        }
    }

    generateQRCode() {
        const contentInput = document.getElementById('qrContent');
        const sizeSelect = document.getElementById('qrSize');
        const canvas = document.getElementById('qrCanvas');
        const placeholder = document.querySelector('.qr-placeholder');
        const downloadBtn = document.getElementById('downloadQrBtn');

        const content = contentInput ? contentInput.value.trim() : '';
        const size = sizeSelect ? parseInt(sizeSelect.value) : 256;

        if (!content) {
            this.showToast('error', 'No Content', 'Please enter text or URL to generate QR code');
            return;
        }

        // Simple QR code simulation using canvas
        if (canvas) {
            this.createSimpleQR(canvas, content, size);
            canvas.style.display = 'block';
        }
        
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        
        if (downloadBtn) {
            downloadBtn.classList.remove('hidden');
        }

        this.showToast('success', 'QR Generated', 'QR code created successfully');
    }

    createSimpleQR(canvas, content, size) {
        const ctx = canvas.getContext('2d');
        canvas.width = size;
        canvas.height = size;

        // Create a simple QR-like pattern for demo
        const moduleSize = size / 25;
        
        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        
        // Pattern
        ctx.fillStyle = '#000000';
        
        // Create a pseudo-random pattern based on content
        let seed = 0;
        for (let i = 0; i < content.length; i++) {
            seed += content.charCodeAt(i);
        }
        
        const random = (seed) => {
            const x = Math.sin(seed) * 10000;
            return x - Math.floor(x);
        };

        // Draw finder patterns (corners)
        this.drawFinderPattern(ctx, 0, 0, moduleSize);
        this.drawFinderPattern(ctx, size - 7 * moduleSize, 0, moduleSize);
        this.drawFinderPattern(ctx, 0, size - 7 * moduleSize, moduleSize);

        // Draw data pattern
        for (let i = 0; i < 25; i++) {
            for (let j = 0; j < 25; j++) {
                if (this.isFinderArea(i, j)) continue;
                
                if (random(seed + i * 25 + j) > 0.5) {
                    ctx.fillRect(i * moduleSize, j * moduleSize, moduleSize, moduleSize);
                }
            }
        }
    }

    drawFinderPattern(ctx, x, y, moduleSize) {
        // Outer black square
        ctx.fillRect(x, y, 7 * moduleSize, 7 * moduleSize);
        // Inner white square
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + moduleSize, y + moduleSize, 5 * moduleSize, 5 * moduleSize);
        // Center black square
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 2 * moduleSize, y + 2 * moduleSize, 3 * moduleSize, 3 * moduleSize);
    }

    isFinderArea(i, j) {
        return (i < 9 && j < 9) || (i > 15 && j < 9) || (i < 9 && j > 15);
    }

    downloadQRCode() {
        const canvas = document.getElementById('qrCanvas');
        if (!canvas) return;
        
        const link = document.createElement('a');
        link.download = `qr-code-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
        
        this.showToast('success', 'Downloaded', 'QR code image saved');
    }

    initializeQRContent() {
        const qrContent = document.getElementById('qrContent');
        if (qrContent && !qrContent.value) {
            qrContent.value = window.location.href;
        }
    }

    openSettings() {
        const modal = document.getElementById('settingsModal');
        const themeSelect = document.getElementById('themeSelect');
        const formatSelect = document.getElementById('defaultFormat');

        if (themeSelect) themeSelect.value = this.settings.theme;
        if (formatSelect) formatSelect.value = this.settings.defaultFormat;

        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    closeSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    saveSettings() {
        const themeSelect = document.getElementById('themeSelect');
        const formatSelect = document.getElementById('defaultFormat');

        if (themeSelect) this.settings.theme = themeSelect.value;
        if (formatSelect) this.settings.defaultFormat = formatSelect.value;

        // Save to localStorage (simulated)
        this.showToast('success', 'Settings Saved', 'Your preferences have been updated');
        this.closeSettings();
    }

    resetSettings() {
        this.settings = {
            theme: 'auto',
            defaultFormat: 'png',
            quality: 'high'
        };
        
        const themeSelect = document.getElementById('themeSelect');
        const formatSelect = document.getElementById('defaultFormat');
        
        if (themeSelect) themeSelect.value = 'auto';
        if (formatSelect) formatSelect.value = 'png';
        
        this.showToast('info', 'Settings Reset', 'All settings restored to default');
    }

    loadSettings() {
        // In a real extension, this would load from chrome.storage
        // For demo, we'll use the default settings
    }

    showToast(type, title, message) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };

        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;

        container.appendChild(toast);

        // Auto remove after 4 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideIn 0.3s reverse';
                setTimeout(() => {
                    if (toast.parentNode) {
                        container.removeChild(toast);
                    }
                }, 300);
            }
        }, 4000);
    }

    // Utility functions
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

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
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return {
            h: h * 360,
            s: s * 100,
            l: l * 100
        };
    }
}

// Initialize the app
const app = new HaRiverseApp();