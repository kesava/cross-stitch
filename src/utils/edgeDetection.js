/**
 * Edge Detection Utilities
 * Implements Sobel filter for object isolation in cross-stitch patterns
 */

/**
 * Convert RGB image to grayscale
 * @param {ImageData} imageData - Canvas ImageData object
 * @returns {Object} Grayscale data { data, width, height }
 */
export function rgbToGrayscale(imageData) {
    const { data, width, height } = imageData;
    const grayscale = new Uint8Array(width * height);

    for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Weighted grayscale (same weights as color matching for consistency)
        grayscale[i] = Math.round(r * 0.3 + g * 0.59 + b * 0.11);
    }

    return { data: grayscale, width, height };
}

/**
 * Apply Sobel operator to detect edges
 * @param {Uint8Array} grayscaleData - Grayscale pixel data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Float32Array} Gradient magnitudes
 */
export function applySobel(grayscaleData, width, height) {
    const data = grayscaleData;
    const gradients = new Float32Array(width * height);

    // Sobel kernels
    const Gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const Gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let gx = 0, gy = 0;

            // Apply 3x3 kernels
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const idx = (y + ky) * width + (x + kx);
                    const kernelIdx = (ky + 1) * 3 + (kx + 1);
                    const pixelValue = data[idx];

                    gx += pixelValue * Gx[kernelIdx];
                    gy += pixelValue * Gy[kernelIdx];
                }
            }

            // Gradient magnitude
            gradients[y * width + x] = Math.sqrt(gx * gx + gy * gy);
        }
    }

    return gradients;
}

/**
 * Apply threshold to gradient map to get binary edge map
 * @param {Float32Array} gradients - Gradient magnitudes
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} threshold - Threshold value (0-255)
 * @returns {Uint8Array} Binary edge map (0=no edge, 1=edge)
 */
export function thresholdEdges(gradients, width, height, threshold) {
    const edgeMap = new Uint8Array(width * height);

    for (let i = 0; i < gradients.length; i++) {
        edgeMap[i] = gradients[i] > threshold ? 1 : 0;
    }

    return edgeMap;
}

/**
 * Dilate edges to thicken and close gaps
 * @param {Uint8Array} edgeMap - Binary edge map
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} iterations - Number of dilation iterations
 * @returns {Uint8Array} Dilated edge map
 */
export function dilateEdges(edgeMap, width, height, iterations = 1) {
    let current = new Uint8Array(edgeMap);

    for (let iter = 0; iter < iterations; iter++) {
        const next = new Uint8Array(width * height);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;

                // If current pixel or any 4-neighbor is an edge, mark as edge
                if (current[idx] === 1 ||
                    current[idx - 1] === 1 ||
                    current[idx + 1] === 1 ||
                    current[idx - width] === 1 ||
                    current[idx + width] === 1) {
                    next[idx] = 1;
                }
            }
        }

        current = next;
    }

    return current;
}

/**
 * Find all connected components in binary image
 * Uses two-pass connected component labeling algorithm
 * @param {Uint8Array} binaryMap - Binary image (0 or 1)
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Array} Array of components with their sizes and representative pixels
 */
export function findConnectedComponents(binaryMap, width, height) {
    const labels = new Int32Array(width * height);
    const equivalences = new Map();
    let nextLabel = 1;

    // First pass: assign provisional labels
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;

            if (binaryMap[idx] === 0) continue;

            const neighbors = [];
            if (x > 0 && labels[idx - 1] > 0) neighbors.push(labels[idx - 1]);
            if (y > 0 && labels[idx - width] > 0) neighbors.push(labels[idx - width]);

            if (neighbors.length === 0) {
                labels[idx] = nextLabel++;
            } else {
                const minLabel = Math.min(...neighbors);
                labels[idx] = minLabel;

                // Record equivalences
                for (const label of neighbors) {
                    if (label !== minLabel) {
                        const existingEquiv = equivalences.get(label) || label;
                        equivalences.set(label, Math.min(minLabel, existingEquiv));
                        equivalences.set(minLabel, Math.min(minLabel, existingEquiv));
                    }
                }
            }
        }
    }

    // Resolve equivalences
    const resolve = (label) => {
        let resolved = label;
        while (equivalences.has(resolved) && equivalences.get(resolved) !== resolved) {
            resolved = equivalences.get(resolved);
        }
        return resolved;
    };

    // Second pass: relabel with resolved labels and count sizes
    const componentSizes = new Map();
    const componentPixels = new Map();

    for (let i = 0; i < labels.length; i++) {
        if (labels[i] > 0) {
            const resolved = resolve(labels[i]);
            labels[i] = resolved;

            componentSizes.set(resolved, (componentSizes.get(resolved) || 0) + 1);
            if (!componentPixels.has(resolved)) {
                componentPixels.set(resolved, []);
            }
            componentPixels.get(resolved).push(i);
        }
    }

    // Return components as array
    const components = [];
    for (const [label, size] of componentSizes.entries()) {
        components.push({
            label,
            size,
            pixels: componentPixels.get(label)
        });
    }

    return components.sort((a, b) => b.size - a.size);
}

/**
 * Create mask from largest non-edge component
 * More robust than simple flood fill
 * @param {Uint8Array} edgeMap - Binary edge map
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Uint8Array} Object mask
 */
export function createMaskFromComponents(edgeMap, width, height) {
    // Invert edge map (we want non-edge regions)
    const inverted = new Uint8Array(width * height);
    for (let i = 0; i < edgeMap.length; i++) {
        inverted[i] = edgeMap[i] === 0 ? 1 : 0;
    }

    // Find all connected components
    const components = findConnectedComponents(inverted, width, height);

    if (components.length === 0) {
        console.warn('No connected components found');
        return new Uint8Array(width * height);
    }

    console.log(`Found ${components.length} connected components`);
    console.log(`Largest component: ${components[0].size} pixels (${(components[0].size / (width * height) * 100).toFixed(1)}%)`);

    // Check if largest component is likely background (touches multiple edges)
    const largestComp = components[0];
    const edgeTouches = checkEdgeTouches(largestComp.pixels, width, height);

    let objectComponent;
    if (edgeTouches >= 3 && components.length > 1) {
        // Largest component touches 3+ edges, it's probably background
        // Use second largest as object
        console.log('Largest component touches edges, using second largest as object');
        objectComponent = components[1];
    } else {
        // Largest component doesn't touch edges or is the only component
        objectComponent = largestComp;
    }

    // Create mask from selected component
    const mask = new Uint8Array(width * height);
    for (const pixelIdx of objectComponent.pixels) {
        mask[pixelIdx] = 1;
    }

    return mask;
}

/**
 * Check how many image edges a component touches
 * @param {Array} pixels - Array of pixel indices
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {number} Number of edges touched (0-4)
 */
function checkEdgeTouches(pixels, width, height) {
    let touchesTop = false;
    let touchesBottom = false;
    let touchesLeft = false;
    let touchesRight = false;

    for (const idx of pixels) {
        const x = idx % width;
        const y = Math.floor(idx / width);

        if (y === 0) touchesTop = true;
        if (y === height - 1) touchesBottom = true;
        if (x === 0) touchesLeft = true;
        if (x === width - 1) touchesRight = true;

        if (touchesTop && touchesBottom && touchesLeft && touchesRight) break;
    }

    return [touchesTop, touchesBottom, touchesLeft, touchesRight].filter(Boolean).length;
}

/**
 * Erode binary image to remove noise
 * @param {Uint8Array} binaryMap - Binary image
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} iterations - Number of erosion iterations
 * @returns {Uint8Array} Eroded image
 */
export function erodeBinary(binaryMap, width, height, iterations = 1) {
    let current = new Uint8Array(binaryMap);

    for (let iter = 0; iter < iterations; iter++) {
        const next = new Uint8Array(width * height);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;

                // Keep pixel only if all 8 neighbors are also 1
                if (current[idx] === 1 &&
                    current[idx - 1] === 1 &&
                    current[idx + 1] === 1 &&
                    current[idx - width] === 1 &&
                    current[idx + width] === 1 &&
                    current[idx - width - 1] === 1 &&
                    current[idx - width + 1] === 1 &&
                    current[idx + width - 1] === 1 &&
                    current[idx + width + 1] === 1) {
                    next[idx] = 1;
                }
            }
        }

        current = next;
    }

    return current;
}

/**
 * Create object mask using Sobel edge detection
 * Main function that combines all steps
 *
 * @param {ImageData} imageData - Canvas ImageData object
 * @param {Object} options - Detection options
 * @param {number} options.edgeThreshold - Edge detection threshold (default: 100)
 * @param {number} options.edgeDilation - Edge dilation iterations (default: 3)
 * @returns {Uint8Array} Object mask (0=background, 1=object)
 */
export function createObjectMask(imageData, options = {}) {
    const {
        edgeThreshold = 100,
        edgeDilation = 3
    } = options;
    const { width, height } = imageData;

    console.log('Creating object mask with improved Sobel edge detection...', {
        edgeThreshold,
        edgeDilation
    });

    // Step 1: Convert to grayscale
    const grayscale = rgbToGrayscale(imageData);

    // Step 2: Apply Sobel filter
    const gradients = applySobel(grayscale.data, width, height);

    // Step 3: Threshold edges
    const edgeMap = thresholdEdges(gradients, width, height, edgeThreshold);

    // Step 4: Dilate edges to close gaps
    const dilatedEdges = dilateEdges(edgeMap, width, height, edgeDilation);

    // Step 5: Find object using connected component analysis
    const mask = createMaskFromComponents(dilatedEdges, width, height);

    const maskedPixels = mask.reduce((sum, val) => sum + val, 0);
    const percentage = (maskedPixels / (width * height) * 100).toFixed(1);
    console.log(`Object mask created: ${maskedPixels} pixels (${percentage}% of image)`);

    return mask;
}
