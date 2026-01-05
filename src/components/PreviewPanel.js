import { html } from '../htm.js';
import { calculatePatternStats, generateThreadShoppingList } from '../utils/patternGenerator.js';

const { useState } = React;

/**
 * PreviewPanel Component
 * Shows original image, statistics, and color palette
 */
export function PreviewPanel({ image, pattern, colorCounts, onManualBackgroundPick }) {
    const [isPickingBackground, setIsPickingBackground] = useState(false);
    const sortedColors = Object.values(colorCounts).sort((a, b) => b.count - a.count);

    // Calculate pattern statistics
    const stats = pattern ? calculatePatternStats(pattern.stitchCount, sortedColors.length) : null;

    // Generate shopping list
    const shoppingList = Object.keys(colorCounts).length > 0 ? generateThreadShoppingList(colorCounts) : [];

    const handleImageClick = (e) => {
        if (!isPickingBackground || !image) return;

        const img = e.target;
        const rect = img.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Scale coordinates to image's natural size
        const scaleX = img.naturalWidth / img.width;
        const scaleY = img.naturalHeight / img.height;
        const pixelX = Math.floor(x * scaleX);
        const pixelY = Math.floor(y * scaleY);

        // Create canvas to read pixel data
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(pixelX, pixelY, 1, 1).data;

        const color = {
            r: imageData[0],
            g: imageData[1],
            b: imageData[2]
        };

        setIsPickingBackground(false);
        if (onManualBackgroundPick) {
            onManualBackgroundPick(color);
        }
    };

    return html`
        <div className="preview-panel">
            <div className="panel-header">Original Image</div>
            <div style=${{position: 'relative'}}>
                <img
                    src=${image}
                    alt="Original"
                    className="original-image"
                    onClick=${handleImageClick}
                    style=${{cursor: isPickingBackground ? 'crosshair' : 'default'}}
                />
                ${!pattern && html`
                    <button
                        onClick=${() => setIsPickingBackground(!isPickingBackground)}
                        style=${{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            padding: '8px 12px',
                            background: isPickingBackground ? '#B85450' : 'var(--charcoal)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 'bold'
                        }}
                    >
                        ${isPickingBackground ? '✓ Click Image' : '🎨 Pick Background'}
                    </button>
                `}
            </div>

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
                    ${stats && html`
                        <div className="stat">
                            <div className="stat-value" style=${{fontSize: '1.2rem'}}>${stats.difficulty}</div>
                            <div className="stat-label">Difficulty</div>
                        </div>
                        <div className="stat">
                            <div className="stat-value" style=${{fontSize: '1rem'}}>${stats.timeEstimate}</div>
                            <div className="stat-label">Est. Time</div>
                        </div>
                    `}
                </div>
            `}

            ${shoppingList.length > 0 && html`
                <div style=${{marginTop: '15px', paddingTop: '15px', borderTop: '1px solid var(--linen)'}}>
                    <div className="panel-header" style=${{marginBottom: '10px'}}>Thread Requirements</div>
                    <div style=${{fontSize: '0.85rem', marginBottom: '10px'}}>
                        <strong>Total Skeins:</strong> ${shoppingList.reduce((sum, item) => sum + item.skeinsNeeded, 0)}
                    </div>
                    <div style=${{
                        maxHeight: '200px',
                        overflowY: 'auto',
                        fontSize: '0.75rem',
                        background: 'var(--linen)',
                        padding: '10px',
                        borderRadius: '4px'
                    }}>
                        ${shoppingList.slice(0, 10).map(item => html`
                            <div key=${item.dmcNumber} style=${{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '5px',
                                alignItems: 'center'
                            }}>
                                <div style=${{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                    <div style=${{
                                        width: '15px',
                                        height: '15px',
                                        backgroundColor: item.hex,
                                        border: '1px solid #ccc',
                                        borderRadius: '2px'
                                    }}></div>
                                    <span style=${{fontWeight: 'bold'}}>DMC ${item.dmcNumber}</span>
                                </div>
                                <span>${item.skeinsNeeded} skein${item.skeinsNeeded > 1 ? 's' : ''}</span>
                            </div>
                        `)}
                    </div>
                    ${shoppingList.length > 10 && html`
                        <div style=${{fontSize: '0.7rem', marginTop: '5px', color: 'var(--warm-gray)', fontStyle: 'italic'}}>
                            Showing top 10 of ${shoppingList.length} colors
                        </div>
                    `}
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
                            title=${`DMC ${color.id}: ${color.name} (${color.count} stitches)`}
                        />
                    `)}
                </div>
            `}
        </div>
    `;
}
