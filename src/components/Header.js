import { html } from '../htm.js';

/**
 * Header Component
 * Application title and decorative elements
 */
export function Header() {
    return html`
        <header>
            <h1>Cross Stitch</h1>
            <p className="subtitle">Pattern Generator</p>
        </header>
    `;
}
