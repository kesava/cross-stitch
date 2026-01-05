import { html } from '../htm.js';
import { loadImageData, convertToPattern, generateSVG, generateOpenCrossStitchFormat, detectBackgroundColor, limitColors, mergeColors, generateThreadShoppingList, exportShoppingListText, generatePrintableHTML, applyShapeMask } from '../utils/patternGenerator.js';
import { Header } from './Header.js';
import { UploadZone } from './UploadZone.js';
import { Controls } from './Controls.js';
import { PreviewPanel } from './PreviewPanel.js';
import { PatternPanel } from './PatternPanel.js';

const { useState, useEffect } = React;

/**
 * Main App Component
 * Orchestrates the entire cross-stitch pattern generation workflow
 */
export function App() {
    const [image, setImage] = useState(null);
    const [imageData, setImageData] = useState(null);
    const [gridSize, setGridSize] = useState(60);
    const [pattern, setPattern] = useState(null);
    const [progress, setProgress] = useState(0);
    const [isConverting, setIsConverting] = useState(false);
    const [colorCounts, setColorCounts] = useState({});

    // Color-based background removal state
    const [removeBackground, setRemoveBackground] = useState(true);
    const [backgroundColor, setBackgroundColor] = useState(null);
    const [tolerance, setTolerance] = useState(40);
    const [useDithering, setUseDithering] = useState(false);
    const [ditheringAlgorithm, setDitheringAlgorithm] = useState('floyd-steinberg');
    const [useMaxColors, setUseMaxColors] = useState(false);
    const [maxColors, setMaxColors] = useState(20);
    const [useMergeColors, setUseMergeColors] = useState(false);
    const [mergeTolerance, setMergeTolerance] = useState(30);
    const [showSymbols, setShowSymbols] = useState(false);
    const [showGridNumbers, setShowGridNumbers] = useState(false);
    const [showBorder, setShowBorder] = useState(false);
    const [patternShape, setPatternShape] = useState('rectangle');

    // Load sample image on mount
    useEffect(() => {
        setImage('samples/sample.png');
    }, []);

    // Load image data when image changes
    useEffect(() => {
        if (!image) return;

        loadImageData(image)
            .then((imgData) => {
                setImageData(imgData);
                // Automatically detect background color
                const bgColor = detectBackgroundColor(imgData);
                console.log('Detected background color:', bgColor);
                setBackgroundColor(bgColor);
            })
            .catch(console.error);
    }, [image]);

    // Convert to cross stitch pattern when imageData, gridSize, or background settings change
    useEffect(() => {
        if (!imageData) return;

        setIsConverting(true);
        setProgress(0);
        setPattern(null);

        convertToPattern(imageData, gridSize, setProgress, {
            removeBackground,
            backgroundColor,
            tolerance,
            useDithering,
            ditheringAlgorithm
        })
            .then((result) => {
                // Apply color limiting if enabled
                let finalResult = result;
                if (useMaxColors) {
                    finalResult = limitColors(result, maxColors);
                }

                // Apply color merging if enabled
                if (useMergeColors) {
                    finalResult = mergeColors(finalResult, mergeTolerance);
                }

                // Apply shape mask if not rectangle
                if (patternShape !== 'rectangle') {
                    finalResult = applyShapeMask(finalResult, patternShape);
                }

                const svg = generateSVG(finalResult.stitches, finalResult.width, finalResult.height, 10, {
                    showSymbols,
                    colorCounts: finalResult.colorCounts,
                    showGridNumbers,
                    showBorder
                });
                setPattern({
                    svg,
                    stitches: finalResult.stitches,
                    width: finalResult.width,
                    height: finalResult.height,
                    stitchCount: finalResult.stitches.length
                });
                setColorCounts(finalResult.colorCounts);
                setIsConverting(false);
            })
            .catch(console.error);
    }, [imageData, gridSize, removeBackground, backgroundColor, tolerance, useDithering, ditheringAlgorithm, useMaxColors, maxColors, useMergeColors, mergeTolerance, showSymbols, showGridNumbers, showBorder, patternShape]);

    const handleFileSelect = (imageSrc) => {
        setImage(imageSrc);
        setPattern(null);
        setProgress(0);
        setColorCounts({});
    };

    const handleNewImage = () => {
        setImage(null);
        setImageData(null);
        setPattern(null);
        setBackgroundColor(null);
        setRemoveBackground(true);
    };

    const handleManualBackgroundPick = (color) => {
        setBackgroundColor(color);
        setRemoveBackground(true); // Auto-enable background removal when manually picked
    };

    const downloadSVG = () => {
        if (!pattern) return;

        const blob = new Blob([pattern.svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cross-stitch-pattern.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const downloadOpenFormat = () => {
        if (!pattern) return;

        const json = generateOpenCrossStitchFormat(
            pattern.stitches,
            pattern.width,
            pattern.height,
            colorCounts
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
    };

    const downloadPNG = () => {
        if (!pattern) return;

        // Create a temporary canvas
        const canvas = document.createElement('canvas');
        const stitchSize = 10;
        canvas.width = pattern.width * stitchSize;
        canvas.height = pattern.height * stitchSize;
        const ctx = canvas.getContext('2d');

        // Create an image from the SVG
        const svgBlob = new Blob([pattern.svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();

        img.onload = () => {
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);

            // Convert canvas to PNG blob and download
            canvas.toBlob((blob) => {
                const pngUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = pngUrl;
                a.download = 'cross-stitch-pattern.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(pngUrl);
            }, 'image/png');
        };

        img.src = url;
    };

    const downloadShoppingList = () => {
        if (!colorCounts || Object.keys(colorCounts).length === 0) return;

        const shoppingList = generateThreadShoppingList(colorCounts);
        const text = exportShoppingListText(shoppingList);

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'thread-shopping-list.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const openPrintablePattern = () => {
        if (!pattern) return;

        const html = generatePrintableHTML(pattern.stitches, pattern.width, pattern.height, colorCounts);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
    };

    return html`
        <div className="app-container">
            <div className="thread-decoration top-left"></div>
            <div className="thread-decoration bottom-right"></div>

            <${Header} />

            ${!image ? html`
                <${UploadZone} onFileSelect=${handleFileSelect} />
            ` : html`
                <${React.Fragment}>
                    <${Controls}
                        gridSize=${gridSize}
                        onGridSizeChange=${setGridSize}
                        onNewImage=${handleNewImage}
                        removeBackground=${removeBackground}
                        onRemoveBackgroundChange=${setRemoveBackground}
                        tolerance=${tolerance}
                        onToleranceChange=${setTolerance}
                        backgroundColor=${backgroundColor}
                        useDithering=${useDithering}
                        onDitheringChange=${setUseDithering}
                        ditheringAlgorithm=${ditheringAlgorithm}
                        onDitheringAlgorithmChange=${setDitheringAlgorithm}
                        useMaxColors=${useMaxColors}
                        onUseMaxColorsChange=${setUseMaxColors}
                        maxColors=${maxColors}
                        onMaxColorsChange=${setMaxColors}
                        useMergeColors=${useMergeColors}
                        onUseMergeColorsChange=${setUseMergeColors}
                        mergeTolerance=${mergeTolerance}
                        onMergeToleranceChange=${setMergeTolerance}
                        showSymbols=${showSymbols}
                        onShowSymbolsChange=${setShowSymbols}
                        showGridNumbers=${showGridNumbers}
                        onShowGridNumbersChange=${setShowGridNumbers}
                        showBorder=${showBorder}
                        onShowBorderChange=${setShowBorder}
                        patternShape=${patternShape}
                        onPatternShapeChange=${setPatternShape}
                    />

                    <div className="workspace">
                        <${PreviewPanel}
                            image=${image}
                            pattern=${pattern}
                            colorCounts=${colorCounts}
                            onManualBackgroundPick=${handleManualBackgroundPick}
                        />

                        <${PatternPanel}
                            pattern=${pattern}
                            isConverting=${isConverting}
                            progress=${progress}
                            onDownload=${downloadSVG}
                            onDownloadOpenFormat=${downloadOpenFormat}
                            onDownloadPNG=${downloadPNG}
                            onDownloadShoppingList=${downloadShoppingList}
                            onPrintPDF=${openPrintablePattern}
                        />
                    </div>
                <//>
            `}
        </div>
    `;
}
