import { DMC_COLORS } from '../data/dmcColors.js';

/**
 * Find the closest DMC thread color to a given RGB value
 * Uses weighted Euclidean distance in RGB space
 * Weights match human eye sensitivity: R=0.3, G=0.59, B=0.11
 *
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {Object} Closest DMC color object { id, hex, name }
 */
export function findClosestDMC(r, g, b) {
    let minDistance = Infinity;
    let closestColor = DMC_COLORS[0];

    for (const dmc of DMC_COLORS) {
        const dr = parseInt(dmc.hex.slice(1, 3), 16) - r;
        const dg = parseInt(dmc.hex.slice(3, 5), 16) - g;
        const db = parseInt(dmc.hex.slice(5, 7), 16) - b;

        // Weighted distance (human eye is more sensitive to green)
        const distance = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;

        if (distance < minDistance) {
            minDistance = distance;
            closestColor = dmc;
        }
    }

    return closestColor;
}

/**
 * Extract RGB values from hex color string
 * @param {string} hex - Hex color string (e.g., "#FF0000")
 * @returns {Object} RGB values { r, g, b }
 */
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Convert RGB values to hex color string
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {string} Hex color string (e.g., "#FF0000")
 */
export function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

/**
 * Calculate weighted Euclidean distance between two colors
 * Uses same weighting as DMC matching for consistency
 * @param {Object} color1 - First color { r, g, b }
 * @param {Object} color2 - Second color { r, g, b }
 * @returns {number} Distance value (lower = more similar)
 */
export function colorDistance(color1, color2) {
    const dr = color1.r - color2.r;
    const dg = color1.g - color2.g;
    const db = color1.b - color2.b;

    // Weighted distance (human eye is more sensitive to green)
    return Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11);
}

/**
 * Check if two colors are similar within a tolerance threshold
 * @param {Object} color1 - First color { r, g, b }
 * @param {Object} color2 - Second color { r, g, b }
 * @param {number} tolerance - Maximum distance to be considered similar (default: 30)
 * @returns {boolean} True if colors are similar
 */
export function isSimilarColor(color1, color2, tolerance = 30) {
    return colorDistance(color1, color2) < tolerance;
}
