# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web-based dynamic emoji generator that allows users to upload images/videos, add animated text effects, and export as GIF files. The application is built with vanilla HTML, CSS, and JavaScript using modern web APIs.

## Development Commands

### Starting the Development Server
- **Windows**: Run `http-server.bat` to start a Python HTTP server on port 8000
- **Manual start**: `python -m http.server 8000` from the project directory
- **Alternative**: `npx http-server` or `php -S localhost:8000`
- **Access**: http://localhost:8000

**Important**: A local HTTP server is required (not file://) for proper Web Worker functionality.

### Testing
- No automated test framework is configured
- Manual testing through the web interface
- Test GIF generation with various file formats and animation types

## Architecture and Code Structure

### Core Architecture
The application follows a single-page architecture with these key components:

1. **Main Application Class** (`js/app.js:1-2847`): `DynamicEmojiGenerator` - handles all core functionality
2. **Web Worker** (`js/gif.worker.js`): Processes GIF generation without blocking the UI
3. **Canvas Rendering**: Real-time preview and frame generation using HTML5 Canvas
4. **File Management**: Drag-and-drop upload with reordering capabilities

### Key Technical Details

#### File Processing Flow
1. File upload/drag-drop → validation → media element creation
2. Canvas rendering with 1:1 aspect ratio (300x300px)
3. Text overlay with animation effects
4. Auto-play functionality after file upload
5. Pause state detection before GIF generation
6. GIF generation using gif.js library with Web Workers

#### Animation System
- **Frame-based animation**: Uses `requestAnimationFrame` for smooth rendering
- **Text effects**: bounce, fade, rotate, shake, typewriter
- **Media switching**: Automatic cycling through uploaded files every 3 seconds
- **Play/pause control**: Smart state management with auto-play after upload
- **State management**: Animation states tracked in `animationState` object and `isPlaying` flag

#### Canvas Operations
- **Background rendering**: Auto-cropping to 1:1 aspect ratio with center alignment
- **Text rendering**: Stroke + fill technique for better visibility
- **Frame capture**: Canvas content captured for GIF frame generation

### File Structure Conventions

```
dynamic-emoji-generator/
├── index.html          # Main HTML structure with inline event handlers  
├── css/style.css       # Complete styling with responsive design
├── js/
│   ├── app.js          # Main application logic (DynamicEmojiGenerator class)
│   └── gif.worker.js   # GIF encoding Web Worker (from gif.js library)
└── README.md           # Chinese documentation
```

### Key Implementation Patterns

#### Media Element Management
- Mixed image/video handling in single array (`uploadedFiles`)
- Lazy loading with promise-based element creation
- Memory management with URL.revokeObjectURL cleanup

#### Event Handling
- Event delegation for dynamic file list interactions
- Drag-and-drop for both file upload and reordering
- Canvas-based real-time preview updates

#### GIF Generation Process
- Frame-by-frame canvas capture at 10 FPS
- Web Worker processing to prevent UI blocking
- Progress tracking with visual feedback
- Configurable quality (1-20) and duration (1-10 seconds)
- Intelligent compression algorithm for WeChat compatibility (1MB limit)
- Pause state warning dialog with static GIF generation option

## Development Guidelines

### Adding New Animation Effects
1. Add new option to `animationType` select in `index.html:71-78`
2. Implement animation logic in `applyTextAnimation()` method at `js/app.js:476-508`
3. Update `getDisplayText()` if special text handling needed

### Modifying Canvas Behavior
- Canvas size is fixed at 300x300 (`js/app.js:164-165`)
- Background scaling logic in `drawBackground()` at `js/app.js:420-451`
- Text rendering in `drawText()` at `js/app.js:453-474`

### File Format Support
- Images: JPG, PNG, GIF (via `file.type.startsWith('image/')`)
- Videos: MP4, WebM (via `file.type.startsWith('video/')`)
- Validation in `processFiles()` at `js/app.js:202-224`

### Smart Playback Control System
- **Auto-play after upload**: `processFiles()` method automatically starts preview playback
- **Play state tracking**: `isPlaying` boolean flag tracks current playback state
- **Button state synchronization**: `updatePlayButtonStates()` keeps UI controls in sync
- **Pause detection**: `generateGif()` checks play state and shows warning dialog if paused
- **Static GIF option**: `generateStaticGif()` method for creating single-frame GIFs from paused state

### External Dependencies
- **gif.js v0.2.0**: Local library file (js/gif.js) 
- **gif.worker.js**: Local Web Worker file for GIF processing
- **Google Fonts**: Source Han Sans CN for Chinese text rendering
- No package.json - this is a static web application

## Common Configuration Changes

### Performance Tuning
- Animation speed: `animationSpeed` property (default: 0.05)
- Media switch interval: `switchInterval` variable (default: 3 seconds)
- GIF frame rate: `fps` variable (default: 10)
- File upload limit warning: 50 files threshold

### WeChat Optimization
- **File size target**: 1MB limit for WeChat compatibility
- **Multi-dimensional compression**: Quality (10-20) → FPS (10→8→6) → Duration (1.0→0.9→0.8→0.7)
- **Intelligent estimation**: Smart compression algorithm tries different settings automatically
- **Size reduction removed**: Maintains 300x300px output consistently

### UI Customization
- Canvas dimensions: Modify canvas width/height properties
- Text limits: `maxlength="50"` on text input
- Color schemes: Update CSS custom properties in `css/style.css`

## Troubleshooting Notes

### Common Issues
1. **Web Worker failures**: Ensure proper HTTP server setup (not file:// protocol)
2. **GIF generation errors**: Check browser Web Worker support and memory limits
3. **File upload issues**: Verify file type validation and size limits
4. **Animation performance**: Reduce file count or lower quality settings
5. **Static GIF generation**: If preview is paused, user gets warning dialog with play/static options

### Browser Compatibility
- Requires modern browsers with Canvas, Web Workers, and File API support
- Mobile responsive design implemented
- Touch-friendly drag-and-drop interactions