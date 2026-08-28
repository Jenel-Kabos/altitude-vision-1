import { render, screen } from '@testing-library/react';
import SafeHtmlEmailViewer from '../components/messaging/SafeHtmlEmailViewer';

// INBOX-PRO-1 — composant critique de sécurité : ces tests couvrent
// explicitement les vecteurs listés au mandat §41 (script, event handler,
// javascript: URL) ainsi que la fidélité de rendu (tableaux, images,
// liens) et le fallback texte (§42).
describe('SafeHtmlEmailViewer', () => {
  const getSrcDoc = (container) => container.querySelector('iframe')?.srcdoc || '';

  test('1. texte simple sans HTML → fallback texte affiché, jamais interprété comme HTML', () => {
    render(<SafeHtmlEmailViewer text="Bonjour, ceci est un message simple." />);
    expect(screen.getByTestId('email-text-fallback')).toHaveTextContent('Bonjour, ceci est un message simple.');
    expect(screen.queryByTestId('email-html-frame')).not.toBeInTheDocument();
  });

  test('2. HTML simple → rendu dans une iframe sandboxée, jamais dangerouslySetInnerHTML direct dans le dashboard', () => {
    const { container } = render(<SafeHtmlEmailViewer html="<p>Bonjour <strong>Client</strong></p>" />);
    const iframe = screen.getByTestId('email-html-frame');
    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe.getAttribute('sandbox')).toBe('allow-popups allow-popups-to-escape-sandbox');
    expect(iframe.getAttribute('sandbox')).not.toMatch(/allow-scripts/);
    expect(iframe.getAttribute('sandbox')).not.toMatch(/allow-same-origin/);
    expect(iframe).toHaveStyle({ height: '100%', minHeight: '0', flex: '1 1 0%' });
    expect(iframe.style.height).not.toBe('80px');
    expect(getSrcDoc(container)).toContain('Bonjour <strong>Client</strong>');
  });

  test('4. tableau HTML conservé (facture/devis)', () => {
    const html = '<table><tr><td>Article</td><td>Prix</td></tr><tr><td>Commission</td><td>50 000 FCFA</td></tr></table>';
    const { container } = render(<SafeHtmlEmailViewer html={html} />);
    expect(getSrcDoc(container)).toContain('<table>');
    expect(getSrcDoc(container)).toContain('50 000 FCFA');
  });

  test('6. image externe conservée avec attribut src intact', () => {
    const { container } = render(<SafeHtmlEmailViewer html='<img src="https://example.test/logo.png" alt="Logo" />' />);
    expect(getSrcDoc(container)).toContain('src="https://example.test/logo.png"');
  });

  test('8. lien conservé et forcé en target="_blank" (jamais de navigation piégée dans l’iframe sandboxée)', () => {
    const { container } = render(<SafeHtmlEmailViewer html='<a href="https://altitudevision.agency">Voir le bien</a>' />);
    const srcDoc = getSrcDoc(container);
    expect(srcDoc).toContain('href="https://altitudevision.agency"');
    expect(srcDoc).toContain('target="_blank"');
    expect(srcDoc).toContain('rel="noopener noreferrer nofollow"');
  });

  test('13. <script> systématiquement retiré', () => {
    const { container } = render(<SafeHtmlEmailViewer html='<p>Contenu</p><script>alert("xss")</script>' />);
    const srcDoc = getSrcDoc(container);
    expect(srcDoc).not.toContain('<script');
    expect(srcDoc).not.toContain('alert(');
    expect(srcDoc).toContain('Contenu');
  });

  test('14. event handlers (onerror, onclick) systématiquement retirés', () => {
    const html = '<img src="x.png" onerror="alert(1)" /><button onclick="alert(2)">Cliquer</button>';
    const { container } = render(<SafeHtmlEmailViewer html={html} />);
    const srcDoc = getSrcDoc(container);
    expect(srcDoc).not.toContain('onerror');
    expect(srcDoc).not.toContain('onclick');
    expect(srcDoc).not.toContain('alert(');
  });

  test('15. javascript: URL systématiquement neutralisée', () => {
    const { container } = render(<SafeHtmlEmailViewer html='<a href="javascript:alert(1)">Cliquer ici</a>' />);
    const srcDoc = getSrcDoc(container);
    expect(srcDoc).not.toContain('javascript:alert');
  });

  test('iframe/object/embed/form imbriqués systématiquement retirés', () => {
    const html = '<iframe src="https://evil.test"></iframe><object data="evil.swf"></object><form action="https://evil.test"><input/></form><p>Reste</p>';
    const { container } = render(<SafeHtmlEmailViewer html={html} />);
    const srcDoc = getSrcDoc(container);
    expect(srcDoc).not.toContain('<iframe');
    expect(srcDoc).not.toContain('<object');
    expect(srcDoc).not.toContain('<form');
    expect(srcDoc).toContain('Reste');
  });

  test('HTML entièrement neutralisé par la sanitization retombe sur le texte (jamais un cadre vide)', () => {
    render(<SafeHtmlEmailViewer html='<script>alert(1)</script>' text="Version texte de secours" />);
    expect(screen.getByTestId('email-text-fallback')).toHaveTextContent('Version texte de secours');
    expect(screen.queryByTestId('email-html-frame')).not.toBeInTheDocument();
  });

  test('aucun contenu du tout → message explicite, jamais "undefined"/"[object Object]"', () => {
    render(<SafeHtmlEmailViewer />);
    const fallback = screen.getByTestId('email-text-fallback');
    expect(fallback).toHaveTextContent('aucun contenu affichable');
    expect(fallback.textContent).not.toContain('undefined');
    expect(fallback.textContent).not.toContain('[object Object]');
  });

  test('<style> conservé (isolé dans l’iframe, jamais un risque pour le dashboard)', () => {
    const html = '<style>.title{color:#C8960C;}</style><p class="title">Titre coloré</p>';
    const { container } = render(<SafeHtmlEmailViewer html={html} />);
    const srcDoc = getSrcDoc(container);
    expect(srcDoc).toContain('<style>.title{color:#C8960C;}</style>');
  });
});
