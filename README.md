# Cross Stitch Pattern Maker

Convert images into cross-stitch patterns using DMC thread colors. Built with vanilla JavaScript and React, runs entirely in the browser with no build system required.

🔗 **Live Demo**: https://kesava.github.io/cross-stitch

## Features

- **Image Upload**: Drag-and-drop or click to upload PNG, JPG, or GIF images
- **Automatic Background Removal**: Detects and removes background colors using edge sampling
- **Adjustable Pattern Size**: Generate patterns from 20 to 150 stitches wide
- **DMC Color Matching**: Maps colors to 160+ authentic DMC embroidery floss colors
- **Floyd-Steinberg Dithering**: Optional dithering for smoother gradients and better detail preservation
- **Interactive Zoom**: Zoom in/out on generated patterns (25% to 400%)
- **Multiple Export Formats**:
  - SVG (scalable vector graphics)
  - JSON (Open Cross Stitch Format with metadata and color palette)
- **Sample Image**: Automatically loads a sample pattern on page load to demonstrate functionality
- **Mobile Responsive**: Touch-friendly controls optimized for mobile devices
- **No Installation Required**: Runs directly in the browser via CDN-loaded libraries

## Local Development

Serve the project using any HTTP server:

### Python 3
```bash
python3 -m http.server 8000
```

### Node.js
```bash
npx http-server -p 8000
```

Then navigate to http://localhost:8000

**Note**: The application requires an HTTP server due to ES module imports. Opening `index.html` directly via `file://` protocol will not work.

## GitHub Pages Deployment

### First-Time Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Initialize git repository** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

3. **Create GitHub repository** and push:
   ```bash
   git remote add origin https://github.com/kesava/cross-stitch.git
   git branch -M main
   git push -u origin main
   ```

4. **Deploy to GitHub Pages**:
   ```bash
   npm run deploy
   ```

The `gh-pages` package will create a `gh-pages` branch and push all files to it.

5. **Enable GitHub Pages**:
   - Go to your repository on GitHub
   - Navigate to Settings → Pages
   - Under "Source", select branch: `gh-pages` and folder: `/ (root)`
   - Click Save

Your site will be live at https://kesava.github.io/cross-stitch within a few minutes.

### Ongoing Deployment

After making changes, deploy updates with:

```bash
npm run deploy
```

This command:
1. Pushes all current files to the `gh-pages` branch
2. GitHub Pages automatically rebuilds and publishes the site

## Project Structure

```
cross-stitch/
├── index.html              # Main entry point (standalone version)
├── index-standalone.html   # Standalone vanilla JS version
├── index-modular.html      # Modular React version
├── standalone.js           # Vanilla JS implementation
├── samples/
│   └── sample.png         # Sample image for demo
├── src/
│   ├── components/        # React components (modular version)
│   │   ├── App.js
│   │   ├── Controls.js
│   │   ├── Header.js
│   │   ├── PatternPanel.js
│   │   ├── PreviewPanel.js
│   │   └── UploadZone.js
│   ├── data/
│   │   └── dmcColors.js   # DMC thread color palette (160+ colors)
│   ├── utils/
│   │   ├── colorUtils.js  # Color matching algorithms
│   │   └── patternGenerator.js  # Pattern conversion logic
│   ├── styles.css         # Application styles
│   ├── htm.js            # HTM library for JSX-like syntax
│   └── main.js           # App entry point (modular version)
├── package.json
├── .nojekyll             # Prevents Jekyll processing on GitHub Pages
├── CLAUDE.md             # Development documentation
└── README.md             # This file
```

## Usage

1. **Upload an Image**: Click the upload zone or drag-and-drop an image file
2. **Adjust Settings**:
   - **Pattern Width**: Slide to change pattern size (20-150 stitches)
   - **Remove Background**: Toggle background removal (adjusts tolerance slider)
   - **Background Tolerance**: Fine-tune background detection sensitivity
   - **Use Dithering**: Enable Floyd-Steinberg dithering for better gradients
3. **View Results**:
   - Left panel shows original image with statistics
   - Right panel displays generated cross-stitch pattern
   - Color palette shows DMC thread colors used
4. **Zoom**: Use zoom controls to inspect pattern details
5. **Download**:
   - **Download SVG**: Vector format for printing/editing
   - **Download Pattern (JSON)**: Machine-readable Open Cross Stitch format

## Technology Stack

- **React 18** (loaded from CDN via unpkg.com)
- **ES Modules** (native browser support)
- **Canvas API** (image processing)
- **Babel Standalone** (runtime JSX transformation for modular version)
- **Floyd-Steinberg Dithering** (color quantization)
- **CSS Grid & Flexbox** (responsive layout)
- **gh-pages** (deployment automation)

## Algorithms

### DMC Color Matching
Uses weighted Euclidean distance in RGB color space:
```
distance = (dr² × 0.3) + (dg² × 0.59) + (db² × 0.11)
```
Weights match human eye sensitivity (green > red > blue).

### Background Detection
Samples 40+ points around image perimeter, groups similar colors, and selects the most frequent color group as background.

### Floyd-Steinberg Dithering
Distributes quantization errors to neighboring pixels:
- Right pixel: 7/16 of error
- Bottom-left: 3/16
- Bottom: 5/16
- Bottom-right: 1/16

## Browser Compatibility

Requires modern browser with:
- ES6 modules
- Canvas API
- File API
- Async/await
- CSS custom properties

**Supported**: Chrome 61+, Firefox 60+, Safari 11+, Edge 79+

## Export Formats

### SVG
Scalable vector format with:
- Grid pattern background
- X-shaped stitches with DMC colors
- Suitable for printing and vector editing software

### Open Cross Stitch Format (JSON)
Structured format containing:
- Pattern metadata (title, author, creation date)
- Pattern dimensions and stitch count
- DMC color palette with usage statistics
- Stitch coordinates with color references

## Development Notes

This project uses a **no-build-system** approach:
- Babel Standalone transforms JSX at runtime
- ES modules load directly in the browser
- No webpack, rollup, or vite required
- Zero configuration
- Instant reload during development

See `CLAUDE.md` for detailed architecture documentation.

## License

ISC

## Author

Generated with Cross Stitch Pattern Maker
