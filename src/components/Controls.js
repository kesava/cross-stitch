import { html } from '../htm.js';

/**
 * Controls Component
 * Pattern width slider, background removal controls, dithering, and new image button
 */
export function Controls({
    gridSize,
    onGridSizeChange,
    onNewImage,
    removeBackground,
    onRemoveBackgroundChange,
    tolerance,
    onToleranceChange,
    backgroundColor,
    useDithering,
    onDitheringChange
}) {
    const rgbToHex = (r, g, b) => {
        return "#" + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        }).join('');
    };

    return html`
        <div className="controls">
            <div className="control-group">
                <label>Pattern Width</label>
                <input
                    type="range"
                    min="20"
                    max="150"
                    value=${gridSize}
                    onChange=${(e) => onGridSizeChange(Number(e.target.value))}
                />
                <span className="control-value">${gridSize} stitches</span>
            </div>

            <div className="control-group">
                <label>
                    <input
                        type="checkbox"
                        checked=${removeBackground}
                        onChange=${(e) => onRemoveBackgroundChange(e.target.checked)}
                    />
                    Remove Background
                    ${backgroundColor && html`
                        <span
                            className="bg-indicator"
                            style=${{backgroundColor: rgbToHex(backgroundColor.r, backgroundColor.g, backgroundColor.b)}}
                            title=${`Detected: rgb(${backgroundColor.r}, ${backgroundColor.g}, ${backgroundColor.b})`}
                        />
                    `}
                </label>
                <div className="help-text">Detected from image edges automatically</div>
            </div>

            ${removeBackground && html`
                <div className="control-group">
                    <label>Background Tolerance</label>
                    <input
                        type="range"
                        min="10"
                        max="100"
                        value=${tolerance}
                        onChange=${(e) => onToleranceChange(Number(e.target.value))}
                    />
                    <span className="control-value">${tolerance}</span>
                    <div className="help-text">Higher = removes more similar colors (try 30-50 for solid backgrounds)</div>
                </div>
            `}

            <div className="control-group">
                <label>
                    <input
                        type="checkbox"
                        checked=${useDithering}
                        onChange=${(e) => onDitheringChange(e.target.checked)}
                    />
                    Use Dithering
                </label>
                <div className="help-text">Improves gradients and details using Floyd-Steinberg algorithm</div>
            </div>

            <div className="control-group">
                <button className="download-btn" onClick=${onNewImage}>
                    ✕ New Image
                </button>
            </div>
        </div>
    `;
}
