// HaRiverse Extension - Enhanced Background Service Worker

console.log('HaRiverse background service worker v2.0 starting...');

// Rate limiter for capture API
class CaptureRateLimiter {
    constructor() {
        this.captureTimestamps = [];
        this.maxCapturesPerSecond = 1;
    }

    async waitForNextCapture() {
        const now = Date.now();
        this.captureTimestamps = this.captureTimestamps.filter(timestamp => 
            now - timestamp < 1000
        );

        if (this.captureTimestamps.length >= this.maxCapturesPerSecond) {
            const oldestCapture = Math.min(...this.captureTimestamps);
            const waitTime = 1000 - (now - oldestCapture) + 200;
            if (waitTime > 0) {
                console.log(`Rate limiting: waiting ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        this.captureTimestamps.push(Date.now());
    }
}

const captureRateLimiter = new CaptureRateLimiter();

// Extension lifecycle
chrome.runtime.onInstalled.addListener((details) => {
    console.log('HaRiverse extension installed:', details.reason);
    if (details.reason === 'install') {
        chrome.storage.local.set({
            'hariverse-settings': {
                theme: 'auto',
                defaultFormat: 'png',
                quality: 'high',
                autoDownload: true
            }
        });
    }
});

// Message handler will be defined after all functions

// ===== FULL PAGE SCREENSHOT WITH SCROLL =====
async function handleSimpleFullPageCapture(message, sender, sendResponse) {
    try {
        const tab = await chrome.tabs.get(message.tabId);
        
        // Get page dimensions
        const [result] = await chrome.scripting.executeScript({
            target: { tabId: message.tabId },
            func: () => {
                const fullHeight = Math.max(
                    document.body.scrollHeight,
                    document.documentElement.scrollHeight
                );
                const fullWidth = Math.max(
                    document.body.scrollWidth,
                    document.documentElement.scrollWidth
                );
                const viewportHeight = window.innerHeight;
                const viewportWidth = window.innerWidth;
                
                return { fullHeight, fullWidth, viewportHeight, viewportWidth };
            }
        });
        
        const { fullHeight, fullWidth, viewportHeight, viewportWidth } = result.result;
        
        // Create canvas for full page
        const canvas = new OffscreenCanvas(fullWidth, fullHeight);
        const ctx = canvas.getContext('2d');
        
        // Calculate scroll positions
        const verticalSteps = Math.ceil(fullHeight / viewportHeight);
        const horizontalSteps = Math.ceil(fullWidth / viewportWidth);
        
        for (let row = 0; row < verticalSteps; row++) {
            for (let col = 0; col < horizontalSteps; col++) {
                const scrollX = col * viewportWidth;
                const scrollY = row * viewportHeight;
                
                // Scroll to position
                await chrome.scripting.executeScript({
                    target: { tabId: message.tabId },
                    func: (x, y) => window.scrollTo(x, y),
                    args: [scrollX, scrollY]
                });
                
                await new Promise(resolve => setTimeout(resolve, 800));
                
                // Capture visible area with rate limiting
                await captureRateLimiter.waitForNextCapture();
                const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
                    format: 'png',
                    quality: 100
                });
                
                // Additional delay after capture
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Draw on canvas
                const response = await fetch(dataUrl);
                const blob = await response.blob();
                const img = await createImageBitmap(blob);
                
                ctx.drawImage(img, scrollX, scrollY);
            }
        }
        
        // Convert canvas to blob
        const finalBlob = await canvas.convertToBlob({
            type: message.format === 'jpg' ? 'image/jpeg' : 'image/png',
            quality: 1.0
        });
        
        // Convert to data URL
        const reader = new FileReader();
        reader.onload = () => {
            sendResponse({ success: true, dataUrl: reader.result });
        };
        reader.readAsDataURL(finalBlob);
        
        // Scroll back to top
        await chrome.scripting.executeScript({
            target: { tabId: message.tabId },
            func: () => window.scrollTo(0, 0)
        });
        
    } catch (error) {
        console.error('Screenshot failed:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// ===== SCREENSHOT FUNCTIONALITY =====
async function handleFullPageCapture(message, sender, sendResponse) {
    try {
        console.log('Starting full page capture for tab:', message.tabId);
        
        // Inject content script for page manipulation
        await chrome.scripting.executeScript({
            target: { tabId: message.tabId },
            func: preparePageForCapture
        });

        // Get page dimensions
        const [result] = await chrome.scripting.executeScript({
            target: { tabId: message.tabId },
            func: getPageDimensions
        });

        const dimensions = result.result;
        console.log('Page dimensions:', dimensions);

        // Calculate capture positions
        const capturePositions = calculateCapturePositions(
            dimensions.viewportWidth, 
            dimensions.viewportHeight,
            dimensions.totalWidth, 
            dimensions.totalHeight,
            dimensions.maxScrollX, 
            dimensions.maxScrollY
        );

        console.log(`Full page capture: ${capturePositions.length} screenshots needed`);

        const screenshots = [];
        let captureCount = 0;

        // Capture screenshots at calculated positions
        for (const position of capturePositions) {
            if (captureCount >= 100) break; // Safety limit

            const { scrollX, scrollY, row, col } = position;

            // Scroll to position
            await chrome.scripting.executeScript({
                target: { tabId: message.tabId },
                func: scrollToPosition,
                args: [scrollX, scrollY]
            });

            // Wait for scroll to complete
            await new Promise(resolve => setTimeout(resolve, 600));

            try {
                const tab = await chrome.tabs.get(message.tabId);
                const dataUrl = await captureWithRetry(tab.windowId, 3);

                screenshots.push({
                    dataUrl: dataUrl,
                    scrollX: scrollX,
                    scrollY: scrollY,
                    row: row,
                    col: col,
                    viewportWidth: dimensions.viewportWidth,
                    viewportHeight: dimensions.viewportHeight
                });

                captureCount++;

                // Update progress
                const progress = Math.round((captureCount / capturePositions.length) * 75);
                
                try {
                    chrome.runtime.sendMessage({
                        action: 'captureProgress',
                        progress: progress,
                        current: captureCount,
                        total: capturePositions.length,
                        status: `Capturing... (${captureCount}/${capturePositions.length})`
                    }).catch(() => {});
                } catch (e) {}

            } catch (error) {
                console.error(`Failed to capture at position ${scrollX},${scrollY}:`, error);
            }
        }

        console.log(`Captured ${screenshots.length} screenshots`);

        if (screenshots.length === 0) {
            throw new Error('No screenshots were captured');
        }

        // Send stitching progress update
        try {
            chrome.runtime.sendMessage({
                action: 'captureProgress',
                progress: 85,
                status: 'Stitching screenshots...'
            }).catch(() => {});
        } catch (e) {}

        // Stitch screenshots together
        const stitchedDataUrl = await stitchScreenshots(screenshots, dimensions, message.format);

        if (!stitchedDataUrl) {
            throw new Error('Failed to stitch screenshots together');
        }

        // Restore page scroll
        await chrome.scripting.executeScript({
            target: { tabId: message.tabId },
            func: restorePageScroll
        });

        // Send final progress update
        try {
            chrome.runtime.sendMessage({
                action: 'captureProgress',
                progress: 100,
                status: 'Screenshot completed!'
            }).catch(() => {});
        } catch (e) {}

        sendResponse({
            success: true,
            dataUrl: stitchedDataUrl
        });

    } catch (error) {
        console.error('Full page capture failed:', error);
        
        try {
            chrome.runtime.sendMessage({
                action: 'captureProgress',
                progress: 0,
                status: 'Capture failed'
            }).catch(() => {});
        } catch (e) {}

        let userMessage = error.message;
        if (error.message.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND')) {
            userMessage = 'Capture rate limit exceeded. Please wait a moment and try again.';
        } else if (error.message.includes('Cannot access')) {
            userMessage = 'Cannot capture this page. Try refreshing the page.';
        }

        sendResponse({
            success: false,
            error: userMessage
        });
    }
}

// ===== QR CODE GENERATION =====
async function handleGenerateQRCode(message, sender, sendResponse) {
    try {
        console.log('Generating QR code for content:', message.content);
        
        const qrDataUrl = await generateAdvancedQRCode(message.content, message.size || 256);
        
        sendResponse({
            success: true,
            dataUrl: qrDataUrl
        });
    } catch (error) {
        console.error('QR code generation failed:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

async function generateAdvancedQRCode(content, size) {
    try {
        // First try using a reliable online QR API
        const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(content)}&format=png&ecc=L`;
        
        const response = await fetch(apiUrl);
        if (response.ok) {
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        }
    } catch (error) {
        console.log('API method failed, using local generation:', error);
    }
    
    // Fallback to local generation
    return generateLocalQRCode(content, size);
}

async function generateLocalQRCode(content, size) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Generate proper QR code matrix
    const qrMatrix = createQRMatrix(content);
    const moduleCount = qrMatrix.length;
    const moduleSize = Math.floor(size / moduleCount);
    const offset = Math.floor((size - moduleCount * moduleSize) / 2);
    
    // Fill background (white)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    
    // Draw QR modules (black)
    ctx.fillStyle = '#000000';
    
    for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
            if (qrMatrix[row][col]) {
                ctx.fillRect(
                    offset + col * moduleSize, 
                    offset + row * moduleSize, 
                    moduleSize, 
                    moduleSize
                );
            }
        }
    }
    
    // Convert to blob and then to data URL
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

function createQRMatrix(text) {
    const size = 21; // QR Version 1 (21x21)
    const matrix = Array(size).fill().map(() => Array(size).fill(false));
    
    // Add finder patterns
    addFinderPattern(matrix, 0, 0);
    addFinderPattern(matrix, size - 7, 0);
    addFinderPattern(matrix, 0, size - 7);
    
    // Add separators (white borders around finder patterns)
    addSeparators(matrix, size);
    
    // Add timing patterns
    addTimingPatterns(matrix, size);
    
    // Add dark module (always dark)
    matrix[4 * 1 + 9][8] = true; // Version 1
    
    // Encode and place data
    const encodedData = encodeData(text);
    placeData(matrix, encodedData, size);
    
    // Apply mask pattern (simple mask)
    applyMask(matrix, size);
    
    // Add format information
    addFormatInfo(matrix, size);
    
    return matrix;
}

function addFinderPattern(matrix, startRow, startCol) {
    const pattern = [
        [1,1,1,1,1,1,1],
        [1,0,0,0,0,0,1],
        [1,0,1,1,1,0,1],
        [1,0,1,1,1,0,1],
        [1,0,1,1,1,0,1],
        [1,0,0,0,0,0,1],
        [1,1,1,1,1,1,1]
    ];
    
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 7; col++) {
            const r = startRow + row;
            const c = startCol + col;
            if (r >= 0 && r < matrix.length && c >= 0 && c < matrix[0].length) {
                matrix[r][c] = pattern[row][col] === 1;
            }
        }
    }
}

function addSeparators(matrix, size) {
    // Add white borders around finder patterns
    for (let i = 0; i < 8; i++) {
        // Top-left
        if (i < size) matrix[7][i] = false;
        if (i < size) matrix[i][7] = false;
        
        // Top-right
        if (size - 8 + i >= 0) matrix[7][size - 8 + i] = false;
        if (size - 8 >= 0) matrix[i][size - 8] = false;
        
        // Bottom-left
        if (size - 8 + i < size) matrix[size - 8 + i][7] = false;
        if (size - 8 >= 0 && i < size) matrix[size - 8][i] = false;
    }
}

function addTimingPatterns(matrix, size) {
    for (let i = 8; i < size - 8; i++) {
        matrix[6][i] = (i % 2) === 0;
        matrix[i][6] = (i % 2) === 0;
    }
}

function encodeData(text) {
    let data = '';
    
    // Mode indicator (0100 for byte mode)
    data += '0100';
    
    // Character count (8 bits for version 1)
    const length = Math.min(text.length, 17); // Max for version 1
    data += length.toString(2).padStart(8, '0');
    
    // Data
    for (let i = 0; i < length; i++) {
        data += text.charCodeAt(i).toString(2).padStart(8, '0');
    }
    
    // Terminator (up to 4 bits)
    const maxBits = 152; // Max data bits for version 1
    const terminatorLength = Math.min(4, maxBits - data.length);
    data += '0'.repeat(terminatorLength);
    
    // Pad to byte boundary
    while (data.length % 8 !== 0) {
        data += '0';
    }
    
    // Add padding bytes
    const paddingBytes = ['11101100', '00010001'];
    let paddingIndex = 0;
    while (data.length < maxBits) {
        data += paddingBytes[paddingIndex % 2];
        paddingIndex++;
    }
    
    return data.substring(0, maxBits);
}

function placeData(matrix, data, size) {
    let dataIndex = 0;
    let up = true;
    
    // Place data in zigzag pattern
    for (let col = size - 1; col > 0; col -= 2) {
        if (col === 6) col--; // Skip timing column
        
        for (let count = 0; count < size; count++) {
            for (let c = 0; c < 2; c++) {
                const currentCol = col - c;
                const currentRow = up ? size - 1 - count : count;
                
                if (currentRow >= 0 && currentRow < size && 
                    currentCol >= 0 && currentCol < size &&
                    !isReservedModule(currentRow, currentCol, size)) {
                    
                    if (dataIndex < data.length) {
                        matrix[currentRow][currentCol] = data[dataIndex] === '1';
                        dataIndex++;
                    }
                }
            }
        }
        up = !up;
    }
}

function isReservedModule(row, col, size) {
    // Finder patterns and separators
    if ((row < 9 && col < 9) || 
        (row < 9 && col >= size - 8) || 
        (row >= size - 8 && col < 9)) {
        return true;
    }
    
    // Timing patterns
    if (row === 6 || col === 6) {
        return true;
    }
    
    // Dark module
    if (row === 4 + 9 && col === 8) {
        return true;
    }
    
    // Format information areas
    if ((row === 8 && (col < 9 || col >= size - 8)) ||
        (col === 8 && (row < 9 || row >= size - 7))) {
        return true;
    }
    
    return false;
}

function applyMask(matrix, size) {
    // Apply mask pattern 0: (row + col) % 2 == 0
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (!isReservedModule(row, col, size) && (row + col) % 2 === 0) {
                matrix[row][col] = !matrix[row][col];
            }
        }
    }
}

function addFormatInfo(matrix, size) {
    // Format information for error correction level L (01) and mask pattern 0 (000)
    // This is a simplified version - real QR codes use BCH error correction
    const formatBits = '111011111000100'; // Pre-calculated for L + mask 0
    
    // Place format information
    for (let i = 0; i < 15; i++) {
        const bit = formatBits[i] === '1';
        
        if (i < 6) {
            matrix[8][i] = bit;
        } else if (i < 8) {
            matrix[8][i + 1] = bit;
        } else if (i === 8) {
            matrix[7][8] = bit;
        } else {
            matrix[14 - i][8] = bit;
        }
        
        // Mirror positions
        if (i < 8) {
            matrix[size - 1 - i][8] = bit;
        } else {
            matrix[8][size - 15 + i] = bit;
        }
    }
}

// ===== IMAGE DOWNLOAD =====
async function handleDownloadImage(message, sender, sendResponse) {
    try {
        const downloadId = await chrome.downloads.download({
            url: message.dataUrl,
            filename: message.filename,
            saveAs: false
        });

        sendResponse({
            success: true,
            downloadId: downloadId
        });
    } catch (error) {
        console.error('Download failed:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// ===== UTILITY FUNCTIONS =====

// Calculate optimal capture positions
function calculateCapturePositions(viewportWidth, viewportHeight, totalWidth, totalHeight, maxScrollX, maxScrollY) {
    const positions = [];
    let horizontalPositions = [];
    let verticalPositions = [];

    // Calculate horizontal positions
    if (maxScrollX === 0) {
        horizontalPositions = [0];
    } else {
        const horizontalSteps = Math.ceil(maxScrollX / (viewportWidth * 0.9));
        if (horizontalSteps === 1) {
            horizontalPositions = [0, maxScrollX];
        } else {
            for (let i = 0; i <= horizontalSteps; i++) {
                const pos = Math.min(i * Math.floor(maxScrollX / horizontalSteps), maxScrollX);
                if (!horizontalPositions.includes(pos)) {
                    horizontalPositions.push(pos);
                }
            }
        }
    }

    // Calculate vertical positions
    if (maxScrollY === 0) {
        verticalPositions = [0];
    } else {
        const verticalSteps = Math.ceil(maxScrollY / (viewportHeight * 0.9));
        if (verticalSteps === 1) {
            verticalPositions = [0, maxScrollY];
        } else {
            for (let i = 0; i <= verticalSteps; i++) {
                const pos = Math.min(i * Math.floor(maxScrollY / verticalSteps), maxScrollY);
                if (!verticalPositions.includes(pos)) {
                    verticalPositions.push(pos);
                }
            }
        }
    }

    // Create grid of positions
    let row = 0;
    for (const scrollY of verticalPositions) {
        let col = 0;
        for (const scrollX of horizontalPositions) {
            positions.push({ scrollX, scrollY, row, col });
            col++;
        }
        row++;
    }

    console.log('Calculated capture positions:', {
        horizontal: horizontalPositions,
        vertical: verticalPositions,
        total: positions.length
    });

    return positions;
}

// Rate-limited capture with retry
async function captureWithRetry(windowId, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await captureRateLimiter.waitForNextCapture();
            const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
                format: 'png',
                quality: 100
            });
            return dataUrl;
        } catch (error) {
            console.warn(`Capture attempt ${attempt} failed:`, error.message);
            if (error.message.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND')) {
                const waitTime = attempt * 1000;
                console.log(`Quota exceeded, waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } else if (attempt === maxRetries) {
                throw error;
            } else {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }
    throw new Error(`Failed to capture after ${maxRetries} attempts`);
}

// Screenshot stitching
async function stitchScreenshots(screenshots, dimensions, format) {
    const canvas = new OffscreenCanvas(dimensions.totalWidth, dimensions.totalHeight);
    const ctx = canvas.getContext('2d');

    // Set background color
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dimensions.totalWidth, dimensions.totalHeight);

    console.log(`Stitching ${screenshots.length} screenshots`);

    // Sort screenshots by position
    screenshots.sort((a, b) => {
        if (a.scrollY !== b.scrollY) return a.scrollY - b.scrollY;
        return a.scrollX - b.scrollX;
    });

    // Process screenshots
    for (let i = 0; i < screenshots.length; i++) {
        const screenshot = screenshots[i];
        
        try {
            const response = await fetch(screenshot.dataUrl);
            const blob = await response.blob();
            const imageBitmap = await createImageBitmap(blob);

            const destX = screenshot.scrollX;
            const destY = screenshot.scrollY;
            const availableWidth = dimensions.totalWidth - destX;
            const availableHeight = dimensions.totalHeight - destY;
            const sourceWidth = Math.min(screenshot.viewportWidth, availableWidth);
            const sourceHeight = Math.min(screenshot.viewportHeight, availableHeight);

            if (sourceWidth > 0 && sourceHeight > 0) {
                ctx.drawImage(
                    imageBitmap,
                    0, 0, sourceWidth, sourceHeight,
                    destX, destY, sourceWidth, sourceHeight
                );
                console.log(`Placed screenshot ${i + 1}/${screenshots.length} at (${destX}, ${destY})`);
            }

            imageBitmap.close();

            // Update progress
            const stitchProgress = 75 + Math.round((i + 1) / screenshots.length * 20);
            try {
                chrome.runtime.sendMessage({
                    action: 'captureProgress',
                    progress: stitchProgress,
                    status: `Stitching... (${i + 1}/${screenshots.length})`
                }).catch(() => {});
            } catch (e) {}

        } catch (error) {
            console.error(`Failed to process screenshot ${i + 1}:`, error);
        }
    }

    // Convert to blob
    const blob = await canvas.convertToBlob({
        type: format === 'jpg' ? 'image/jpeg' : 'image/png',
        quality: format === 'jpg' ? 0.9 : 1.0
    });

    // Convert blob to data URL
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

// ===== INJECTED FUNCTIONS =====

function preparePageForCapture() {
    const fixedElements = [];
    const allElements = document.querySelectorAll('*');
    
    allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
            fixedElements.push({
                element: el,
                originalPosition: style.position
            });
            el.style.position = 'static';
        }
    });

    window.__hariverse_originalScrollX = window.pageXOffset;
    window.__hariverse_originalScrollY = window.pageYOffset;
    window.__hariverse_fixedElements = fixedElements;
    document.body.style.overflow = 'hidden';
}

function getPageDimensions() {
    document.body.offsetHeight; // Force layout recalculation

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Get all possible measurements
    const docScrollWidth = document.documentElement.scrollWidth || 0;
    const bodyScrollWidth = document.body.scrollWidth || 0;
    const docOffsetWidth = document.documentElement.offsetWidth || 0;
    const bodyOffsetWidth = document.body.offsetWidth || 0;

    const docScrollHeight = document.documentElement.scrollHeight || 0;
    const bodyScrollHeight = document.body.scrollHeight || 0;
    const docOffsetHeight = document.documentElement.offsetHeight || 0;
    const bodyOffsetHeight = document.body.offsetHeight || 0;

    // Calculate true content dimensions
    const contentWidth = Math.max(
        docScrollWidth, bodyScrollWidth, 
        docOffsetWidth, bodyOffsetWidth, 
        viewportWidth
    );
    
    const contentHeight = Math.max(
        docScrollHeight, bodyScrollHeight, 
        docOffsetHeight, bodyOffsetHeight, 
        viewportHeight
    );

    // Test actual scrollable area
    const originalScrollX = window.pageXOffset;
    const originalScrollY = window.pageYOffset;

    window.scrollTo(999999, 999999);
    const maxScrollX = window.pageXOffset;
    const maxScrollY = window.pageYOffset;
    window.scrollTo(originalScrollX, originalScrollY);

    const totalWidth = Math.max(contentWidth, maxScrollX + viewportWidth);
    const totalHeight = Math.max(contentHeight, maxScrollY + viewportHeight);

    return {
        viewportWidth,
        viewportHeight,
        totalWidth,
        totalHeight,
        maxScrollX,
        maxScrollY
    };
}

function scrollToPosition(scrollX, scrollY) {
    window.scrollTo(scrollX, scrollY);
}

function restorePageScroll() {
    if (window.__hariverse_fixedElements) {
        window.__hariverse_fixedElements.forEach(item => {
            item.element.style.position = item.originalPosition;
        });
        delete window.__hariverse_fixedElements;
    }

    if (window.__hariverse_originalScrollX !== undefined && window.__hariverse_originalScrollY !== undefined) {
        window.scrollTo(window.__hariverse_originalScrollX, window.__hariverse_originalScrollY);
        delete window.__hariverse_originalScrollX;
        delete window.__hariverse_originalScrollY;
    }

    document.body.style.overflow = '';
}

// Keep service worker alive
let keepAliveInterval = null;

function startKeepAlive() {
    if (keepAliveInterval) return;
    keepAliveInterval = setInterval(() => {
        chrome.runtime.getPlatformInfo(() => {
            // Keep alive
        });
    }, 20000);
}

function stopKeepAlive() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
    }
}

// ===== COOKIE BLOCKER FUNCTIONALITY =====
async function handleToggleCookieBlocker(message, sender, sendResponse) {
    try {
        const { enabled } = message;
        
        // Store the setting
        await chrome.storage.sync.set({ cookieBlockerEnabled: enabled });
        
        // Get all tabs to inject/remove cookie blocker
        const tabs = await chrome.tabs.query({});
        
        for (const tab of tabs) {
            try {
                if (enabled) {
                    // Inject cookie blocker script
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: enableCookieBlocker
                    });
                } else {
                    // Disable cookie blocker
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: disableCookieBlocker
                    });
                }
            } catch (error) {
                // Ignore errors for tabs we can't access (chrome://, etc.)
                console.log(`Cannot access tab ${tab.id}:`, error.message);
            }
        }
        
        sendResponse({ success: true });
    } catch (error) {
        console.error('Failed to toggle cookie blocker:', error);
        sendResponse({ success: false, error: error.message });
    }
}

async function handleCookieBlockerStats(message, sender, sendResponse) {
    try {
        const { blocked, site } = message;
        
        // Get current stats
        const result = await chrome.storage.sync.get(['cookieBlockerStats']);
        const stats = result.cookieBlockerStats || { blocked: 0, sites: 0 };
        
        // Update stats
        stats.blocked += blocked;
        if (site) {
            stats.sites += 1;
        }
        
        // Save updated stats
        await chrome.storage.sync.set({ cookieBlockerStats: stats });
        
        sendResponse({ success: true, stats });
    } catch (error) {
        console.error('Failed to update cookie blocker stats:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Cookie blocker injection functions
function enableCookieBlocker() {
    if (window.hariverseeCookieBlocker) return;
    
    window.hariverseeCookieBlocker = {
        enabled: true,
        blockedCount: 0,
        observer: null,
        
        // Common cookie banner selectors
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
            console.log('HaRiverse Cookie Blocker enabled');
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

function disableCookieBlocker() {
    if (window.hariverseeCookieBlocker) {
        window.hariverseeCookieBlocker.destroy();
        delete window.hariverseeCookieBlocker;
    }
}

// Auto-enable cookie blocker on new tabs if enabled
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && tab.url && !tab.url.startsWith('chrome://')) {
        try {
            const result = await chrome.storage.sync.get(['cookieBlockerEnabled']);
            if (result.cookieBlockerEnabled) {
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: enableCookieBlocker
                });
            }
        } catch (error) {
            // Ignore errors for tabs we can't access
        }
    }
});

// Message handling from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    
    switch (message.action) {
        case 'captureFullPage':
            handleSimpleFullPageCapture(message, sender, sendResponse);
            return true;
        case 'downloadImage':
            handleDownloadImage(message, sender, sendResponse);
            return true;
        case 'generateQRCode':
            handleGenerateQRCode(message, sender, sendResponse);
            return true;
        case 'toggleCookieBlocker':
            handleToggleCookieBlocker(message, sender, sendResponse).catch(error => {
                console.error('Cookie blocker toggle failed:', error);
                sendResponse({ success: false, error: error.message });
            });
            return true;
        case 'cookieBlockerStats':
            handleCookieBlockerStats(message, sender, sendResponse).catch(error => {
                console.error('Cookie blocker stats failed:', error);
                sendResponse({ success: false, error: error.message });
            });
            return true;
        default:
            sendResponse({ success: false, error: 'Unknown action' });
    }
});

startKeepAlive();
console.log('HaRiverse background service worker v2.0 loaded successfully');