# HaRiverse - Premium Web Extension

A professional Chrome extension with powerful web tools including full-page screenshots, color picker, QR code generator, and video speed controller.

## Features

### 1. 📸 Full Page Screenshot
- Capture entire web pages, even content below the fold
- High-quality PNG format
- Automatic filename generation with timestamp
- Progress indicator during capture

### 2. 🎨 Color Picker
- Advanced color picking with EyeDropper API support
- Fallback manual color picker for unsupported browsers
- Color format conversion (HEX, RGB, HSL)
- Color palette with recent colors
- Copy to clipboard functionality

### 3. 📱 QR Code Generator
- Generate QR codes for current page URL or custom text
- High-resolution QR codes (512x512px)
- Download as PNG image
- Real-time preview

### 4. ⚡ Video Speed Controller
- Control playback speed of any video on web pages
- Speed range: 0.25x to 5.0x
- Interactive slider with preset buttons (0.5x, 1x, 1.25x, 1.5x, 2x)
- Apply speed to single video or all videos on page
- Keyboard shortcuts: `+` (increase), `-` (decrease)
- Works with YouTube, Vimeo, and HTML5 videos
- Real-time video detection and status display

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The HaRiverse icon will appear in your toolbar

## Usage

### Video Speed Controller

1. **Open any webpage with videos** (YouTube, Vimeo, or HTML5 videos)
2. **Click the HaRiverse extension icon**
3. **Navigate to the "Video Speed" tab**
4. **Use the controls:**
   - **Slider**: Drag to set precise speed (0.25x - 5.0x)
   - **Preset buttons**: Quick access to common speeds
   - **Reset button**: Return to normal speed (1.0x)
   - **Apply to All**: Change speed of all videos on the page

5. **Keyboard shortcuts** (when not typing in input fields):
   - `+` or `=`: Increase speed by 0.25x
   - `-` or `_`: Decrease speed by 0.25x

### Video Detection
- The extension automatically detects videos on the page
- Shows total video count and active video information
- Clicking on a video makes it the active target for speed changes

### Supported Video Types
- **HTML5 videos**: Direct `<video>` elements
- **YouTube**: Embedded and direct YouTube videos
- **Vimeo**: Embedded and direct Vimeo videos
- **Other platforms**: Most HTML5-based video players

## Technical Details

### Architecture
- **Manifest V3** compatible
- **Content Script**: Handles video detection and speed control
- **Popup Interface**: Modern, responsive UI with tabs
- **Background Script**: Manages extension lifecycle

### Permissions
- `activeTab`: Access current tab for video control
- `tabs`: Tab management for screenshots
- `storage`: Save user preferences
- `downloads`: Download screenshots and QR codes
- `scripting`: Inject content scripts

### Browser Compatibility
- Chrome 88+
- Edge 88+
- Other Chromium-based browsers

## Development

### File Structure
```
HaRiverse/
├── manifest.json          # Extension manifest
├── popup.html             # Extension popup UI
├── popup.css              # Popup styling
├── popup.js               # Popup functionality
├── content.js             # Content script for video control
├── background.js          # Background service worker
├── icons/                 # Extension icons
└── test-video.html        # Test page for video functionality
```

### Key Components

#### Video Speed Controller (`content.js`)
- `setVideoSpeed(speed, applyToAll)`: Main speed control function
- `detectVideos()`: Finds all videos on the page
- `getAllVideos()`: Comprehensive video element detection
- `setupKeyboardShortcuts()`: Keyboard shortcut handling

#### Popup Interface (`popup.js`)
- `initVideoSpeedController()`: Initialize video controls
- `setVideoSpeed(speed)`: Send speed commands to content script
- `detectVideos()`: Periodic video detection
- `updateVideoInfo()`: Update UI with video status

## Testing

Use the included `test-video.html` file to test video speed functionality:

1. Open `test-video.html` in Chrome
2. Load the HaRiverse extension
3. Test speed controls on the sample videos
4. Verify keyboard shortcuts work
5. Check "Apply to All" functionality

## Troubleshooting

### Video Speed Controller Issues

**Videos not detected:**
- Refresh the page after loading the extension
- Check if videos are loaded and ready to play
- Some iframe videos may not be accessible due to CORS

**Speed changes not working:**
- Ensure videos are HTML5 `<video>` elements
- Some custom video players may not support playbackRate
- Try clicking on the video first to make it active

**Keyboard shortcuts not working:**
- Make sure you're not typing in an input field
- Click somewhere on the page to ensure focus
- Check browser console for any JavaScript errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Changelog

### Version 2.0.0
- ✨ Added Video Speed Controller feature
- 🎯 Replaced Performance Analyzer with Video Speed Controller
- ⌨️ Added keyboard shortcuts for speed control
- 🎥 Support for YouTube, Vimeo, and HTML5 videos
- 📊 Real-time video detection and status display
- 🎛️ Interactive slider with preset speed buttons

### Version 1.0.0
- 📸 Full Page Screenshot functionality
- 🎨 Advanced Color Picker with EyeDropper API
- 📱 QR Code Generator
- ⚙️ Settings and preferences system