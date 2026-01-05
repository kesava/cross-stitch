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
        useDithering = false,
        ditheringAlgorithm = 'floyd-steinberg'
    } = options;

    console.log('Converting with options:', {
        removeBackground,
        backgroundColor,
        tolerance,
        useDithering,
        ditheringAlgorithm
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
 * Limit the number of colors in a pattern by keeping the most-used colors
 * @param {Object} pattern - Pattern with stitches and colorCounts
 * @param {number} maxColors - Maximum number of colors to keep
 * @returns {Object} New pattern with limited colors
 */
export function limitColors(pattern, maxColors) {
    if (maxColors <= 0 || !pattern.colorCounts) return pattern;

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

/**
 * Merge similar colors in a pattern to reduce complexity
 * @param {Object} pattern - Pattern with stitches and colorCounts
 * @param {number} mergeTolerance - Color similarity threshold (0-100)
 * @returns {Object} New pattern with merged colors
 */
export function mergeColors(pattern, mergeTolerance) {
    if (mergeTolerance <= 0 || !pattern.colorCounts) return pattern;

    const colors = Object.values(pattern.colorCounts);
    if (colors.length <= 1) return pattern;

    // Group similar colors
    const colorGroups = [];
    for (const color of colors) {
        const r = parseInt(color.hex.slice(1, 3), 16);
        const g = parseInt(color.hex.slice(3, 5), 16);
        const b = parseInt(color.hex.slice(5, 7), 16);

        // Find existing group with similar color
        let foundGroup = false;
        for (const group of colorGroups) {
            if (isSimilarColor({ r, g, b }, group.representative, mergeTolerance)) {
                group.colors.push(color);
                group.totalCount += color.count;
                foundGroup = true;
                break;
            }
        }

        if (!foundGroup) {
            // Start new group
            colorGroups.push({
                representative: { r, g, b },
                colors: [color],
                totalCount: color.count
            });
        }
    }

    // For each group, pick the most-used color as representative
    const colorMapping = {};
    const newColorCounts = {};

    for (const group of colorGroups) {
        // Find most-used color in group
        const representative = group.colors.reduce((prev, curr) =>
            curr.count > prev.count ? curr : prev
        );

        // Map all colors in group to representative
        for (const color of group.colors) {
            colorMapping[color.id] = representative;
        }

        // Initialize count for representative
        newColorCounts[representative.id] = { ...representative, count: 0 };
    }

    // Update stitches with merged colors
    const newStitches = pattern.stitches.map(stitch => {
        const newColor = colorMapping[stitch.color.id];
        newColorCounts[newColor.id].count++;
        return { ...stitch, color: newColor };
    });

    return {
        ...pattern,
        stitches: newStitches,
        colorCounts: newColorCounts
    };
}

/**
 * Calculate pattern statistics including difficulty and estimated time
 * @param {number} stitchCount - Total number of stitches
 * @param {number} colorCount - Number of different colors
 * @returns {Object} Statistics including difficulty, hours, and rating
 */
export function calculatePatternStats(stitchCount, colorCount) {
    // Average stitching speed: 200-300 stitches per hour
    // Using 250 as middle ground
    const stitchesPerHour = 250;
    const estimatedHours = stitchCount / stitchesPerHour;

    // Difficulty calculation
    let difficulty = 'Beginner';
    let difficultyScore = 0;

    // Base difficulty on stitch count
    if (stitchCount < 2000) {
        difficultyScore += 1; // Very easy
    } else if (stitchCount < 5000) {
        difficultyScore += 2; // Easy
    } else if (stitchCount < 10000) {
        difficultyScore += 3; // Medium
    } else if (stitchCount < 20000) {
        difficultyScore += 4; // Hard
    } else {
        difficultyScore += 5; // Very hard
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
        timeEstimate = `${Math.round(estimatedHours * 60)} minutes`;
    } else if (estimatedHours < 10) {
        timeEstimate = `${estimatedHours.toFixed(1)} hours`;
    } else {
        const days = Math.floor(estimatedHours / 8); // Assuming 8 hours per day
        const remainingHours = Math.round(estimatedHours % 8);
        if (days === 0) {
            timeEstimate = `${Math.round(estimatedHours)} hours`;
        } else if (remainingHours === 0) {
            timeEstimate = `${days} ${days === 1 ? 'day' : 'days'}`;
        } else {
            timeEstimate = `${days} ${days === 1 ? 'day' : 'days'}, ${remainingHours} hrs`;
        }
    }

    return {
        difficulty,
        estimatedHours: estimatedHours.toFixed(1),
        timeEstimate,
        stitchesPerHour
    };
}

/**
 * Generate thread shopping list based on color counts
 * @param {Object} colorCounts - DMC colors with usage counts
 * @returns {Array} Shopping list with DMC numbers, names, and skein requirements
 */
export function generateThreadShoppingList(colorCounts) {
    // DMC floss: 8 meters per skein
    // Average full cross stitch uses ~0.5 cm of thread
    // So 1 skein (800 cm) = ~1600 stitches
    const stitchesPerSkein = 1600;

    const shoppingList = Object.values(colorCounts)
        .map(color => {
            const skeinsNeeded = Math.ceil(color.count / stitchesPerSkein);
            return {
                dmcNumber: color.id,
                name: color.name,
                hex: color.hex,
                stitches: color.count,
                skeinsNeeded: skeinsNeeded
            };
        })
        .sort((a, b) => b.stitches - a.stitches); // Sort by usage

    return shoppingList;
}

/**
 * Export shopping list as text format
 * @param {Array} shoppingList - List from generateThreadShoppingList
 * @returns {string} Formatted text shopping list
 */
export function exportShoppingListText(shoppingList) {
    let text = 'DMC Thread Shopping List\n';
    text += '========================\n\n';
    text += `Total Colors: ${shoppingList.length}\n`;
    text += `Total Skeins: ${shoppingList.reduce((sum, item) => sum + item.skeinsNeeded, 0)}\n\n`;
    text += 'DMC #\tName\t\t\t\tSkeins\tStitches\n';
    text += '-----\t----\t\t\t\t------\t--------\n';

    shoppingList.forEach(item => {
        const namePadded = item.name.padEnd(25);
        text += `${item.dmcNumber}\t${namePadded}\t${item.skeinsNeeded}\t${item.stitches}\n`;
    });

    return text;
}

/**
 * Symbol set for cross-stitch patterns
 * Ordered by visual distinctiveness
 */
const STITCH_SYMBOLS = [
    '•', '○', '■', '□', '▲', '△', '▼', '▽', '◆', '◇',
    '★', '☆', '●', '◐', '◑', '◒', '◓', '♠', '♣', '♥',
    '♦', '⊕', '⊗', '⊙', '⊚', '⊛', '⊜', '⊝', '⊞', '⊟',
    '⊠', '⊡', '▪', '▫', '▬', '▭', '▮', '▯', '◊', '◈',
    '◉', '◎', '◯', '◬', '◭', '◮', '◰', '◱', '◲', '◳',
    '◴', '◵', '◶', '◷', '☀', '☁', '☂', '☃', '☄', '☉',
    '☼', '☽', '☾', '♀', '♂', '♪', '♫', '✓', '✗', '✚',
    '✛', '✜', '✝', '✞', '✟', '✠', '✡', '✢', '✣', '✤'
];

/**
 * Assign symbols to colors in a pattern
 * @param {Object} colorCounts - Color usage counts
 * @returns {Object} Mapping of color ID to symbol
 */
export function assignSymbolsToColors(colorCounts) {
    const symbolMap = {};
    const sortedColors = Object.values(colorCounts)
        .sort((a, b) => b.count - a.count); // Most-used colors get priority symbols

    sortedColors.forEach((color, index) => {
        symbolMap[color.id] = STITCH_SYMBOLS[index % STITCH_SYMBOLS.length];
    });

    return symbolMap;
}

/**
 * Generate SVG pattern from stitches
 *
 * @param {Array} stitches - Array of stitch objects { x, y, color }
 * @param {number} width - Pattern width in stitches
 * @param {number} height - Pattern height in stitches
 * @param {number} stitchSize - Size of each stitch in pixels (default: 10)
 * @param {Object} options - Additional options
 * @param {boolean} options.showSymbols - Whether to show symbols on stitches
 * @param {Object} options.colorCounts - Color usage counts (required if showSymbols is true)
 * @param {boolean} options.showGridNumbers - Whether to show grid numbers every 10 stitches
 * @param {boolean} options.showBorder - Whether to show a decorative border
 * @param {number} options.borderWidth - Border width in pixels (default: 3)
 * @returns {string} SVG string
 */
export function generateSVG(stitches, width, height, stitchSize = 10, options = {}) {
    const {
        showSymbols = false,
        colorCounts = null,
        showGridNumbers = false,
        showBorder = false,
        borderWidth = 3
    } = options;
    const svgWidth = width * stitchSize;
    const svgHeight = height * stitchSize;

    // Calculate margins for grid numbers
    const topMargin = showGridNumbers ? 20 : 0;
    const leftMargin = showGridNumbers ? 30 : 0;
    const rightMargin = showSymbols ? 150 : 0;

    const totalWidth = leftMargin + svgWidth + rightMargin;
    const totalHeight = topMargin + svgHeight;

    let symbolMap = null;
    if (showSymbols && colorCounts) {
        symbolMap = assignSymbolsToColors(colorCounts);
    }

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">`;

    // Add white background for margins
    if (showGridNumbers) {
        svgContent += `<rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="#FFFFFF"/>`;
    }

    // Background grid
    svgContent += `<defs>
        <pattern id="grid" width="${stitchSize}" height="${stitchSize}" patternUnits="userSpaceOnUse">
            <rect width="${stitchSize}" height="${stitchSize}" fill="#F5F0E8"/>
            <path d="M ${stitchSize} 0 L 0 0 0 ${stitchSize}" fill="none" stroke="#E0D8D0" stroke-width="0.5"/>
        </pattern>
    </defs>`;

    // Group for pattern with offset
    svgContent += `<g transform="translate(${leftMargin}, ${topMargin})">`;
    svgContent += `<rect width="${svgWidth}" height="${svgHeight}" fill="url(#grid)"/>`;

    // Add grid numbers if enabled
    if (showGridNumbers) {
        // Top numbers (every 10 stitches)
        for (let x = 10; x <= width; x += 10) {
            const xPos = x * stitchSize;
            svgContent += `<text x="${xPos}" y="${-5}" font-size="10" font-family="Arial, sans-serif" text-anchor="middle" fill="#666666">${x}</text>`;
        }

        // Left numbers (every 10 stitches)
        for (let y = 10; y <= height; y += 10) {
            const yPos = y * stitchSize;
            svgContent += `<text x="${-5}" y="${yPos}" font-size="10" font-family="Arial, sans-serif" text-anchor="end" dominant-baseline="middle" fill="#666666">${y}</text>`;
        }

        // Add darker grid lines every 10 stitches
        for (let x = 10; x < width; x += 10) {
            const xPos = x * stitchSize;
            svgContent += `<line x1="${xPos}" y1="0" x2="${xPos}" y2="${svgHeight}" stroke="#999999" stroke-width="1"/>`;
        }
        for (let y = 10; y < height; y += 10) {
            const yPos = y * stitchSize;
            svgContent += `<line x1="0" y1="${yPos}" x2="${svgWidth}" y2="${yPos}" stroke="#999999" stroke-width="1"/>`;
        }
    }

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

        // Add symbol overlay if enabled
        if (symbolMap) {
            const symbol = symbolMap[stitch.color.id];
            const textX = sx + stitchSize / 2;
            const textY = sy + stitchSize / 2;
            svgContent += `<text x="${textX}" y="${textY}"
                font-size="${stitchSize * 0.6}"
                font-family="Arial, sans-serif"
                text-anchor="middle"
                dominant-baseline="central"
                fill="#000000"
                stroke="#FFFFFF"
                stroke-width="0.5"
                paint-order="stroke"
                style="pointer-events: none;">${symbol}</text>`;
        }
    }

    // Close the transform group
    svgContent += `</g>`;

    // Add decorative border if enabled
    if (showBorder) {
        const borderX = leftMargin - borderWidth;
        const borderY = topMargin - borderWidth;
        const borderBoxWidth = svgWidth + borderWidth * 2;
        const borderBoxHeight = svgHeight + borderWidth * 2;

        // Outer border rectangle
        svgContent += `<rect x="${borderX}" y="${borderY}"
            width="${borderBoxWidth}" height="${borderBoxHeight}"
            fill="none" stroke="#8B4513" stroke-width="${borderWidth}"
            stroke-linejoin="miter"/>`;

        // Inner decorative line
        if (borderWidth >= 3) {
            const innerOffset = Math.floor(borderWidth / 2);
            svgContent += `<rect x="${borderX + innerOffset}" y="${borderY + innerOffset}"
                width="${borderBoxWidth - innerOffset * 2}" height="${borderBoxHeight - innerOffset * 2}"
                fill="none" stroke="#C4A35A" stroke-width="1"/>`;
        }

        // Corner decorations (small circles)
        if (borderWidth >= 3) {
            const cornerRadius = borderWidth * 0.8;
            const corners = [
                { x: borderX, y: borderY }, // Top-left
                { x: borderX + borderBoxWidth, y: borderY }, // Top-right
                { x: borderX, y: borderY + borderBoxHeight }, // Bottom-left
                { x: borderX + borderBoxWidth, y: borderY + borderBoxHeight } // Bottom-right
            ];
            corners.forEach(corner => {
                svgContent += `<circle cx="${corner.x}" cy="${corner.y}" r="${cornerRadius}"
                    fill="#C4A35A" stroke="#8B4513" stroke-width="1"/>`;
            });
        }
    }

    // Add legend if symbols are enabled (outside transform group)
    if (symbolMap && colorCounts) {
        const legendX = leftMargin + svgWidth + 10;
        const legendY = topMargin + 10;
        const lineHeight = 15;

        svgContent += `<g id="legend">`;
        svgContent += `<text x="${legendX}" y="${legendY}" font-size="12" font-weight="bold" fill="#000000">Legend</text>`;

        const sortedColors = Object.values(colorCounts).sort((a, b) => b.count - a.count);
        sortedColors.forEach((color, index) => {
            const y = legendY + 20 + index * lineHeight;
            const symbol = symbolMap[color.id];

            // Color swatch
            svgContent += `<rect x="${legendX}" y="${y - 10}" width="10" height="10" fill="${color.hex}" stroke="#000000" stroke-width="0.5"/>`;
            // Symbol
            svgContent += `<text x="${legendX + 15}" y="${y}" font-size="10" fill="#000000">${symbol}</text>`;
            // DMC number
            svgContent += `<text x="${legendX + 30}" y="${y}" font-size="9" fill="#000000">DMC ${color.id}</text>`;
        });

        svgContent += `</g>`;
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
 * Generate a printable HTML page for PDF export
 * @param {Array} stitches - Array of stitch objects
 * @param {number} width - Pattern width
 * @param {number} height - Pattern height
 * @param {Object} colorCounts - Color usage counts
 * @returns {string} HTML string for printing
 */
export function generatePrintableHTML(stitches, width, height, colorCounts) {
    const svg = generateSVG(stitches, width, height, 10, {
        showSymbols: true,
        colorCounts: colorCounts,
        showGridNumbers: true,
        showBorder: true
    });

    const shoppingList = generateThreadShoppingList(colorCounts);
    const stats = calculatePatternStats(stitches.length, Object.keys(colorCounts).length);

    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Cross Stitch Pattern</title>
    <style>
        @page { size: auto; margin: 1cm; }
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
            page-break-after: avoid;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 20px;
            page-break-after: avoid;
        }
        .stat {
            text-align: center;
            padding: 10px;
            background: #f5f0e8;
            border-radius: 4px;
        }
        .stat-value {
            font-size: 1.5rem;
            font-weight: bold;
            color: #4A6B8A;
        }
        .stat-label {
            font-size: 0.8rem;
            color: #666;
            text-transform: uppercase;
        }
        .pattern {
            margin: 20px 0;
            text-align: center;
            page-break-inside: avoid;
        }
        .pattern svg {
            max-width: 100%;
            height: auto;
        }
        .thread-list {
            margin-top: 30px;
            page-break-before: always;
        }
        .thread-list h2 {
            color: #B85450;
            border-bottom: 2px solid #C4A35A;
            padding-bottom: 10px;
        }
        .thread-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        .thread-table th,
        .thread-table td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        .thread-table th {
            background: #f5f0e8;
            font-weight: bold;
        }
        .color-swatch {
            width: 30px;
            height: 20px;
            border: 1px solid #000;
            display: inline-block;
            margin-right: 10px;
        }
        @media print {
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>✕ Cross Stitch Pattern ✕</h1>
        <p>Generated with Cross Stitch Pattern Maker</p>
    </div>

    <div class="stats">
        <div class="stat">
            <div class="stat-value">${width} × ${height}</div>
            <div class="stat-label">Dimensions</div>
        </div>
        <div class="stat">
            <div class="stat-value">${stitches.length.toLocaleString()}</div>
            <div class="stat-label">Total Stitches</div>
        </div>
        <div class="stat">
            <div class="stat-value">${Object.keys(colorCounts).length}</div>
            <div class="stat-label">Colors</div>
        </div>
        <div class="stat">
            <div class="stat-value">${stats.difficulty}</div>
            <div class="stat-label">Difficulty</div>
        </div>
    </div>

    <div class="pattern">
        ${svg}
    </div>

    <div class="thread-list">
        <h2>Thread Shopping List</h2>
        <p><strong>Total Skeins Required:</strong> ${shoppingList.reduce((sum, item) => sum + item.skeinsNeeded, 0)}</p>
        <table class="thread-table">
            <thead>
                <tr>
                    <th>Color</th>
                    <th>DMC Number</th>
                    <th>Name</th>
                    <th>Stitches</th>
                    <th>Skeins</th>
                </tr>
            </thead>
            <tbody>
                ${shoppingList.map(item => `
                    <tr>
                        <td><span class="color-swatch" style="background-color: ${item.hex};"></span></td>
                        <td><strong>${item.dmcNumber}</strong></td>
                        <td>${item.name}</td>
                        <td>${item.stitches}</td>
                        <td>${item.skeinsNeeded}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="no-print" style="text-align: center; margin-top: 30px;">
        <button onclick="window.print()" style="padding: 15px 30px; font-size: 16px; cursor: pointer;">
            Print or Save as PDF
        </button>
    </div>
</body>
</html>`;

    return html;
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

/**
 * Apply a shape mask to a pattern
 * @param {Object} pattern - Pattern with stitches
 * @param {string} shape - Shape type: 'rectangle', 'circle', 'oval', 'heart', 'diamond'
 * @returns {Object} Filtered pattern
 */
export function applyShapeMask(pattern, shape) {
    if (shape === 'rectangle' || !shape) {
        return pattern; // No masking for rectangle
    }

    const { width, height, stitches } = pattern;
    const centerX = width / 2;
    const centerY = height / 2;

    const filteredStitches = stitches.filter(stitch => {
        const x = stitch.x;
        const y = stitch.y;
        const dx = (x - centerX) / (width / 2);
        const dy = (y - centerY) / (height / 2);

        switch (shape) {
            case 'circle':
                // Circle: distance from center <= 1
                return Math.sqrt(dx * dx + dy * dy) <= 1;

            case 'oval':
                // Oval (ellipse): same as circle but already normalized
                return Math.sqrt(dx * dx + dy * dy) <= 1;

            case 'heart':
                // Heart shape equation
                const t = Math.atan2(dy, dx);
                const r = Math.sqrt(dx * dx + dy * dy);
                const heartR = Math.abs(Math.sin(t) * Math.cos(t) * Math.log(Math.abs(t)) / 2.5);
                return r <= (0.8 + heartR);

            case 'diamond':
                // Diamond: |dx| + |dy| <= 1
                return Math.abs(dx) + Math.abs(dy) <= 1;

            case 'star':
                // Star shape with 5 points
                const angle = Math.atan2(dy, dx);
                const radius = Math.sqrt(dx * dx + dy * dy);
                const pointAngle = (angle + Math.PI) % (2 * Math.PI / 5);
                const starRadius = 0.5 + 0.5 * Math.cos(5 * pointAngle);
                return radius <= starRadius;

            default:
                return true;
        }
    });

    // Recalculate color counts
    const newColorCounts = {};
    for (const stitch of filteredStitches) {
        const colorId = stitch.color.id;
        if (!newColorCounts[colorId]) {
            newColorCounts[colorId] = { ...stitch.color, count: 0 };
        }
        newColorCounts[colorId].count++;
    }

    return {
        ...pattern,
        stitches: filteredStitches,
        colorCounts: newColorCounts
    };
}

/**
 * Generate an image from text
 * @param {string} text - Text to render
 * @param {Object} options - Text rendering options
 * @param {string} options.fontFamily - Font family (default: 'Arial')
 * @param {number} options.fontSize - Font size in pixels (default: 48)
 * @param {string} options.fontColor - Text color (default: '#000000')
 * @param {string} options.backgroundColor - Background color (default: '#FFFFFF')
 * @param {boolean} options.bold - Bold text (default: false)
 * @param {boolean} options.italic - Italic text (default: false)
 * @returns {string} Data URL of generated image
 */
export function generateTextImage(text, options = {}) {
    const {
        fontFamily = 'Arial',
        fontSize = 48,
        fontColor = '#000000',
        backgroundColor = '#FFFFFF',
        bold = false,
        italic = false
    } = options;

    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set font for measurement
    const fontWeight = bold ? 'bold' : 'normal';
    const fontStyle = italic ? 'italic' : 'normal';
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

    // Measure text
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize * 1.5; // Approximate height with padding

    // Set canvas size with padding
    const padding = 20;
    canvas.width = Math.ceil(textWidth + padding * 2);
    canvas.height = Math.ceil(textHeight + padding * 2);

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = fontColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    return canvas.toDataURL();
}
