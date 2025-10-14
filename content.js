// HaRiverse Extension - Enhanced Content Script

console.log('HaRiverse content script v2.0 loaded');

class HaRiverseContent {
    constructor() {
        this.isColorPickerActive = false;
        this.colorPickerOverlay = null;
        this.colorPickerCursor = null;
        this.colorPickerEventListeners = null;
        this.currentVideoSpeed = 1.0;
        this.activeVideo = null;
        this.videos = [];
        this.keyboardHandler = null;
        this.init();
    }

    init() {
        this.setupMessageListener();
        
        // Wait for DOM to be ready before initializing UI elements
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeUI();
            });
        } else {
            this.initializeUI();
        }
        
        console.log('HaRiverse content script v2.0 initialized');
    }
    
    initializeUI() {
        this.createColorPickerOverlay();
        this.setupVideoClickListeners();
        this.initCookieBlocker();
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('HaRiverse content script received message:', message);
            
            switch (message.action) {
                case 'startColorPicker':
                    this.startColorPicker().then(sendResponse);
                    return true;
                case 'setVideoSpeed':
                    console.log('Processing setVideoSpeed request:', message.speed, message.applyToAll);
                    this.setVideoSpeed(message.speed, message.applyToAll).then(sendResponse);
                    return true;
                case 'detectVideos':
                    console.log('Processing detectVideos request');
                    const result = this.detectVideos();
                    console.log('detectVideos result:', result);
                    sendResponse(result);
                    break;
                case 'getPageInfo':
                    sendResponse(this.getPageInfo());
                    break;
                default:
                    console.log('Unknown action:', message.action);
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        });
    }

    // ===== COLOR PICKER FUNCTIONALITY =====
    createColorPickerOverlay() {
        this.colorPickerOverlay = document.createElement('div');
        this.colorPickerOverlay.id = 'hariverse-color-picker-overlay';
        this.colorPickerOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(2px);
            z-index: 2147483647;
            cursor: crosshair;
            display: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        // Create color preview cursor
        this.colorPickerCursor = document.createElement('div');
        this.colorPickerCursor.id = 'hariverse-color-cursor';
        this.colorPickerCursor.style.cssText = `
            position: fixed;
            width: 40px;
            height: 40px;
            border: 3px solid white;
            border-radius: 50%;
            pointer-events: none;
            z-index: 2147483648;
            box-shadow: 0 0 0 1px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.4);
            display: none;
            transform: translate(-50%, -50%);
        `;

        // Create instruction text
        const instructionText = document.createElement('div');
        instructionText.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 2147483648;
            backdrop-filter: blur(10px);
        `;
        instructionText.textContent = 'Click on any element to pick its color • Press ESC to cancel';

        this.colorPickerOverlay.appendChild(instructionText);
        
        // Ensure document.body exists before appending
        if (document.body) {
            document.body.appendChild(this.colorPickerOverlay);
            document.body.appendChild(this.colorPickerCursor);
        } else {
            console.warn('Document body not available for color picker overlay');
        }
    }

    async startColorPicker() {
        console.log('Starting manual color picker...');
        
        // Check if EyeDropper API is available
        if ('EyeDropper' in window) {
            try {
                const eyeDropper = new EyeDropper();
                const result = await eyeDropper.open();
                return { success: true, color: result.sRGBHex };
            } catch (error) {
                if (error.name === 'AbortError') {
                    return { success: false, error: 'Color picking cancelled' };
                }
                console.error('EyeDropper failed:', error);
                return await this.startManualColorPicker();
            }
        } else {
            return await this.startManualColorPicker();
        }
    }

    async startManualColorPicker() {
        return new Promise((resolve) => {
            this.isColorPickerActive = true;
            this.colorPickerOverlay.style.display = 'block';
            this.colorPickerCursor.style.display = 'block';

            const handleMouseMove = (e) => {
                this.colorPickerCursor.style.left = e.clientX + 'px';
                this.colorPickerCursor.style.top = e.clientY + 'px';

                const elementUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
                if (elementUnderCursor && elementUnderCursor !== this.colorPickerOverlay) {
                    const computedStyle = window.getComputedStyle(elementUnderCursor);
                    const backgroundColor = computedStyle.backgroundColor;
                    if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'transparent') {
                        this.colorPickerCursor.style.backgroundColor = backgroundColor;
                    }
                }
            };

            const handleClick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                this.colorPickerOverlay.style.display = 'none';
                const elementUnderClick = document.elementFromPoint(e.clientX, e.clientY);
                this.colorPickerOverlay.style.display = 'block';

                if (elementUnderClick) {
                    const computedStyle = window.getComputedStyle(elementUnderClick);
                    let color = computedStyle.backgroundColor;

                    if (!color || color === 'rgba(0, 0, 0, 0)' || color === 'transparent') {
                        color = computedStyle.color || '#000000';
                    }

                    const hexColor = this.rgbToHex(color);
                    this.stopColorPicker();
                    resolve({ success: true, color: hexColor || color });
                } else {
                    this.stopColorPicker();
                    resolve({ success: false, error: 'No color found' });
                }
            };

            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    this.stopColorPicker();
                    resolve({ success: false, error: 'Color picking cancelled' });
                }
            };

            this.colorPickerOverlay.addEventListener('mousemove', handleMouseMove);
            this.colorPickerOverlay.addEventListener('click', handleClick);
            document.addEventListener('keydown', handleKeydown);

            this.colorPickerEventListeners = {
                handleMouseMove,
                handleClick,
                handleKeydown
            };
        });
    }

    stopColorPicker() {
        this.isColorPickerActive = false;
        this.colorPickerOverlay.style.display = 'none';
        this.colorPickerCursor.style.display = 'none';

        if (this.colorPickerEventListeners) {
            this.colorPickerOverlay.removeEventListener('mousemove', this.colorPickerEventListeners.handleMouseMove);
            this.colorPickerOverlay.removeEventListener('click', this.colorPickerEventListeners.handleClick);
            document.removeEventListener('keydown', this.colorPickerEventListeners.handleKeydown);
            this.colorPickerEventListeners = null;
        }
    }

    // ===== VIDEO SPEED CONTROLLER FUNCTIONALITY =====
    async setVideoSpeed(speed, applyToAll = false) {
        console.log(`Setting video speed to ${speed}x`, applyToAll ? '(all videos)' : '(active video)');
        
        try {
            this.currentVideoSpeed = speed;
            const videos = this.getAllVideos();
            console.log('Found videos:', videos.length, videos);
            
            if (videos.length === 0) {
                console.log('No videos found on this page');
                return {
                    success: false,
                    error: 'No videos found on this page'
                };
            }

            let appliedCount = 0;

            if (applyToAll) {
                // Apply to all videos
                videos.forEach((video, index) => {
                    if (video && video.playbackRate !== undefined) {
                        console.log(`Setting speed for video ${index + 1}:`, video);
                        video.playbackRate = speed;
                        appliedCount++;
                    }
                });
            } else {
                // Apply to active video or first video found
                const targetVideo = this.activeVideo || videos[0];
                if (targetVideo && targetVideo.playbackRate !== undefined) {
                    console.log('Setting speed for target video:', targetVideo);
                    targetVideo.playbackRate = speed;
                    this.activeVideo = targetVideo;
                    appliedCount = 1;
                }
            }

            // Add keyboard shortcuts
            this.setupKeyboardShortcuts();

            console.log(`Successfully applied speed to ${appliedCount} videos`);
            return {
                success: true,
                appliedCount: appliedCount,
                totalVideos: videos.length
            };

        } catch (error) {
            console.error('Failed to set video speed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    detectVideos() {
        const videos = this.getAllVideos();
        this.videos = videos;
        
        // Determine active video (currently playing or first video)
        let activeVideoInfo = 'None';
        const playingVideo = videos.find(video => !video.paused);
        
        if (playingVideo) {
            activeVideoInfo = this.getVideoInfo(playingVideo);
            this.activeVideo = playingVideo;
        } else if (videos.length > 0) {
            activeVideoInfo = this.getVideoInfo(videos[0]);
            this.activeVideo = videos[0];
        }

        return {
            success: true,
            videoCount: videos.length,
            activeVideo: activeVideoInfo
        };
    }

    getAllVideos() {
        // Get all video elements including those in iframes
        const videos = [];
        
        // Direct video elements
        const directVideos = document.querySelectorAll('video');
        directVideos.forEach(video => videos.push(video));
        
        // YouTube videos (try to access iframe content)
        try {
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                try {
                    if (iframe.contentDocument) {
                        const iframeVideos = iframe.contentDocument.querySelectorAll('video');
                        iframeVideos.forEach(video => videos.push(video));
                    }
                } catch (e) {
                    // Cross-origin iframe, can't access content
                }
            });
        } catch (e) {
            console.log('Could not access iframe videos:', e);
        }

        // Special handling for YouTube
        if (window.location.hostname.includes('youtube.com')) {
            const ytPlayer = document.querySelector('#movie_player video, .html5-video-player video, .video-stream');
            if (ytPlayer && !videos.includes(ytPlayer)) {
                videos.push(ytPlayer);
            }
        }

        // Special handling for Vimeo
        if (window.location.hostname.includes('vimeo.com')) {
            const vimeoPlayer = document.querySelector('.vp-video video, video');
            if (vimeoPlayer && !videos.includes(vimeoPlayer)) {
                videos.push(vimeoPlayer);
            }
        }

        return videos.filter(video => video && video.tagName === 'VIDEO');
    }

    getVideoInfo(video) {
        if (!video) return 'None';
        
        // Try to get video title or source info
        let info = 'Video';
        
        if (video.title) {
            info = video.title;
        } else if (video.src) {
            const url = new URL(video.src);
            info = url.pathname.split('/').pop() || 'Video';
        } else if (video.currentSrc) {
            const url = new URL(video.currentSrc);
            info = url.pathname.split('/').pop() || 'Video';
        }
        
        // Add playing status
        if (!video.paused) {
            info += ' (Playing)';
        }
        
        return info.length > 30 ? info.substring(0, 30) + '...' : info;
    }

    setupKeyboardShortcuts() {
        // Remove existing listener if any
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
        }

        this.keyboardHandler = (e) => {
            // Only work when not typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
                return;
            }

            if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                const newSpeed = Math.max(0.25, this.currentVideoSpeed - 0.25);
                this.setVideoSpeed(newSpeed);
            } else if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                const newSpeed = Math.min(5, this.currentVideoSpeed + 0.25);
                this.setVideoSpeed(newSpeed);
            }
        };

        document.addEventListener('keydown', this.keyboardHandler);
    }

    // Add click listeners to videos to make them active
    setupVideoClickListeners() {
        const videos = this.getAllVideos();
        videos.forEach(video => {
            video.addEventListener('click', () => {
                this.activeVideo = video;
                console.log('Active video changed:', this.getVideoInfo(video));
            });
        });
    }

    // ===== PAGE INFO FUNCTIONALITY =====
    getPageInfo() {
        const images = document.querySelectorAll('img');
        const links = document.querySelectorAll('a');
        const scripts = document.querySelectorAll('script');
        const styles = document.querySelectorAll('link[rel="stylesheet"], style');

        return {
            title: document.title,
            url: window.location.href,
            width: Math.max(
                document.documentElement.scrollWidth,
                document.documentElement.offsetWidth,
                document.documentElement.clientWidth
            ),
            height: Math.max(
                document.documentElement.scrollHeight,
                document.documentElement.offsetHeight,
                document.documentElement.clientHeight
            ),
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            imageCount: images.length,
            linkCount: links.length,
            scriptCount: scripts.length,
            styleCount: styles.length,
            scrollY: window.pageYOffset,
            scrollX: window.pageXOffset,
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            pathname: window.location.pathname
        };
    }

    // ===== UTILITY FUNCTIONS =====
    rgbToHex(rgb) {
        if (!rgb) return null;
        
        const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!match) return null;

        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);

        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Create performance monitoring overlay (optional feature)
    createPerformanceOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'hariverse-performance-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 250px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-size: 12px;
            font-family: monospace;
            z-index: 2147483647;
            display: none;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            background: none;
            border: none;
            color: white;
            font-size: 16px;
            cursor: pointer;
        `;
        closeBtn.addEventListener('click', () => overlay.remove());

        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);

        return overlay;
    }

    // Monitor performance in real-time (optional feature)
    startPerformanceMonitoring() {
        const overlay = this.createPerformanceOverlay();
        overlay.style.display = 'block';

        const updateMetrics = () => {
            const navigation = performance.getEntriesByType('navigation')[0];
            const memory = performance.memory;
            
            overlay.innerHTML = `
                <button style="position: absolute; top: 5px; right: 5px; background: none; border: none; color: white; font-size: 16px; cursor: pointer;" onclick="this.parentElement.remove()">×</button>
                <h3 style="margin: 0 0 10px 0; color: #4ade80;">Performance Monitor</h3>
                <div>Load Time: ${navigation ? Math.round(navigation.loadEventEnd - navigation.navigationStart) : 0}ms</div>
                <div>DOM Ready: ${navigation ? Math.round(navigation.domContentLoadedEventEnd - navigation.navigationStart) : 0}ms</div>
                ${memory ? `<div>Memory Used: ${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB</div>` : ''}
                <div>Images: ${document.querySelectorAll('img').length}</div>
                <div>Scripts: ${document.querySelectorAll('script').length}</div>
                <div>Viewport: ${window.innerWidth}x${window.innerHeight}</div>
            `;
        };

        updateMetrics();
        const interval = setInterval(updateMetrics, 1000);

        // Stop monitoring when overlay is removed
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node.id === 'hariverse-performance-overlay') {
                        clearInterval(interval);
                        observer.disconnect();
                    }
                });
            });
        });
        
        observer.observe(document.body, { childList: true });
    }

    // ===== COOKIE BLOCKER FUNCTIONALITY =====
    async initCookieBlocker() {
        try {
            // Check if cookie blocker is enabled
            const result = await chrome.storage.sync.get(['cookieBlockerEnabled']);
            if (result.cookieBlockerEnabled) {
                // Wait for DOM to be ready if it's not already
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => {
                        this.enableCookieBlocker();
                    });
                } else {
                    this.enableCookieBlocker();
                }
            }
        } catch (error) {
            console.log('Cookie blocker initialization failed:', error);
        }
    }

    enableCookieBlocker() {
        if (window.hariverseeCookieBlocker) return;
        
        window.hariverseeCookieBlocker = {
            enabled: true,
            blockedCount: 0,
            observer: null,
            
            // Common cookie banner selectors (same as in background.js)
            selectors: [
                // OneTrust
                '#onetrust-consent-sdk', '#onetrust-banner-sdk', '.onetrust-pc-dark-filter',
                '.onetrust-pc-sdk', '[id*="onetrust"]',
                
                // Cookiebot
                '#CybotCookiebotDialog', '#CybotCookiebotDialogBodyContent', '.CybotCookiebotDialog',
                '.CybotCookiebotDialogBody', '[id*="Cookiebot"]', '[class*="CybotCookiebot"]',
                
                // Quantcast Choice
                '.qc-cmp2-container', '.qc-cmp-ui', '.qc-cmp-main-messaging', '.quantcast-overlay',
                '[id*="qc-cmp"]', '[class*="qc-cmp"]',
                
                // TrustArc
                '#truste-consent-track', '#trustarc-banner-overlay', '.trustarc-banner', '.truste_box_overlay',
                '[id*="trustarc"]', '[id*="truste"]', '[class*="trustarc"]', '[class*="truste"]',
                
                // Generic patterns
                '[class*="cookie"]:not([class*="cookie-settings"]):not([class*="cookie-preferences"])',
                '[class*="gdpr"]', '[class*="consent"]', '[id*="cookie"]:not([id*="cookie-settings"])',
                '[id*="consent"]', '[id*="gdpr"]',
                
                // Common class names
                '.cookie-banner', '.cookie-notice', '.cookie-consent', '.cookie-bar', '.cookie-message',
                '.cookie-policy', '.cookie-popup', '.cookie-modal', '.cookie-overlay', '.cookie-notification',
                '.cookie-alert', '.cookie-info', '.gdpr-banner', '.gdpr-notice', '.gdpr-consent',
                '.gdpr-popup', '.gdpr-modal', '.gdpr-overlay', '.privacy-banner', '.privacy-notice',
                '.consent-banner', '.consent-popup', '.consent-modal',
                
                // Cookie Consent library
                '.cc-banner', '.cc-window', '.cc-floating', '.cc-bottom', '.cc-top',
                
                // Other CMPs
                '.fc-consent-root', '.fc-dialog-container', '.didomi-popup', '.didomi-notice',
                '.sp_choice_type_11', '.sp_choice_type_12', '.message-overlay', '.privacy-manager-tcfv2',
                '.evidon-notice-link', '.ketch-banner', '.termly-banner', '.iubenda-cs-overlay',
                '.usercentrics-root', '.uc-banner-modal', '.cookiescript_injected'
            ],
            
            init() {
                this.hideCookieBanners();
                this.setupObserver();
                this.injectOptOutCookies();
                this.removeBodyScrollLock();
                console.log('HaRiverse Cookie Blocker enabled on', window.location.hostname);
            },
            
            hideCookieBanners() {
                let blocked = 0;
                
                this.selectors.forEach(selector => {
                    try {
                        const elements = document.querySelectorAll(selector);
                        elements.forEach(element => {
                            if (element && element.style.display !== 'none') {
                                element.style.setProperty('display', 'none', 'important');
                                element.style.setProperty('visibility', 'hidden', 'important');
                                element.style.setProperty('opacity', '0', 'important');
                                element.style.setProperty('height', '0', 'important');
                                element.style.setProperty('width', '0', 'important');
                                element.style.setProperty('z-index', '-9999', 'important');
                                element.style.setProperty('position', 'absolute', 'important');
                                element.style.setProperty('left', '-9999px', 'important');
                                element.style.setProperty('top', '-9999px', 'important');
                                blocked++;
                            }
                        });
                    } catch (error) {
                        // Ignore selector errors
                    }
                });
                
                if (blocked > 0) {
                    this.blockedCount += blocked;
                    this.reportStats(blocked);
                }
            },
            
            setupObserver() {
                this.observer = new MutationObserver((mutations) => {
                    let shouldCheck = false;
                    mutations.forEach(mutation => {
                        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                            shouldCheck = true;
                        }
                    });
                    
                    if (shouldCheck) {
                        setTimeout(() => this.hideCookieBanners(), 100);
                    }
                });
                
                if (document.body) {
                    this.observer.observe(document.body, {
                        childList: true,
                        subtree: true
                    });
                } else {
                    console.warn('Document body not available for cookie blocker observer');
                }
            },
            
            injectOptOutCookies() {
                const optOutCookies = [
                    'euconsent-v2=',
                    'cookieconsent_status=dismiss',
                    'cookie_consent=false',
                    'gdpr_consent=false',
                    'privacy_consent=false',
                    'analytics_consent=false',
                    'marketing_consent=false',
                    'functional_consent=true'
                ];
                
                optOutCookies.forEach(cookie => {
                    try {
                        document.cookie = `${cookie}; path=/; max-age=31536000; SameSite=Lax`;
                    } catch (error) {
                        // Ignore cookie setting errors
                    }
                });
            },
            
            removeBodyScrollLock() {
                if (!document.body) return;
                
                // Remove common body classes that lock scrolling
                const bodyClasses = ['modal-open', 'no-scroll', 'cookie-consent-active', 'gdpr-active'];
                bodyClasses.forEach(className => {
                    document.body.classList.remove(className);
                });
                
                // Reset body styles
                document.body.style.overflow = '';
                document.body.style.paddingRight = '';
                
                // Remove backdrop elements
                const backdrops = document.querySelectorAll('.modal-backdrop, .cookie-backdrop, .consent-backdrop, .gdpr-backdrop, .privacy-backdrop');
                backdrops.forEach(backdrop => {
                    backdrop.style.setProperty('display', 'none', 'important');
                });
            },
            
            reportStats(blocked) {
                try {
                    chrome.runtime.sendMessage({
                        action: 'cookieBlockerStats',
                        blocked: blocked,
                        site: window.location.hostname
                    });
                } catch (error) {
                    // Ignore messaging errors
                }
            },
            
            destroy() {
                if (this.observer) {
                    this.observer.disconnect();
                    this.observer = null;
                }
                this.enabled = false;
                console.log('HaRiverse Cookie Blocker disabled');
            }
        };
        
        window.hariverseeCookieBlocker.init();
    }

    disableCookieBlocker() {
        if (window.hariverseeCookieBlocker) {
            window.hariverseeCookieBlocker.destroy();
            delete window.hariverseeCookieBlocker;
        }
    }
}

// Initialize content script
const haRiverseContent = new HaRiverseContent();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (haRiverseContent.isColorPickerActive) {
        haRiverseContent.stopColorPicker();
    }
});

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HaRiverseContent;
}