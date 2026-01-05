import { html } from '../htm.js';

const { useState, useEffect, useRef } = React;

/**
 * PatternPanel Component
 * Shows the generated cross-stitch pattern with zoom controls and download buttons
 */
export function PatternPanel({ pattern, isConverting, progress, onDownload, onDownloadOpenFormat, onDownloadPNG, onDownloadShoppingList, onPrintPDF }) {
    const [zoom, setZoom] = useState(1);
    const [baseScale, setBaseScale] = useState(1);
    const containerRef = useRef(null);

    // Calculate base scale to fit pattern in container
    useEffect(() => {
        if (pattern && containerRef.current) {
            const container = containerRef.current;
            const containerWidth = container.clientWidth - 40; // Account for padding
            const containerHeight = container.clientHeight - 40;

            // Pattern canvas size (assuming 10px per stitch)
            const patternWidth = pattern.width * 10;
            const patternHeight = pattern.height * 10;

            // Calculate scale to fit
            const scaleX = containerWidth / patternWidth;
            const scaleY = containerHeight / patternHeight;
            const fitScale = Math.min(scaleX, scaleY, 1); // Never scale up beyond 100%

            setBaseScale(fitScale);
            setZoom(1); // Reset zoom when pattern changes
        }
    }, [pattern]);

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 4));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.25));
    const handleZoomReset = () => setZoom(1);

    const totalScale = baseScale * zoom;
    const zoomPercent = Math.round(zoom * 100);

    return html`
        <div className="pattern-panel">
            <div className="panel-header">Cross Stitch Pattern</div>

            ${isConverting && html`
                <${React.Fragment}>
                    <div className="progress-bar">
                        <div className="progress-fill" style=${{ width: `${progress}%` }} />
                    </div>
                    <p className="converting-text">Converting... ${progress}%</p>
                <//>
            `}

            ${pattern ? html`
                <${React.Fragment}>
                    <div className="zoom-controls">
                        <button className="zoom-btn" onClick=${handleZoomOut} title="Zoom Out">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M2 7h12v2H2z"/>
                            </svg>
                        </button>
                        <span className="zoom-value">${zoomPercent}%</span>
                        <button className="zoom-btn" onClick=${handleZoomIn} title="Zoom In">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M14 7H9V2H7v5H2v2h5v5h2V9h5z"/>
                            </svg>
                        </button>
                        <button className="zoom-btn" onClick=${handleZoomReset} title="Reset Zoom">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 3a5 5 0 100 10A5 5 0 008 3zM2 8a6 6 0 1112 0A6 6 0 012 8z"/>
                                <path d="M5 7h6v2H5z"/>
                            </svg>
                        </button>
                    </div>
                    <div className="pattern-container" ref=${containerRef}>
                        <div
                            className="pattern-svg"
                            style=${{ transform: `scale(${totalScale})`, transformOrigin: 'top left' }}
                            dangerouslySetInnerHTML=${{ __html: pattern.svg }}
                        />
                    </div>
                    <div className="download-buttons">
                        <button className="download-btn" onClick=${onDownload}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 12L3 7h3V1h4v6h3L8 12z" />
                                <path d="M14 14H2v-2h12v2z" />
                            </svg>
                            Download SVG
                        </button>
                        <button className="download-btn download-btn-secondary" onClick=${onDownloadOpenFormat}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 12L3 7h3V1h4v6h3L8 12z" />
                                <path d="M14 14H2v-2h12v2z" />
                            </svg>
                            Download Pattern (JSON)
                        </button>
                        <button className="download-btn" onClick=${onDownloadPNG}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 12L3 7h3V1h4v6h3L8 12z" />
                                <path d="M14 14H2v-2h12v2z" />
                            </svg>
                            Download PNG
                        </button>
                        <button className="download-btn" onClick=${onDownloadShoppingList}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 12L3 7h3V1h4v6h3L8 12z" />
                                <path d="M14 14H2v-2h12v2z" />
                            </svg>
                            Download Thread List
                        </button>
                        <button className="download-btn download-btn-secondary" onClick=${onPrintPDF}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M5 1h6v3H5V1z"/>
                                <path d="M3 5h10a2 2 0 012 2v4H1V7a2 2 0 012-2z"/>
                                <path d="M4 12h8v3H4v-3z"/>
                            </svg>
                            Print/PDF Pattern
                        </button>
                    </div>
                <//>
            ` : !isConverting && html`
                <div className="empty-state">
                    <p>Processing image...</p>
                </div>
            `}
        </div>
    `;
}
