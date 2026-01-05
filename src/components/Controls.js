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
    onDitheringChange,
    ditheringAlgorithm,
    onDitheringAlgorithmChange,
    useMaxColors,
    onUseMaxColorsChange,
    maxColors,
    onMaxColorsChange,
    useMergeColors,
    onUseMergeColorsChange,
    mergeTolerance,
    onMergeToleranceChange,
    showSymbols,
    onShowSymbolsChange,
    showGridNumbers,
    onShowGridNumbersChange,
    showBorder,
    onShowBorderChange,
    patternShape,
    onPatternShapeChange
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
                <div className="help-text">Improves gradients and details</div>

                ${useDithering && html`
                    <label style=${{marginTop: '10px', display: 'block'}}>Dithering Algorithm:</label>
                    <select
                        value=${ditheringAlgorithm}
                        onChange=${(e) => onDitheringAlgorithmChange(e.target.value)}
                        style=${{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '4px',
                            border: '1px solid var(--warm-gray)',
                            background: 'white',
                            marginTop: '5px'
                        }}
                    >
                        <option value="floyd-steinberg">Floyd-Steinberg (detailed)</option>
                        <option value="atkinson">Atkinson (lighter, artistic)</option>
                    </select>
                `}
            </div>

            <div className="control-group">
                <label>
                    <input
                        type="checkbox"
                        checked=${useMaxColors}
                        onChange=${(e) => onUseMaxColorsChange(e.target.checked)}
                    />
                    Limit Color Palette
                </label>
                <div className="help-text">Restrict pattern to a maximum number of DMC colors</div>

                ${useMaxColors && html`
                    <label style=${{marginTop: '10px', display: 'block'}}>Maximum Colors:</label>
                    <input
                        type="range"
                        min="5"
                        max="50"
                        value=${maxColors}
                        onChange=${(e) => onMaxColorsChange(Number(e.target.value))}
                    />
                    <span className="control-value">${maxColors}</span>
                    <div className="help-text">Easier for beginners or limited thread collections</div>
                `}
            </div>

            <div className="control-group">
                <label>
                    <input
                        type="checkbox"
                        checked=${useMergeColors}
                        onChange=${(e) => onUseMergeColorsChange(e.target.checked)}
                    />
                    Merge Similar Colors
                </label>
                <div className="help-text">Simplify pattern by merging colors that look alike</div>

                ${useMergeColors && html`
                    <label style=${{marginTop: '10px', display: 'block'}}>Merge Tolerance:</label>
                    <input
                        type="range"
                        min="10"
                        max="80"
                        value=${mergeTolerance}
                        onChange=${(e) => onMergeToleranceChange(Number(e.target.value))}
                    />
                    <span className="control-value">${mergeTolerance}</span>
                    <div className="help-text">Higher = more aggressive merging (try 25-40)</div>
                `}
            </div>

            <div className="control-group">
                <label>
                    <input
                        type="checkbox"
                        checked=${showSymbols}
                        onChange=${(e) => onShowSymbolsChange(e.target.checked)}
                    />
                    Show Symbols on Pattern
                </label>
                <div className="help-text">Add symbols to stitches for easier pattern following</div>
            </div>

            <div className="control-group">
                <label>
                    <input
                        type="checkbox"
                        checked=${showGridNumbers}
                        onChange=${(e) => onShowGridNumbersChange(e.target.checked)}
                    />
                    Show Grid Numbers
                </label>
                <div className="help-text">Add row/column numbers every 10 stitches</div>
            </div>

            <div className="control-group">
                <label>
                    <input
                        type="checkbox"
                        checked=${showBorder}
                        onChange=${(e) => onShowBorderChange(e.target.checked)}
                    />
                    Show Decorative Border
                </label>
                <div className="help-text">Add a decorative border around the pattern</div>
            </div>

            <div className="control-group">
                <label>Pattern Shape</label>
                <select
                    value=${patternShape}
                    onChange=${(e) => onPatternShapeChange(e.target.value)}
                    style=${{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid var(--warm-gray)',
                        background: 'white',
                        marginTop: '5px'
                    }}
                >
                    <option value="rectangle">Rectangle (Full)</option>
                    <option value="circle">Circle</option>
                    <option value="oval">Oval (Ellipse)</option>
                    <option value="heart">Heart</option>
                    <option value="diamond">Diamond</option>
                    <option value="star">Star</option>
                </select>
                <div className="help-text">Apply a shape mask to the pattern</div>
            </div>

            <div className="control-group">
                <button className="download-btn" onClick=${onNewImage}>
                    ✕ New Image
                </button>
            </div>
        </div>
    `;
}
