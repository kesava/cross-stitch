import { html } from '../htm.js';

/**
 * UploadZone Component
 * Handles file upload via drag-and-drop or click-to-browse
 */
export function UploadZone({ onFileSelect }) {
    const [isDragging, setIsDragging] = React.useState(false);
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

    return html`
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
    `;
}
