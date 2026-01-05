// Import DMC colors directly
import { DMC_COLORS } from './src/data/dmcColors.js';

// Global state
let currentImage = null;
let currentImageData = null;
let currentPattern = null;
let backgroundColor = null;
let objectMask = null;
let currentZoom = 1;
let baseScale = 1;

// DOM Elements
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const controls = document.getElementById('controls');
const workspace = document.getElementById('workspace');
const originalImage = document.getElementById('originalImage');
const patternCanvas = document.getElementById('patternCanvas');
const progress = document.getElementById('progress');
const downloadBtn = document.getElementById('downloadBtn');
const downloadJsonBtn = document.getElementById('downloadJsonBtn');
const downloadPngBtn = document.getElementById('downloadPngBtn');
const newImageBtn = document.getElementById('newImageBtn');

// Controls
const gridSizeInput = document.getElementById('gridSize');
const gridSizeValue = document.getElementById('gridSizeValue');
const removeBackgroundCheckbox = document.getElementById('removeBackground');
const toleranceInput = document.getElementById('tolerance');
const toleranceValue = document.getElementById('toleranceValue');
const toleranceControl = document.getElementById('toleranceControl');
const bgColorIndicator = document.getElementById('bgColorIndicator');
const useDitheringCheckbox = document.getElementById('useDithering');
const ditheringAlgorithmSelect = document.getElementById('ditheringAlgorithm');
const maxColorsCheckbox = document.getElementById('useMaxColors');
const maxColorsInput = document.getElementById('maxColors');
const maxColorsValue = document.getElementById('maxColorsValue');
const maxColorsControl = document.getElementById('maxColorsControl');

// Zoom controls
const zoomControls = document.getElementById('zoomControls');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const zoomResetBtn = document.getElementById('zoomReset');
const zoomValue = document.getElementById('zoomValue');

// ===== Color Utilities =====

function findClosestDMC(r, g, b) {
    let minDistance = Infinity;
    let closestColor = DMC_COLORS[0];

    for (const dmc of DMC_COLORS) {
        const dr = parseInt(dmc.hex.slice(1, 3), 16) - r;
        const dg = parseInt(dmc.hex.slice(3, 5), 16) - g;
        const db = parseInt(dmc.hex.slice(5, 7), 16) - b;

        const distance = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;

        if (distance < minDistance) {
            minDistance = distance;
            closestColor = dmc;
        }
    }

    return closestColor;
}

function colorDistance(color1, color2) {
    const dr = color1.r - color2.r;
    const dg = color1.g - color2.g;
    const db = color1.b - color2.b;
    return Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11);
}

function isSimilarColor(color1, color2, tolerance) {
    return colorDistance(color1, color2) < tolerance;
}

// ===== Background Detection =====

function detectBackgroundColor(imageData) {
    const { data, width, height } = imageData;
    const samples = [];

    const positions = [
        { x: 0, y: 0 },
        { x: width - 1, y: 0 },
        { x: 0, y: height - 1 },
        { x: width - 1, y: height - 1 },
        { x: Math.floor(width / 2), y: 0 },
        { x: Math.floor(width / 2), y: height - 1 },
        { x: 0, y: Math.floor(height / 2) },
        { x: width - 1, y: Math.floor(height / 2) },
    ];

    for (let i = 1; i < 10; i++) {
        const offset = i / 10;
        positions.push(
            { x: Math.floor(width * offset), y: 0 },
            { x: Math.floor(width * offset), y: height - 1 },
            { x: 0, y: Math.floor(height * offset) },
            { x: width - 1, y: Math.floor(height * offset) }
        );
    }

    for (const pos of positions) {
        const idx = (pos.y * width + pos.x) * 4;
        samples.push({
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2]
        });
    }

    const colorGroups = [];
    const tolerance = 20;

    for (const sample of samples) {
        let foundGroup = false;
        for (const group of colorGroups) {
            if (isSimilarColor(sample, group.color, tolerance)) {
                group.count++;
                foundGroup = true;
                break;
            }
        }
        if (!foundGroup) {
            colorGroups.push({ color: sample, count: 1 });
        }
    }

    colorGroups.sort((a, b) => b.count - a.count);
    return colorGroups[0].color;
}

// ===== Pattern Generation =====

async function convertToPattern(imageData, gridSize, removeBackground, backgroundColor, tolerance, useDithering = false, ditheringAlgorithm = 'floyd-steinberg') {
    const { data, width, height } = imageData;
    const aspectRatio = height / width;
    const gridWidth = gridSize;
    const gridHeight = Math.round(gridSize * aspectRatio);
    const cellWidth = width / gridWidth;
    const cellHeight = height / gridHeight;

    // Create a working copy of the image data for dithering
    const workingData = useDithering ? new Uint8ClampedArray(data) : data;

    const stitches = [];
    const colorCounts = {};
    let skipped = 0;

    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const sampleX = Math.floor(x * cellWidth + cellWidth / 2);
            const sampleY = Math.floor(y * cellHeight + cellHeight / 2);
            const idx = (sampleY * width + sampleX) * 4;

            const r = workingData[idx];
            const g = workingData[idx + 1];
            const b = workingData[idx + 2];
            const a = workingData[idx + 3];

            if (a > 128) {
                // Check color-based background removal
                if (removeBackground && backgroundColor && isSimilarColor({ r, g, b }, backgroundColor, tolerance)) {
                    skipped++;
                    continue;
                }

                const dmc = findClosestDMC(r, g, b);
                stitches.push({ x, y, color: dmc });
                colorCounts[dmc.id] = colorCounts[dmc.id] || { ...dmc, count: 0 };
                colorCounts[dmc.id].count++;

                // Apply dithering
                if (useDithering) {
                    const dmcR = parseInt(dmc.hex.slice(1, 3), 16);
                    const dmcG = parseInt(dmc.hex.slice(3, 5), 16);
                    const dmcB = parseInt(dmc.hex.slice(5, 7), 16);

                    const errorR = r - dmcR;
                    const errorG = g - dmcG;
                    const errorB = b - dmcB;

                    if (ditheringAlgorithm === 'floyd-steinberg') {
                        // Floyd-Steinberg dithering
                        distributeError(workingData, width, height, sampleX + 1, sampleY, errorR, errorG, errorB, 7/16);
                        distributeError(workingData, width, height, sampleX - 1, sampleY + 1, errorR, errorG, errorB, 3/16);
                        distributeError(workingData, width, height, sampleX, sampleY + 1, errorR, errorG, errorB, 5/16);
                        distributeError(workingData, width, height, sampleX + 1, sampleY + 1, errorR, errorG, errorB, 1/16);
                    } else if (ditheringAlgorithm === 'atkinson') {
                        // Atkinson dithering (lighter, more artistic)
                        distributeError(workingData, width, height, sampleX + 1, sampleY, errorR, errorG, errorB, 1/8);
                        distributeError(workingData, width, height, sampleX + 2, sampleY, errorR, errorG, errorB, 1/8);
                        distributeError(workingData, width, height, sampleX - 1, sampleY + 1, errorR, errorG, errorB, 1/8);
                        distributeError(workingData, width, height, sampleX, sampleY + 1, errorR, errorG, errorB, 1/8);
                        distributeError(workingData, width, height, sampleX + 1, sampleY + 1, errorR, errorG, errorB, 1/8);
                        distributeError(workingData, width, height, sampleX, sampleY + 2, errorR, errorG, errorB, 1/8);
                    }
                }
            }
        }

        if (y % 5 === 0) {
            progress.textContent = `Converting... ${Math.round((y / gridHeight) * 100)}%`;
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    console.log(`Conversion complete: ${stitches.length} stitches, ${skipped} pixels skipped as background`);

    return {
        stitches,
        width: gridWidth,
        height: gridHeight,
        colorCounts
    };
}

function distributeError(data, width, height, x, y, errorR, errorG, errorB, factor) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;

    const idx = (y * width + x) * 4;
    data[idx] = Math.max(0, Math.min(255, data[idx] + errorR * factor));
    data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + errorG * factor));
    data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + errorB * factor));
}

function limitColors(pattern, maxColors) {
    if (maxColors <= 0) return pattern;

    // Get colors sorted by usage
    const sortedColors = Object.values(pattern.colorCounts)
        .sort((a, b) => b.count - a.count);

    // If already within limit, no change needed
    if (sortedColors.length <= maxColors) return pattern;

    // Get top N colors
    const topColors = sortedColors.slice(0, maxColors);
    const topColorIds = new Set(topColors.map(c => c.id));

    // Build new color counts
    const newColorCounts = {};
    topColors.forEach(c => {
        newColorCounts[c.id] = { ...c, count: 0 };
    });

    // Update stitches - replace colors not in top N with closest color from top N
    const newStitches = pattern.stitches.map(stitch => {
        if (topColorIds.has(stitch.color.id)) {
            // Color is in top N, keep it
            newColorCounts[stitch.color.id].count++;
            return stitch;
        } else {
            // Find closest color from top N
            const r = parseInt(stitch.color.hex.slice(1, 3), 16);
            const g = parseInt(stitch.color.hex.slice(3, 5), 16);
            const b = parseInt(stitch.color.hex.slice(5, 7), 16);

            let closestColor = topColors[0];
            let minDistance = Infinity;

            for (const color of topColors) {
                const cr = parseInt(color.hex.slice(1, 3), 16);
                const cg = parseInt(color.hex.slice(3, 5), 16);
                const cb = parseInt(color.hex.slice(5, 7), 16);

                const dr = cr - r;
                const dg = cg - g;
                const db = cb - b;
                const distance = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;

                if (distance < minDistance) {
                    minDistance = distance;
                    closestColor = color;
                }
            }

            newColorCounts[closestColor.id].count++;
            return { ...stitch, color: closestColor };
        }
    });

    return {
        ...pattern,
        stitches: newStitches,
        colorCounts: newColorCounts
    };
}

function calculatePatternStats(stitchCount, colorCount) {
    // Average stitching speed: 200-300 stitches per hour
    const stitchesPerHour = 250;
    const estimatedHours = stitchCount / stitchesPerHour;

    // Difficulty calculation
    let difficulty = 'Beginner';
    let difficultyScore = 0;

    // Base difficulty on stitch count
    if (stitchCount < 2000) {
        difficultyScore += 1;
    } else if (stitchCount < 5000) {
        difficultyScore += 2;
    } else if (stitchCount < 10000) {
        difficultyScore += 3;
    } else if (stitchCount < 20000) {
        difficultyScore += 4;
    } else {
        difficultyScore += 5;
    }

    // Add difficulty based on color count
    if (colorCount > 30) {
        difficultyScore += 2;
    } else if (colorCount > 20) {
        difficultyScore += 1;
    }

    // Determine final difficulty
    if (difficultyScore <= 2) {
        difficulty = 'Beginner';
    } else if (difficultyScore <= 4) {
        difficulty = 'Easy';
    } else if (difficultyScore <= 6) {
        difficulty = 'Intermediate';
    } else if (difficultyScore <= 8) {
        difficulty = 'Advanced';
    } else {
        difficulty = 'Expert';
    }

    // Format time estimate
    let timeEstimate = '';
    if (estimatedHours < 1) {
        timeEstimate = `${Math.round(estimatedHours * 60)} min`;
    } else if (estimatedHours < 10) {
        timeEstimate = `${estimatedHours.toFixed(1)} hrs`;
    } else {
        const days = Math.floor(estimatedHours / 8);
        const remainingHours = Math.round(estimatedHours % 8);
        if (days === 0) {
            timeEstimate = `${Math.round(estimatedHours)} hrs`;
        } else if (remainingHours === 0) {
            timeEstimate = `${days} ${days === 1 ? 'day' : 'days'}`;
        } else {
            timeEstimate = `${days}d ${remainingHours}h`;
        }
    }

    return { difficulty, timeEstimate };
}

function drawPattern(stitches, gridWidth, gridHeight) {
    const stitchSize = 10;
    const canvas = patternCanvas;
    canvas.width = gridWidth * stitchSize;
    canvas.height = gridHeight * stitchSize;

    const ctx = canvas.getContext('2d');

    // Background grid
    ctx.fillStyle = '#F5F0E8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#E0D8D0';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= gridWidth; x++) {
        ctx.beginPath();
        ctx.moveTo(x * stitchSize, 0);
        ctx.lineTo(x * stitchSize, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= gridHeight; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * stitchSize);
        ctx.lineTo(canvas.width, y * stitchSize);
        ctx.stroke();
    }

    // Draw stitches
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const padding = 1;

    for (const stitch of stitches) {
        const sx = stitch.x * stitchSize;
        const sy = stitch.y * stitchSize;

        ctx.strokeStyle = stitch.color.hex;

        // Draw X
        ctx.beginPath();
        ctx.moveTo(sx + padding, sy + padding);
        ctx.lineTo(sx + stitchSize - padding, sy + stitchSize - padding);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(sx + stitchSize - padding, sy + padding);
        ctx.lineTo(sx + padding, sy + stitchSize - padding);
        ctx.stroke();
    }

    // Calculate base scale to fit canvas in container
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth - 40; // Account for padding
    const containerHeight = container.clientHeight - 40;

    const scaleX = containerWidth / canvas.width;
    const scaleY = containerHeight / canvas.height;
    baseScale = Math.min(scaleX, scaleY, 1); // Never scale up beyond 100%

    currentZoom = 1; // Reset zoom
    updateZoom();
}

function generateSVG(stitches, gridWidth, gridHeight) {
    const stitchSize = 10;
    const svgWidth = gridWidth * stitchSize;
    const svgHeight = gridHeight * stitchSize;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">`;

    svg += `<defs>
        <pattern id="grid" width="${stitchSize}" height="${stitchSize}" patternUnits="userSpaceOnUse">
            <rect width="${stitchSize}" height="${stitchSize}" fill="#F5F0E8"/>
            <path d="M ${stitchSize} 0 L 0 0 0 ${stitchSize}" fill="none" stroke="#E0D8D0" stroke-width="0.5"/>
        </pattern>
    </defs>`;
    svg += `<rect width="100%" height="100%" fill="url(#grid)"/>`;

    const padding = 1;
    for (const stitch of stitches) {
        const sx = stitch.x * stitchSize;
        const sy = stitch.y * stitchSize;

        svg += `<g>
            <line x1="${sx + padding}" y1="${sy + padding}" x2="${sx + stitchSize - padding}" y2="${sy + stitchSize - padding}"
                  stroke="${stitch.color.hex}" stroke-width="2" stroke-linecap="round"/>
            <line x1="${sx + stitchSize - padding}" y1="${sy + padding}" x2="${sx + padding}" y2="${sy + stitchSize - padding}"
                  stroke="${stitch.color.hex}" stroke-width="2" stroke-linecap="round"/>
        </g>`;
    }

    svg += '</svg>';
    return svg;
}

function generateOpenCrossStitchFormat(stitches, gridWidth, gridHeight, colorCounts) {
    const pattern = {
        format: "Open Cross Stitch Format",
        version: "1.0",
        metadata: {
            title: "Cross Stitch Pattern",
            author: "Cross Stitch Pattern Maker",
            created: new Date().toISOString(),
            description: "Generated cross-stitch pattern"
        },
        pattern: {
            width: gridWidth,
            height: gridHeight,
            stitchCount: stitches.length
        },
        palette: Object.values(colorCounts).map(color => ({
            id: color.id,
            name: color.name,
            hex: color.hex,
            brand: "DMC",
            count: color.count
        })),
        stitches: stitches.map(stitch => ({
            x: stitch.x,
            y: stitch.y,
            color: stitch.color.id,
            type: "full"
        }))
    };

    return JSON.stringify(pattern, null, 2);
}

// ===== Event Handlers =====

uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = 'var(--thread-red)';
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.style.borderColor = 'var(--thread-gold)';
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = 'var(--thread-gold)';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        loadImage(file);
    }
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        loadImage(file);
    }
});

function loadImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        currentImage = e.target.result;
        originalImage.src = currentImage;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            currentImageData = ctx.getImageData(0, 0, img.width, img.height);

            backgroundColor = detectBackgroundColor(currentImageData);
            console.log('Detected background color:', backgroundColor);

            // Update background color indicator
            if (backgroundColor) {
                const r = backgroundColor.r;
                const g = backgroundColor.g;
                const b = backgroundColor.b;
                bgColorIndicator.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
                bgColorIndicator.title = `Detected: rgb(${r}, ${g}, ${b})`;
            }

            uploadZone.classList.add('hidden');
            controls.classList.remove('hidden');
            workspace.classList.remove('hidden');

            generatePattern();
        };
        img.src = currentImage;
    };
    reader.readAsDataURL(file);
}

async function generatePattern() {
    if (!currentImageData) return;

    downloadBtn.disabled = true;
    downloadJsonBtn.disabled = true;
    downloadPngBtn.disabled = true;
    progress.textContent = 'Processing...';

    const gridSize = parseInt(gridSizeInput.value);
    const removeBackground = removeBackgroundCheckbox.checked;
    const tolerance = parseInt(toleranceInput.value);
    const useDithering = useDitheringCheckbox.checked;
    const ditheringAlgorithm = ditheringAlgorithmSelect?.value || 'floyd-steinberg';

    const result = await convertToPattern(
        currentImageData,
        gridSize,
        removeBackground,
        backgroundColor,
        tolerance,
        useDithering,
        ditheringAlgorithm
    );

    // Apply color limiting if enabled
    let finalPattern = result;
    if (maxColorsCheckbox?.checked) {
        const maxColors = parseInt(maxColorsInput?.value || 20);
        finalPattern = limitColors(result, maxColors);
    }

    currentPattern = finalPattern;

    drawPattern(finalPattern.stitches, finalPattern.width, finalPattern.height);

    const colorCount = Object.keys(finalPattern.colorCounts).length;
    const stats = calculatePatternStats(finalPattern.stitches.length, colorCount);

    document.getElementById('statWidth').textContent = finalPattern.width;
    document.getElementById('statHeight').textContent = finalPattern.height;
    document.getElementById('statStitches').textContent = finalPattern.stitches.length.toLocaleString();
    document.getElementById('statColors').textContent = colorCount;

    // Update difficulty and time estimate if elements exist
    const difficultyElem = document.getElementById('statDifficulty');
    const timeElem = document.getElementById('statTime');
    if (difficultyElem) difficultyElem.textContent = stats.difficulty;
    if (timeElem) timeElem.textContent = stats.timeEstimate;

    progress.textContent = '';
    downloadBtn.disabled = false;
    downloadJsonBtn.disabled = false;
    downloadPngBtn.disabled = false;

    // Show zoom controls
    zoomControls.style.display = 'flex';
}

// Control listeners
gridSizeInput.addEventListener('input', (e) => {
    gridSizeValue.textContent = e.target.value;
});

gridSizeInput.addEventListener('change', generatePattern);

removeBackgroundCheckbox.addEventListener('change', (e) => {
    toleranceControl.style.display = e.target.checked ? 'block' : 'none';
    generatePattern();
});

toleranceInput.addEventListener('input', (e) => {
    toleranceValue.textContent = e.target.value;
});

toleranceInput.addEventListener('change', generatePattern);

useDitheringCheckbox.addEventListener('change', generatePattern);

maxColorsCheckbox?.addEventListener('change', (e) => {
    if (maxColorsControl) {
        maxColorsControl.style.display = e.target.checked ? 'block' : 'none';
    }
    generatePattern();
});

maxColorsInput?.addEventListener('input', (e) => {
    if (maxColorsValue) {
        maxColorsValue.textContent = e.target.value;
    }
});

maxColorsInput?.addEventListener('change', generatePattern);

newImageBtn.addEventListener('click', () => {
    currentImage = null;
    currentImageData = null;
    currentPattern = null;
    backgroundColor = null;
    currentZoom = 1;
    baseScale = 1;

    // Reset controls to defaults
    removeBackgroundCheckbox.checked = true;
    toleranceControl.style.display = 'block';

    // Hide zoom controls
    zoomControls.style.display = 'none';

    uploadZone.classList.remove('hidden');
    controls.classList.add('hidden');
    workspace.classList.add('hidden');

    fileInput.value = '';
});

downloadBtn.addEventListener('click', () => {
    if (!currentPattern) return;

    const svg = generateSVG(
        currentPattern.stitches,
        currentPattern.width,
        currentPattern.height
    );

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cross-stitch-pattern.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

downloadJsonBtn.addEventListener('click', () => {
    if (!currentPattern) return;

    const json = generateOpenCrossStitchFormat(
        currentPattern.stitches,
        currentPattern.width,
        currentPattern.height,
        currentPattern.colorCounts
    );

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cross-stitch-pattern.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

downloadPngBtn.addEventListener('click', () => {
    if (!currentPattern) return;

    patternCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cross-stitch-pattern.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 'image/png');
});

// ===== Zoom Controls =====

function updateZoom() {
    const totalScale = baseScale * currentZoom;
    patternCanvas.style.transform = `scale(${totalScale})`;
    patternCanvas.style.transformOrigin = 'top left';
    const zoomPercent = Math.round(currentZoom * 100);
    zoomValue.textContent = `${zoomPercent}%`;
}

zoomInBtn.addEventListener('click', () => {
    currentZoom = Math.min(currentZoom + 0.25, 4);
    updateZoom();
});

zoomOutBtn.addEventListener('click', () => {
    currentZoom = Math.max(currentZoom - 0.25, 0.25);
    updateZoom();
});

zoomResetBtn.addEventListener('click', () => {
    currentZoom = 1;
    updateZoom();
});

// ===== Load Sample Image on Page Load =====

window.addEventListener('DOMContentLoaded', () => {
    // Fetch and load the sample image
    fetch('samples/sample.png')
        .then(response => response.blob())
        .then(blob => {
            const file = new File([blob], 'sample.png', { type: 'image/png' });
            loadImage(file);
        })
        .catch(error => {
            console.log('Sample image not loaded:', error);
            // Silently fail - user can still upload their own image
        });
});
