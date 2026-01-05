import { html } from '../htm.js';
import { generateTextImage } from '../utils/patternGenerator.js';

/**
 * UploadZone Component
 * Handles file upload via drag-and-drop or click-to-browse, or text input
 */
export function UploadZone({ onFileSelect }) {
    const [isDragging, setIsDragging] = React.useState(false);
    const [mode, setMode] = React.useState('upload'); // 'upload' or 'text'
    const [text, setText] = React.useState('');
    const [fontSize, setFontSize] = React.useState(48);
    const fileInputRef = React.useRef(null);

    const handleFile = React.useCallback((file) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                onFileSelect(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    }, [onFileSelect]);

    const handleDrop = React.useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        handleFile(file);
    }, [handleFile]);

    const handleDragOver = React.useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = React.useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleTextGenerate = () => {
        if (!text.trim()) return;

        const imageDataUrl = generateTextImage(text, {
            fontSize: fontSize,
            fontColor: '#000000',
            backgroundColor: '#FFFFFF',
            bold: true
        });

        onFileSelect(imageDataUrl);
    };

    return html`
        <div style=${{display: 'flex', flexDirection: 'column', gap: '15px'}}>
            <div style=${{display: 'flex', gap: '10px', justifyContent: 'center'}}>
                <button
                    onClick=${() => setMode('upload')}
                    style=${{
                        padding: '10px 20px',
                        background: mode === 'upload' ? 'var(--thread-red)' : 'var(--charcoal)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.9rem'
                    }}
                >
                    📁 Upload Image
                </button>
                <button
                    onClick=${() => setMode('text')}
                    style=${{
                        padding: '10px 20px',
                        background: mode === 'text' ? 'var(--thread-red)' : 'var(--charcoal)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.9rem'
                    }}
                >
                    ✏️ Generate from Text
                </button>
            </div>

            ${mode === 'upload' ? html`
                <div
                    className=${`upload-zone ${isDragging ? 'dragging' : ''}`}
                    onClick=${() => fileInputRef.current?.click()}
                    onDrop=${handleDrop}
                    onDragOver=${handleDragOver}
                    onDragLeave=${handleDragLeave}
                >
                    <svg className="upload-icon" viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="10" y="15" width="60" height="50" rx="3" />
                        <circle cx="28" cy="35" r="6" />
                        <path d="M10 55 L30 40 L45 50 L55 35 L70 50" />
                        <path d="M40 5 L40 20 M32 12 L40 5 L48 12" />
                    </svg>
                    <p className="upload-text">Drop your image here</p>
                    <p className="upload-hint">or click to browse • PNG, JPG, WEBP</p>
                    <input
                        ref=${fileInputRef}
                        type="file"
                        accept="image/*"
                        style=${{ display: 'none' }}
                        onChange=${(e) => handleFile(e.target.files[0])}
                    />
                </div>
            ` : html`
                <div className="upload-zone" style=${{padding: '40px 20px'}}>
                    <p style=${{fontSize: '1.2rem', marginBottom: '20px', fontWeight: 'bold'}}>Generate Pattern from Text</p>
                    <input
                        type="text"
                        placeholder="Enter your text here..."
                        value=${text}
                        onInput=${(e) => setText(e.target.value)}
                        style=${{
                            width: '100%',
                            padding: '15px',
                            fontSize: '1.1rem',
                            borderRadius: '4px',
                            border: '2px solid var(--linen)',
                            marginBottom: '15px',
                            fontFamily: 'Arial, sans-serif'
                        }}
                    />
                    <div style=${{marginBottom: '20px'}}>
                        <label style=${{display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--warm-gray)'}}>
                            Font Size: ${fontSize}px
                        </label>
                        <input
                            type="range"
                            min="24"
                            max="120"
                            value=${fontSize}
                            onInput=${(e) => setFontSize(Number(e.target.value))}
                            style=${{width: '100%'}}
                        />
                    </div>
                    <button
                        onClick=${handleTextGenerate}
                        disabled=${!text.trim()}
                        style=${{
                            padding: '15px 30px',
                            background: text.trim() ? 'var(--thread-red)' : 'var(--warm-gray)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: text.trim() ? 'pointer' : 'not-allowed',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            width: '100%'
                        }}
                    >
                        Generate Pattern
                    </button>
                </div>
            `}
        </div>
    `;
}
