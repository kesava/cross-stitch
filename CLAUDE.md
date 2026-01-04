# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cross-stitch is a **modular web application** that converts images into cross-stitch patterns using DMC thread colors. Built with React via CDN and ES modules, it runs directly in the browser without a build system or bundler.

## Project Structure

```
cross-stitch/
├── index.html              # Original single-file version (legacy)
├── index-modular.html      # Modular version entry point
├── src/
│   ├── components/         # React components
│   │   ├── App.js         # Main application component
│   │   ├── Header.js      # Title and decorative elements
│   │   ├── UploadZone.js  # File upload interface
│   │   ├── Controls.js    # Pattern controls (grid size, new image)
│   │   ├── PreviewPanel.js # Original image and statistics
│   │   └── PatternPanel.js # Generated pattern display
│   ├── data/
│   │   └── dmcColors.js   # DMC thread color palette (160+ colors)
│   ├── utils/
│   │   ├── colorUtils.js  # Color matching algorithms
│   │   └── patternGenerator.js # Pattern conversion logic
│   ├── styles.css         # Application styles
│   └── main.js            # Application entry point (alternative)
└── CLAUDE.md              # This file
```

## Architecture

### Module Organization

The codebase is organized into functional modules using ES6 imports/exports:

**Data Layer** (`src/data/`):
- `dmcColors.js` - Static DMC thread color palette with 160+ colors organized by family

**Utilities** (`src/utils/`):
- `colorUtils.js` - Color matching and conversion functions
- `patternGenerator.js` - Image processing and SVG generation logic

**Components** (`src/components/`):
- `App.js` - Main orchestration component, manages state and workflow
- `Header.js` - Static header with title
- `UploadZone.js` - Drag-and-drop file upload
- `Controls.js` - Pattern width slider and new image button
- `PreviewPanel.js` - Original image display with stats and color palette
- `PatternPanel.js` - Generated pattern display with download

**Presentation** (`src/styles.css`):
- All CSS in one stylesheet using CSS custom properties for theming

### Key Algorithms

#### Color Quantization (`colorUtils.js`)

The `findClosestDMC()` function maps RGB pixels to the nearest DMC thread color:

```javascript
// Weighted Euclidean distance in RGB space
distance = dr² × 0.3 + dg² × 0.59 + db² × 0.11
```

Weights match human eye sensitivity (green > red > blue) for perceptually accurate color matching.

#### Pattern Generation (`patternGenerator.js`)

**Three-step process:**

1. **`loadImageData()`** - Loads image and extracts pixel data via Canvas API
2. **`convertToPattern()`** - Converts image to stitches:
   - Divides image into grid (preserves aspect ratio)
   - Samples center of each grid cell
   - Maps to closest DMC color
   - Tracks color usage statistics
   - Processes in 5-row chunks using `requestAnimationFrame` to avoid UI blocking
3. **`generateSVG()`** - Renders pattern as SVG:
   - Each stitch drawn as two diagonal lines (X shape)
   - Background grid pattern for fabric appearance
   - Scalable vector output for any resolution

### Component Architecture

**App Component** (`App.js`):
- Central state management using React hooks
- Orchestrates data flow between components
- Key state: `image`, `imageData`, `gridSize`, `pattern`, `progress`, `colorCounts`
- Two main effects:
  - Image → ImageData conversion
  - ImageData + gridSize → Pattern generation

**Child Components**:
- All functional components with props-based communication
- No internal state except UI-specific (e.g., drag state in UploadZone)
- Callbacks for user interactions flow up to App

### No Build System Approach

This project uses **Babel Standalone** to transform JSX at runtime:

```html
<script type="text/babel" data-type="module">
  import { App } from './src/components/App.js';
  ReactDOM.render(<App />, document.getElementById('root'));
</script>
```

Benefits:
- Zero configuration
- Instant reload during development
- Easy deployment (static files)
- ES modules work natively in modern browsers

## Running the Application

### Local Development

Serve via HTTP (required for ES modules):

```bash
# Python 3
python3 -m http.server 8000

# Node.js (if you have http-server installed)
npx http-server -p 8000

# Then navigate to:
# http://localhost:8000/index-modular.html
```

**Important:** Cannot use `file://` protocol - ES modules require HTTP server.

### Dependencies (CDN)

All loaded from CDN, no `npm install` required:
- React 18 (production build)
- ReactDOM 18 (production build)
- Babel Standalone 7 (JSX transformation)
- Google Fonts: Cormorant Garamond, IBM Plex Mono

## Common Development Tasks

### Adding New DMC Colors

Edit `src/data/dmcColors.js`:

```javascript
export const DMC_COLORS = [
  // ... existing colors
  { id: '123', hex: '#RRGGBB', name: 'Color Name' },
];
```

### Changing Default Grid Size

Edit `src/components/App.js`:

```javascript
const [gridSize, setGridSize] = useState(60); // Change default here
```

### Modifying Grid Size Range

Edit `src/components/Controls.js`:

```javascript
<input type="range" min="20" max="150" ... />
```

### Adjusting Stitch Appearance

Edit `src/utils/patternGenerator.js` in `generateSVG()`:

```javascript
const padding = 1;      // Stitch density (1px from cell edge)
stroke-width="2"        // Thread thickness
```

### Changing Color Palette Display

Edit `src/components/PreviewPanel.js`:

```javascript
{sortedColors.slice(0, 20).map(...)} // Show top 20 colors
```

### Modifying Chunk Size (Performance)

Edit `src/utils/patternGenerator.js` in `convertToPattern()`:

```javascript
const chunkSize = 5; // Rows processed per frame
```

Smaller = smoother progress updates but slower overall.
Larger = faster processing but choppier progress.

## Implementation Notes

### State Flow

```
User uploads image
  → App sets `image` state
  → useEffect triggers `loadImageData()`
  → Sets `imageData` state
  → useEffect triggers `convertToPattern()`
  → Updates `progress` during processing
  → Sets `pattern` and `colorCounts` when complete
  → Child components render with new data
```

### Performance Considerations

- **Chunked Processing**: 5-row chunks prevent main thread blocking
- **requestAnimationFrame**: Ensures smooth UI during conversion
- **Progress Updates**: Visual feedback for conversions >2 seconds
- **Canvas Sampling**: Only samples cell centers (not all pixels)
- **Large Images**: Max 150 stitch width limits processing time

### SVG Output

Generated SVG is optimized for:
- Print quality (viewBox scales correctly)
- Vector editing software (Inkscape, Illustrator)
- Cross-stitch design tools import
- Any resolution/zoom level

### Why Modular Structure?

The modular structure provides:
- **Separation of Concerns**: Data, logic, and UI separated
- **Testability**: Pure functions in utils can be tested independently
- **Maintainability**: Each file has single responsibility
- **Reusability**: Components and utils can be reused
- **Readability**: Smaller files easier to understand

Yet maintains the **no-build-system** philosophy:
- Still runs directly in browser
- No webpack, rollup, or vite needed
- Just ES modules + Babel Standalone

## File Dependencies

Understanding import chains helps navigate the codebase:

```
index-modular.html
  └── src/components/App.js
      ├── src/components/Header.js
      ├── src/components/UploadZone.js
      ├── src/components/Controls.js
      ├── src/components/PreviewPanel.js
      ├── src/components/PatternPanel.js
      └── src/utils/patternGenerator.js
          └── src/utils/colorUtils.js
              └── src/data/dmcColors.js
```

## Browser Compatibility

Requires modern browser with:
- ES6 modules support
- Canvas API
- File API
- Async/await
- CSS custom properties

Supported: Chrome 61+, Firefox 60+, Safari 11+, Edge 79+

## Legacy Version

`index.html` contains the original single-file implementation. It's functionally identical but harder to maintain. Use `index-modular.html` for new development.
