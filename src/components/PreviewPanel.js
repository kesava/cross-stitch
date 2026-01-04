import { html } from '../htm.js';

/**
 * PreviewPanel Component
 * Shows original image, statistics, and color palette
 */
export function PreviewPanel({ image, pattern, colorCounts }) {
    const sortedColors = Object.values(colorCounts).sort((a, b) => b.count - a.count);

    return html`
        <div className="preview-panel">
            <div className="panel-header">Original Image</div>
            <img src=${image} alt="Original" className="original-image" />

            ${pattern && html`
                <div className="stats">
                    <div className="stat">
                        <div className="stat-value">${pattern.width}</div>
                        <div className="stat-label">Width</div>
                    </div>
                    <div className="stat">
                        <div className="stat-value">${pattern.height}</div>
                        <div className="stat-label">Height</div>
                    </div>
                    <div className="stat">
                        <div className="stat-value">${pattern.stitchCount.toLocaleString()}</div>
                        <div className="stat-label">Stitches</div>
                    </div>
                    <div className="stat">
                        <div className="stat-value">${sortedColors.length}</div>
                        <div className="stat-label">Colors</div>
                    </div>
                </div>
            `}

            ${sortedColors.length > 0 && html`
                <div className="color-palette">
                    ${sortedColors.slice(0, 20).map((color) => html`
                        <div
                            key=${color.id}
                            className="color-swatch"
                            style=${{ backgroundColor: color.hex }}
                            data-count=${color.count}
                            title=${`DMC ${color.id}: ${color.name}`}
                        />
                    `)}
                </div>
            `}
        </div>
    `;
}
