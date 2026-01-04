import { findClosestDMC, isSimilarColor } from './colorUtils.js';

/**
 * Detect background color by sampling edges of the image
 * Uses edge sampling approach: samples corners and edge midpoints
 *
 * @param {ImageData} imageData - Canvas ImageData object
 * @returns {Object} Most common edge color { r, g, b }
 */
export function detectBackgroundColor(imageData) {
    const { data, width, height } = imageData;
    const samples = [];

    // Sample positions: 4 corners + 4 edge midpoints
    const positions = [
        // Corners
        { x: 0, y: 0 },
        { x: width - 1, y: 0 },
        { x: 0, y: height - 1 },
        { x: width - 1, y: height - 1 },
        // Edge midpoints
        { x: Math.floor(width / 2), y: 0 },
        { x: Math.floor(width / 2), y: height - 1 },
        { x: 0, y: Math.floor(height / 2) },
        { x: width - 1, y: Math.floor(height / 2) },
    ];

    // Sample additional points along edges (every 10% of width/height)
    for (let i = 1; i < 10; i++) {
        const offset = i / 10;
        positions.push(
            { x: Math.floor(width * offset), y: 0 }, // Top edge
            { x: Math.floor(width * offset), y: height - 1 }, // Bottom edge
            { x: 0, y: Math.floor(height * offset) }, // Left edge
            { x: width - 1, y: Math.floor(height * offset) } // Right edge
        );
    }

    // Extract colors from sample positions
    for (const pos of positions) {
        const idx = (pos.y * width + pos.x) * 4;
        samples.push({
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2]
        });
    }

    // Find most common color (with tolerance for slight variations)
    const colorGroups = [];
    const tolerance = 20; // Group similar colors together

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

    // Return the most common color group
    colorGroups.sort((a, b) => b.count - a.count);
    return colorGroups[0].color;
}

/**
 * Convert image data to cross-stitch pattern
 * Processes in chunks to avoid blocking the UI thread
 *
 * @param {ImageData} imageData - Canvas ImageData object
 * @param {number} gridSize - Number of stitches in width
 * @param {Function} onProgress - Callback for progress updates (0-100)
 * @param {Object} options - Optional settings
 * @param {boolean} options.removeBackground - Remove background by color
 * @param {Object} options.backgroundColor - Background color { r, g, b }
 * @param {number} options.tolerance - Color tolerance
 * @param {boolean} options.useDithering - Apply Floyd-Steinberg dithering
 * @returns {Promise<Object>} Pattern object { stitches, width, height, colorCounts }
 */
export async function convertToPattern(imageData, gridSize, onProgress, options = {}) {
    const {
        removeBackground = false,
        backgroundColor = null,
        tolerance = 30,
        useDithering = false
    } = options;

    console.log('Converting with options:', {
        removeBackground,
        backgroundColor,
        tolerance,
        useDithering
    });

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
    let processed = 0;
    let skipped = 0;
    const total = gridWidth * gridHeight;

    return new Promise((resolve) => {
        const processChunk = (startY) => {
            const chunkSize = 5;
            const endY = Math.min(startY + chunkSize, gridHeight);

            for (let y = startY; y < endY; y++) {
                for (let x = 0; x < gridWidth; x++) {
                    // Sample center of cell
                    const sampleX = Math.floor(x * cellWidth + cellWidth / 2);
                    const sampleY = Math.floor(y * cellHeight + cellHeight / 2);
                    const idx = (sampleY * width + sampleX) * 4;

                    const r = workingData[idx];
                    const g = workingData[idx + 1];
                    const b = workingData[idx + 2];
                    const a = workingData[idx + 3];

                    if (a > 128) {
                        // Check color-based background removal
                        if (removeBackground && backgroundColor) {
                            const isBackground = isSimilarColor({ r, g, b }, backgroundColor, tolerance);
                            if (isBackground) {
                                processed++;
                                skipped++;
                                continue;
                            }
                        }

                        const dmc = findClosestDMC(r, g, b);
                        stitches.push({ x, y, color: dmc });
                        colorCounts[dmc.id] = colorCounts[dmc.id] || { ...dmc, count: 0 };
                        colorCounts[dmc.id].count++;

                        // Apply Floyd-Steinberg dithering
                        if (useDithering) {
                            const dmcR = parseInt(dmc.hex.slice(1, 3), 16);
                            const dmcG = parseInt(dmc.hex.slice(3, 5), 16);
                            const dmcB = parseInt(dmc.hex.slice(5, 7), 16);

                            const errorR = r - dmcR;
                            const errorG = g - dmcG;
                            const errorB = b - dmcB;

                            // Distribute error to neighboring pixels
                            // Right pixel (x+1, y): 7/16
                            distributeError(workingData, width, height, sampleX + 1, sampleY, errorR, errorG, errorB, 7/16);
                            // Bottom-left pixel (x-1, y+1): 3/16
                            distributeError(workingData, width, height, sampleX - 1, sampleY + 1, errorR, errorG, errorB, 3/16);
                            // Bottom pixel (x, y+1): 5/16
                            distributeError(workingData, width, height, sampleX, sampleY + 1, errorR, errorG, errorB, 5/16);
                            // Bottom-right pixel (x+1, y+1): 1/16
                            distributeError(workingData, width, height, sampleX + 1, sampleY + 1, errorR, errorG, errorB, 1/16);
                        }
                    }

                    processed++;
                }
            }

            onProgress(Math.round((processed / total) * 100));

            if (endY < gridHeight) {
                requestAnimationFrame(() => processChunk(endY));
            } else {
                console.log(`Conversion complete: ${stitches.length} stitches, ${skipped} pixels skipped as background`);
                resolve({
                    stitches,
                    width: gridWidth,
                    height: gridHeight,
                    colorCounts
                });
            }
        };

        requestAnimationFrame(() => processChunk(0));
    });
}

/**
 * Distribute quantization error to a neighboring pixel (Floyd-Steinberg)
 * @private
 */
function distributeError(data, width, height, x, y, errorR, errorG, errorB, factor) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;

    const idx = (y * width + x) * 4;
    data[idx] = Math.max(0, Math.min(255, data[idx] + errorR * factor));
    data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + errorG * factor));
    data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + errorB * factor));
}

/**
 * Generate SVG pattern from stitches
 *
 * @param {Array} stitches - Array of stitch objects { x, y, color }
 * @param {number} width - Pattern width in stitches
 * @param {number} height - Pattern height in stitches
 * @param {number} stitchSize - Size of each stitch in pixels (default: 10)
 * @returns {string} SVG string
 */
export function generateSVG(stitches, width, height, stitchSize = 10) {
    const svgWidth = width * stitchSize;
    const svgHeight = height * stitchSize;

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">`;

    // Background grid
    svgContent += `<defs>
        <pattern id="grid" width="${stitchSize}" height="${stitchSize}" patternUnits="userSpaceOnUse">
            <rect width="${stitchSize}" height="${stitchSize}" fill="#F5F0E8"/>
            <path d="M ${stitchSize} 0 L 0 0 0 ${stitchSize}" fill="none" stroke="#E0D8D0" stroke-width="0.5"/>
        </pattern>
    </defs>`;
    svgContent += `<rect width="100%" height="100%" fill="url(#grid)"/>`;

    // Cross stitches
    for (const stitch of stitches) {
        const sx = stitch.x * stitchSize;
        const sy = stitch.y * stitchSize;
        const padding = 1;

        // Draw X stitch
        svgContent += `<g>
            <line x1="${sx + padding}" y1="${sy + padding}" x2="${sx + stitchSize - padding}" y2="${sy + stitchSize - padding}"
                  stroke="${stitch.color.hex}" stroke-width="2" stroke-linecap="round"/>
            <line x1="${sx + stitchSize - padding}" y1="${sy + padding}" x2="${sx + padding}" y2="${sy + stitchSize - padding}"
                  stroke="${stitch.color.hex}" stroke-width="2" stroke-linecap="round"/>
        </g>`;
    }

    svgContent += '</svg>';

    return svgContent;
}

/**
 * Generate Open Cross Stitch format (JSON)
 *
 * @param {Array} stitches - Array of stitch objects { x, y, color }
 * @param {number} width - Pattern width in stitches
 * @param {number} height - Pattern height in stitches
 * @param {Object} colorCounts - DMC color usage counts
 * @returns {string} JSON string
 */
export function generateOpenCrossStitchFormat(stitches, width, height, colorCounts) {
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
            width,
            height,
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
            type: "full" // Full cross stitch
        }))
    };

    return JSON.stringify(pattern, null, 2);
}

/**
 * Load image data from image source
 *
 * @param {string} imageSrc - Image source (data URL or URL)
 * @returns {Promise<Object>} Image data { data, width, height }
 */
export function loadImageData(imageSrc) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(ctx.getImageData(0, 0, img.width, img.height));
        };
        img.onerror = reject;
        img.src = imageSrc;
    });
}
