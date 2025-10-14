// HaRiverse Extension - Enhanced Popup Script
class HaRiversePopup {
    constructor() {
        this.currentTab = 'screenshot';
        this.colorHistory = this.loadColorHistory();
        this.isCapturing = false;
        this.isPickingColor = false;
        this.isAnalyzing = false;
        this.currentColor = '#6366f1';
        this.settings = this.loadSettings();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupMessageListener();
        this.updateColorDisplay(this.currentColor);
        this.updateColorPalette();
        this.initializeQRContent();
        console.log('HaRiverse popup v2.0 initialized');
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.closest('.tab-btn').dataset.tab;
                this.switchTab(tab);
            });
        });

        // Screenshot functionality
        const captureBtn = document.getElementById('captureBtn');
        if (captureBtn) {
            captureBtn.addEventListener('click', () => this.captureFullPage());
        }

        // Color picker functionality
        const pickColorBtn = document.getElementById('pickColorBtn');
        if (pickColorBtn) {
            pickColorBtn.addEventListener('click', () => this.pickColor());
        }

        // Copy buttons for color codes
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const copyType = e.target.closest('.copy-btn').dataset.copy;
                this.copyColorCode(copyType);
            });
        });

        // QR Code functionality
        const generateQrBtn = document.getElementById('generateQrBtn');
        if (generateQrBtn) {
            generateQrBtn.addEventListener('click', () => this.generateQRCode());
        }

        const downloadQrBtn = document.getElementById('downloadQrBtn');
        if (downloadQrBtn) {
            downloadQrBtn.addEventListener('click', () => this.downloadQRCode());
        }

        // Video Speed Controller
        this.initVideoSpeedController();

        // Cookie Blocker
        this.initCookieBlocker();

        // Settings functionality
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openSettings());
        }

        const closeSettings = document.getElementById('closeSettings');
        if (closeSettings) {
            closeSettings.addEventListener('click', () => this.closeSettings());
        }

        const saveSettings = document.getElementById('saveSettings');
        if (saveSettings) {
            saveSettings.addEventListener('click', () => this.saveSettings());
        }

        const resetSettings = document.getElementById('resetSettings');
        if (resetSettings) {
            resetSettings.addEventListener('click', () => this.resetSettings());
        }

        // Palette color clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('palette-color')) {
                const color = e.target.dataset.color;
                if (color) {
                    this.updateColorDisplay(color);
                }
            }
        });

        // Modal backdrop click
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target.id === 'settingsModal') {
                    this.closeSettings();
                }
            });
        }

        // Cleanup when popup closes
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'captureProgress') {
                if (message.status) {
                    this.updateStatus(message.status);
                }
                if (message.progress !== undefined) {
                    this.updateProgress(message.progress);
                }
            } else if (message.action === 'cookieBlockerStats') {
                if (message.stats) {
                    this.cookieBlockerStats = message.stats;
                    this.updateCookieBlockerUI();
                }
            }
        });
    }

    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update active tab panel
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        this.currentTab = tabName;
        console.log('Switched to tab:', tabName);
    }

    // ===== SCREENSHOT FUNCTIONALITY =====
    async captureFullPage() {
        if (this.isCapturing) return;
        
        this.isCapturing = true;
        const captureBtn = document.getElementById('captureBtn');
        const progressContainer = document.getElementById('progressContainer');
        
        try {
            captureBtn.disabled = true;
            captureBtn.classList.add('loading');
            progressContainer.classList.remove('hidden');

            // Get settings
            const format = document.getElementById('screenshotFormat').value;
            const quality = document.getElementById('screenshotQuality').value;

            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Send message to background script
            const response = await chrome.runtime.sendMessage({
                action: 'captureFullPage',
                tabId: tab.id,
                format: format,
                quality: quality
            });

            if (response.success) {
                this.updateStatus('Screenshot captured successfully!');
                this.updateProgress(100);
                
                if (this.settings.autoDownload) {
                    await this.downloadImage(response.dataUrl, format);
                }
                
                this.showToast('success', 'Success', 'Screenshot captured successfully!');
            } else {
                throw new Error(response.error || 'Failed to capture screenshot');
            }
        } catch (error) {
            console.error('Screenshot failed:', error);
            this.updateStatus('Failed to capture screenshot');
            this.showToast('error', 'Error', error.message);
        } finally {
            this.resetCaptureUI();
            this.isCapturing = false;
        }
    }

    // ===== COLOR PICKER FUNCTIONALITY =====
    async pickColor() {
        if (this.isPickingColor) return;
        
        this.isPickingColor = true;
        const pickColorBtn = document.getElementById('pickColorBtn');
        
        try {
            pickColorBtn.disabled = true;
            pickColorBtn.classList.add('loading');

            // Try modern EyeDropper API first
            if ('EyeDropper' in window) {
                const eyeDropper = new EyeDropper();
                const result = await eyeDropper.open();
                
                if (result && result.sRGBHex) {
                    this.updateColorDisplay(result.sRGBHex);
                    this.addToColorHistory(result.sRGBHex);
                    this.showToast('success', 'Success', 'Color picked successfully!');
                }
            } else {
                // Fallback to content script
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                const response = await chrome.tabs.sendMessage(tab.id, {
                    action: 'startColorPicker'
                });

                if (response && response.success && response.color) {
                    this.updateColorDisplay(response.color);
                    this.addToColorHistory(response.color);
                    this.showToast('success', 'Success', 'Color picked successfully!');
                } else {
                    throw new Error(response?.error || 'Color picking failed');
                }
            }
        } catch (error) {
            console.error('Color picker failed:', error);
            if (error.name !== 'AbortError') {
                this.showToast('error', 'Error', 'Color picking failed');
            }
        } finally {
            pickColorBtn.disabled = false;
            pickColorBtn.classList.remove('loading');
            this.isPickingColor = false;
        }
    }

    updateColorDisplay(color) {
        this.currentColor = color;
        
        // Update color swatch
        const colorSwatch = document.getElementById('colorSwatch');
        if (colorSwatch) {
            colorSwatch.style.backgroundColor = color;
        }

        // Convert to different formats
        const rgb = this.hexToRgb(color);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

        // Update input fields
        document.getElementById('hexValue').value = color.toUpperCase();
        document.getElementById('rgbValue').value = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        document.getElementById('hslValue').value = `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;
    }

    async copyColorCode(type) {
        let textToCopy = '';
        switch (type) {
            case 'hex':
                textToCopy = document.getElementById('hexValue').value;
                break;
            case 'rgb':
                textToCopy = document.getElementById('rgbValue').value;
                break;
            case 'hsl':
                textToCopy = document.getElementById('hslValue').value;
                break;
        }

        try {
            await navigator.clipboard.writeText(textToCopy);
            this.showToast('success', 'Copied!', `${type.toUpperCase()} color code copied`);
        } catch (error) {
            console.error('Failed to copy:', error);
            this.showToast('error', 'Error', 'Failed to copy color code');
        }
    }

    addToColorHistory(color) {
        // Remove if already exists
        this.colorHistory = this.colorHistory.filter(c => c !== color);
        // Add to beginning
        this.colorHistory.unshift(color);
        // Keep only last 8 colors
        this.colorHistory = this.colorHistory.slice(0, 8);
        // Save and update display
        this.saveColorHistory();
        this.updateColorPalette();
    }

    updateColorPalette() {
        const paletteContainer = document.getElementById('colorPalette');
        if (!paletteContainer) return;

        paletteContainer.innerHTML = '';
        this.colorHistory.forEach(color => {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'palette-color';
            colorDiv.style.backgroundColor = color;
            colorDiv.dataset.color = color;
            colorDiv.title = color;
            paletteContainer.appendChild(colorDiv);
        });
    }

    // ===== QR CODE FUNCTIONALITY =====
    initializeQRContent() {
        const qrContent = document.getElementById('qrContent');
        if (qrContent && !qrContent.value) {
            // Set current page URL as default
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    qrContent.value = tabs[0].url;
                }
            });
        }
    }

    async generateQRCode() {
        const contentInput = document.getElementById('qrContent');
        const sizeSelect = document.getElementById('qrSize');
        const canvas = document.getElementById('qrCanvas');
        const placeholder = document.getElementById('qrPlaceholder');
        const downloadBtn = document.getElementById('downloadQrBtn');

        let content = contentInput ? contentInput.value.trim() : '';
        const size = sizeSelect ? parseInt(sizeSelect.value) : 256;

        // If no content provided, use current page URL
        if (!content) {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab && tab.url) {
                    content = tab.url;
                    if (contentInput) {
                        contentInput.value = content;
                    }
                } else {
                    this.showToast('error', 'Error', 'Please enter content for QR code');
                    return;
                }
            } catch (error) {
                this.showToast('error', 'Error', 'Please enter content for QR code');
                return;
            }
        }

        try {
            // Generate QR code using background script
            const response = await chrome.runtime.sendMessage({
                action: 'generateQRCode',
                content: content,
                size: size
            });

            if (response.success) {
                // Display QR code
                this.displayQRCode(response.dataUrl, canvas, placeholder);
                downloadBtn.classList.remove('hidden');
                this.showToast('success', 'Success', 'QR code generated successfully!');
            } else {
                throw new Error(response.error || 'Failed to generate QR code');
            }
        } catch (error) {
            console.error('QR generation failed:', error);
            this.showToast('error', 'Error', 'Failed to generate QR code');
        }
    }

    displayQRCode(dataUrl, canvas, placeholder) {
        const img = new Image();
        img.onload = () => {
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            canvas.style.display = 'block';
            placeholder.style.display = 'none';
        };
        img.src = dataUrl;
    }

    async downloadQRCode() {
        const canvas = document.getElementById('qrCanvas');
        const formatSelect = document.getElementById('qrFormat');
        const format = formatSelect ? formatSelect.value : 'png';

        if (!canvas || canvas.style.display === 'none') {
            this.showToast('error', 'Error', 'No QR code to download');
            return;
        }

        try {
            const dataUrl = canvas.toDataURL(`image/${format}`);
            await this.downloadImage(dataUrl, format, 'qrcode');
            this.showToast('success', 'Success', 'QR code downloaded successfully!');
        } catch (error) {
            console.error('QR download failed:', error);
            this.showToast('error', 'Error', 'Failed to download QR code');
        }
    }

    // ===== VIDEO SPEED CONTROLLER FUNCTIONALITY =====
    initVideoSpeedController() {
        this.currentSpeed = 1.0;
        this.videoCount = 0;
        this.activeVideo = null;

        // Initialize UI elements
        const speedSlider = document.getElementById('speedSlider');
        const currentSpeedDisplay = document.getElementById('currentSpeed');
        const resetBtn = document.getElementById('resetSpeedBtn');
        const applyAllBtn = document.getElementById('applyToAllBtn');
        const presetBtns = document.querySelectorAll('.preset-btn');
        const speedMarks = document.querySelectorAll('.mark');

        // Slider event listener
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                const speed = parseFloat(e.target.value);
                this.setVideoSpeed(speed);
            });
        }

        // Preset buttons
        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const speed = parseFloat(btn.dataset.speed);
                this.setVideoSpeed(speed);
                if (speedSlider) speedSlider.value = speed;
            });
        });

        // Speed marks (clickable)
        speedMarks.forEach(mark => {
            mark.addEventListener('click', () => {
                const speed = parseFloat(mark.dataset.speed);
                this.setVideoSpeed(speed);
                if (speedSlider) speedSlider.value = speed;
            });
        });

        // Control buttons
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.setVideoSpeed(1.0);
                if (speedSlider) speedSlider.value = 1.0;
            });
        }

        if (applyAllBtn) {
            applyAllBtn.addEventListener('click', () => {
                this.applySpeedToAllVideos();
            });
        }

        // Initialize video detection
        this.detectVideos();
        
        // Set up periodic video detection
        this.videoDetectionInterval = setInterval(() => {
            this.detectVideos();
        }, 2000);
    }

    async setVideoSpeed(speed) {
        this.currentSpeed = speed;
        
        // Update UI
        const currentSpeedDisplay = document.getElementById('currentSpeed');
        if (currentSpeedDisplay) {
            currentSpeedDisplay.textContent = speed.toFixed(2);
        }

        // Update active preset button
        const presetBtns = document.querySelectorAll('.preset-btn');
        presetBtns.forEach(btn => {
            btn.classList.remove('active');
            if (parseFloat(btn.dataset.speed) === speed) {
                btn.classList.add('active');
            }
        });

        try {
            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Try to send message to content script
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'setVideoSpeed',
                    speed: speed
                });
            } catch (messageError) {
                // If content script is not available, inject it first
                console.log('Content script not available, injecting...');
                
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });
                    
                    // Wait a bit for the script to initialize
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Try sending the message again
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'setVideoSpeed',
                        speed: speed
                    });
                } catch (injectionError) {
                    console.error('Failed to inject content script:', injectionError);
                    this.showToast('error', 'Error', 'Cannot control videos on this page');
                    return;
                }
            }

        } catch (error) {
            console.error('Failed to set video speed:', error);
            this.showToast('error', 'Error', 'Failed to change video speed');
        }
    }

    async applySpeedToAllVideos() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'setVideoSpeed',
                    speed: this.currentSpeed,
                    applyToAll: true
                });
                this.showToast('success', 'Success', `Applied ${this.currentSpeed}x speed to all videos`);
            } catch (messageError) {
                // If content script is not available, inject it first
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });
                    
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'setVideoSpeed',
                        speed: this.currentSpeed,
                        applyToAll: true
                    });
                    this.showToast('success', 'Success', `Applied ${this.currentSpeed}x speed to all videos`);
                } catch (injectionError) {
                    this.showToast('error', 'Error', 'Cannot control videos on this page');
                }
            }
        } catch (error) {
            console.error('Failed to apply speed to all videos:', error);
            this.showToast('error', 'Error', 'Failed to apply speed to all videos');
        }
    }

    async detectVideos() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            try {
                const response = await chrome.tabs.sendMessage(tab.id, {
                    action: 'detectVideos'
                });

                if (response && response.success) {
                    this.updateVideoInfo(response.videoCount, response.activeVideo);
                }
            } catch (messageError) {
                // If content script is not available, inject it first
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });
                    
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    const response = await chrome.tabs.sendMessage(tab.id, {
                        action: 'detectVideos'
                    });

                    if (response && response.success) {
                        this.updateVideoInfo(response.videoCount, response.activeVideo);
                    }
                } catch (injectionError) {
                    // Silently handle injection errors for video detection
                    this.updateVideoInfo(0, 'None');
                }
            }
        } catch (error) {
            // Silently handle errors for video detection
            console.log('Video detection failed:', error);
        }
    }

    updateVideoInfo(count, activeVideo) {
        this.videoCount = count;
        this.activeVideo = activeVideo;

        const videoCountEl = document.getElementById('videoCount');
        const activeVideoEl = document.getElementById('activeVideo');

        if (videoCountEl) {
            videoCountEl.textContent = count;
        }

        if (activeVideoEl) {
            activeVideoEl.textContent = activeVideo || 'None';
        }
    }

    // Clean up interval when popup closes
    cleanup() {
        if (this.videoDetectionInterval) {
            clearInterval(this.videoDetectionInterval);
        }
    }

    // ===== COOKIE BLOCKER FUNCTIONALITY =====
    async initCookieBlocker() {
        this.cookieBlockerEnabled = false;
        this.cookieBlockerStats = { blocked: 0, sites: 0 };
        
        // Load saved settings
        await this.loadCookieBlockerSettings();
        
        // Initialize UI elements
        const toggle = document.getElementById('cookieBlockerToggle');
        const status = document.getElementById('cookieBlockerStatus');
        const statsDisplay = document.getElementById('cookieBlockerStats');
        const resetStatsBtn = document.getElementById('resetCookieBlockerStats');
        
        // Toggle event listener
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                this.toggleCookieBlocker(e.target.checked);
            });
        }
        
        // Reset stats button
        if (resetStatsBtn) {
            resetStatsBtn.addEventListener('click', () => {
                this.resetCookieBlockerStats();
            });
        }
        
        // Update UI
        this.updateCookieBlockerUI();
        
        console.log('Cookie blocker initialized');
    }
    
    async loadCookieBlockerSettings() {
        try {
            const result = await chrome.storage.sync.get(['cookieBlockerEnabled', 'cookieBlockerStats']);
            this.cookieBlockerEnabled = result.cookieBlockerEnabled || false;
            this.cookieBlockerStats = result.cookieBlockerStats || { blocked: 0, sites: 0 };
        } catch (error) {
            console.error('Failed to load cookie blocker settings:', error);
        }
    }
    
    async saveCookieBlockerSettings() {
        try {
            await chrome.storage.sync.set({
                cookieBlockerEnabled: this.cookieBlockerEnabled,
                cookieBlockerStats: this.cookieBlockerStats
            });
        } catch (error) {
            console.error('Failed to save cookie blocker settings:', error);
        }
    }
    
    async toggleCookieBlocker(enabled) {
        this.cookieBlockerEnabled = enabled;
        await this.saveCookieBlockerSettings();
        
        // Send message to background script to enable/disable cookie blocker
        try {
            await chrome.runtime.sendMessage({
                action: 'toggleCookieBlocker',
                enabled: enabled
            });
            
            this.updateCookieBlockerUI();
            
            const message = enabled ? 'Cookie blocker enabled' : 'Cookie blocker disabled';
            this.showToast('success', 'Cookie Blocker', message);
            
        } catch (error) {
            console.error('Failed to toggle cookie blocker:', error);
            this.showToast('error', 'Error', 'Failed to toggle cookie blocker');
        }
    }
    
    updateCookieBlockerUI() {
        const toggle = document.getElementById('cookieBlockerToggle');
        const status = document.getElementById('cookieBlockerStatus');
        const statsDisplay = document.getElementById('cookieBlockerStats');
        const resetStatsBtn = document.getElementById('resetCookieBlockerStats');
        
        if (toggle) {
            toggle.checked = this.cookieBlockerEnabled;
        }
        
        if (status) {
            status.textContent = this.cookieBlockerEnabled ? 'Enabled' : 'Disabled';
            status.className = `cookie-blocker-status ${this.cookieBlockerEnabled ? 'enabled' : 'disabled'}`;
        }
        
        if (statsDisplay) {
            const { blocked, sites } = this.cookieBlockerStats;
            statsDisplay.textContent = `Blocked: ${blocked} banners on ${sites} sites`;
        }
        
        if (resetStatsBtn) {
            const hasStats = this.cookieBlockerStats.blocked > 0 || this.cookieBlockerStats.sites > 0;
            resetStatsBtn.classList.toggle('hidden', !hasStats);
        }
    }
    
    async resetCookieBlockerStats() {
        this.cookieBlockerStats = { blocked: 0, sites: 0 };
        await this.saveCookieBlockerSettings();
        this.updateCookieBlockerUI();
        this.showToast('success', 'Cookie Blocker', 'Statistics reset');
    }
    
    async updateCookieBlockerStats(blocked, site) {
        this.cookieBlockerStats.blocked += blocked;
        if (site && !this.cookieBlockerStats.sites.includes?.(site)) {
            this.cookieBlockerStats.sites += 1;
        }
        await this.saveCookieBlockerSettings();
        this.updateCookieBlockerUI();
    }

    // ===== SETTINGS FUNCTIONALITY =====
    openSettings() {
        const modal = document.getElementById('settingsModal');
        const themeSelect = document.getElementById('themeSelect');
        const formatSelect = document.getElementById('defaultFormat');
        const autoDownload = document.getElementById('autoDownload');

        if (themeSelect) themeSelect.value = this.settings.theme;
        if (formatSelect) formatSelect.value = this.settings.defaultFormat;
        if (autoDownload) autoDownload.checked = this.settings.autoDownload;

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
        const autoDownload = document.getElementById('autoDownload');

        if (themeSelect) this.settings.theme = themeSelect.value;
        if (formatSelect) this.settings.defaultFormat = formatSelect.value;
        if (autoDownload) this.settings.autoDownload = autoDownload.checked;

        this.saveSettingsToStorage();
        this.showToast('success', 'Success', 'Settings saved successfully!');
        this.closeSettings();
    }

    resetSettings() {
        this.settings = {
            theme: 'auto',
            defaultFormat: 'png',
            autoDownload: true
        };
        
        this.saveSettingsToStorage();
        this.openSettings(); // Refresh the modal
        this.showToast('info', 'Reset', 'Settings reset to default');
    }

    // ===== UTILITY FUNCTIONS =====
    async downloadImage(dataUrl, format, filename = 'screenshot') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const finalFilename = `hariverse_${filename}_${timestamp}.${format}`;

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'downloadImage',
                dataUrl: dataUrl,
                filename: finalFilename
            });

            if (!response.success) {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Download failed:', error);
            // Fallback: create download link
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = finalFilename;
            link.click();
        }
    }

    updateProgress(percent) {
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }
    }

    updateStatus(message) {
        const statusElement = document.getElementById('screenshotStatus');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    resetCaptureUI() {
        const captureBtn = document.getElementById('captureBtn');
        const progressContainer = document.getElementById('progressContainer');
        
        if (captureBtn) {
            captureBtn.disabled = false;
            captureBtn.classList.remove('loading');
        }
        
        if (progressContainer) {
            progressContainer.classList.add('hidden');
        }
        
        this.updateProgress(0);
    }

    showToast(type, title, message) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${this.getToastIcon(type)}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">&times;</button>
        `;

        // Add close functionality
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });

        container.appendChild(toast);

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 3000);
    }

    getToastIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };
        return icons[type] || 'ℹ️';
    }

    // Color utility functions
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
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
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    // Storage functions
    loadColorHistory() {
        const stored = localStorage.getItem('hariverse-color-history');
        return stored ? JSON.parse(stored) : [
            '#6366f1', '#8b5cf6', '#ec4899', '#10b981', 
            '#f59e0b', '#ef4444', '#84cc16', '#06b6d4'
        ];
    }

    saveColorHistory() {
        localStorage.setItem('hariverse-color-history', JSON.stringify(this.colorHistory));
    }

    loadSettings() {
        const stored = localStorage.getItem('hariverse-settings');
        return stored ? JSON.parse(stored) : {
            theme: 'auto',
            defaultFormat: 'png',
            autoDownload: true
        };
    }

    saveSettingsToStorage() {
        localStorage.setItem('hariverse-settings', JSON.stringify(this.settings));
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new HaRiversePopup();
});