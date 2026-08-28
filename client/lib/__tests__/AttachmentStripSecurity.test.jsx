import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AttachmentStrip from '../components/messaging/AttachmentStrip';
import {
  previewInternalMailAttachment,
  fetchInternalMailAttachmentContent,
  downloadInternalMailAttachment,
} from '../services/messageService';

// HOTFIX-INBOX-SECURITY-2 — caractérise puis prouve la fermeture du
// contournement de SafeHtmlEmailViewer par les pièces jointes HTML/SVG
// (finding P0 confirmé par INBOX-1 et revalidé dans
// HOTFIX_INBOX_SECURITY2_ETAT_INITIAL.md). Avant correctif, "Voir" et
// "Télécharger" appelaient tous deux `previewInternalMailAttachment`
// (window.open sur un Blob brut), quel que soit le type — y compris HTML/SVG
// contenant du contenu actif. Après correctif : les types actifs passent par
// un aperçu sanitizé + sandboxé (SafeAttachmentPreview) et un téléchargement
// forcé (`<a download>`), jamais par `previewInternalMailAttachment` — les
// autres types (image, PDF, etc.) sont strictement inchangés.

vi.mock('../services/messageService', () => ({
  previewInternalMailAttachment: vi.fn(),
  fetchInternalMailAttachmentContent: vi.fn(),
  downloadInternalMailAttachment: vi.fn(),
}));

const htmlPayload = '<p>Salut</p><script>window.__pwned = true;</script><img src=x onerror="window.__pwned = true">';
const svgPayload = '<svg xmlns="http://www.w3.org/2000/svg" onload="window.__pwned = true"><script>window.__pwned = true;</script><circle r="5"/></svg>';

const htmlAttachment = {
  filename: 'facture.html', mimetype: 'text/html', size: 2048, canPreview: true,
  previewEndpoint: '/api/internal-mails/m1/attachments/0',
  downloadEndpoint: '/api/internal-mails/m1/attachments/0?download=1',
};
const svgAttachment = {
  filename: 'logo.svg', mimetype: 'image/svg+xml', size: 1024, canPreview: true,
  previewEndpoint: '/api/internal-mails/m1/attachments/1',
  downloadEndpoint: '/api/internal-mails/m1/attachments/1?download=1',
};
const mismatchAttachment = {
  // extension .jpg mais MIME text/html déclaré — doit rester classé actif (fail-closed, mandat §34)
  filename: 'photo.jpg', mimetype: 'text/html', size: 512, canPreview: true,
  previewEndpoint: '/api/internal-mails/m1/attachments/2',
  downloadEndpoint: '/api/internal-mails/m1/attachments/2?download=1',
};
const pdfAttachment = {
  filename: 'contrat.pdf', mimetype: 'application/pdf', size: 4096, canPreview: true,
  previewEndpoint: '/api/internal-mails/m1/attachments/3',
  downloadEndpoint: '/api/internal-mails/m1/attachments/3?download=1',
};
const imageAttachment = {
  filename: 'photo.png', mimetype: 'image/png', size: 8192, canPreview: true,
  previewEndpoint: '/api/internal-mails/m1/attachments/4',
  downloadEndpoint: '/api/internal-mails/m1/attachments/4?download=1',
};

describe('AttachmentStrip — isolation des pièces jointes actives (HOTFIX-INBOX-SECURITY-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.__pwned;
  });

  test('HTML hostile : "Voir" ne passe jamais par previewInternalMailAttachment (raw Blob/window.open)', async () => {
    fetchInternalMailAttachmentContent.mockResolvedValue(htmlPayload);
    render(<AttachmentStrip attachments={[htmlAttachment]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Voir facture.html' }));
    await waitFor(() => expect(fetchInternalMailAttachmentContent).toHaveBeenCalledWith(htmlAttachment.previewEndpoint));
    expect(previewInternalMailAttachment).not.toHaveBeenCalled();
  });

  test('HTML hostile : le script et le onerror sont retirés du srcDoc sandboxé, jamais exécutés dans le document parent', async () => {
    fetchInternalMailAttachmentContent.mockResolvedValue(htmlPayload);
    render(<AttachmentStrip attachments={[htmlAttachment]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Voir facture.html' }));
    const frame = await screen.findByTestId('attachment-safe-frame');
    expect(frame.getAttribute('sandbox')).toBe('allow-popups allow-popups-to-escape-sandbox');
    expect(frame.getAttribute('sandbox')).not.toMatch(/allow-scripts/);
    expect(frame.getAttribute('sandbox')).not.toMatch(/allow-same-origin/);
    expect(frame.srcdoc).not.toContain('<script');
    expect(frame.srcdoc).not.toContain('onerror');
    expect(frame.srcdoc).toContain('Salut');
    expect(window.__pwned).toBeUndefined();
  });

  test('SVG hostile : script et onload retirés, foreignObject/svg script jamais exécutés', async () => {
    fetchInternalMailAttachmentContent.mockResolvedValue(svgPayload);
    render(<AttachmentStrip attachments={[svgAttachment]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Voir logo.svg' }));
    const frame = await screen.findByTestId('attachment-safe-frame');
    expect(frame.srcdoc).not.toContain('<script');
    expect(frame.srcdoc).not.toContain('onload');
    expect(previewInternalMailAttachment).not.toHaveBeenCalled();
    expect(window.__pwned).toBeUndefined();
  });

  test('Extension/MIME divergents (photo.jpg déclaré text/html) : classé actif, fail-closed', async () => {
    fetchInternalMailAttachmentContent.mockResolvedValue('<script>window.__pwned = true;</script><p>leurre</p>');
    render(<AttachmentStrip attachments={[mismatchAttachment]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Voir photo.jpg' }));
    await waitFor(() => expect(fetchInternalMailAttachmentContent).toHaveBeenCalled());
    expect(previewInternalMailAttachment).not.toHaveBeenCalled();
    const frame = await screen.findByTestId('attachment-safe-frame');
    expect(frame.srcdoc).not.toContain('<script');
  });

  test('HTML actif : "Télécharger" utilise downloadInternalMailAttachment (sauvegarde forcée), jamais previewInternalMailAttachment', () => {
    render(<AttachmentStrip attachments={[htmlAttachment]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger facture.html' }));
    expect(downloadInternalMailAttachment).toHaveBeenCalledWith(htmlAttachment.downloadEndpoint, htmlAttachment.filename);
    expect(previewInternalMailAttachment).not.toHaveBeenCalled();
  });

  test('image classique (PNG) : comportement historique exact préservé (previewInternalMailAttachment inchangé)', () => {
    render(<AttachmentStrip attachments={[imageAttachment]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Voir photo.png' }));
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger photo.png' }));
    expect(previewInternalMailAttachment).toHaveBeenCalledWith(imageAttachment.previewEndpoint);
    expect(previewInternalMailAttachment).toHaveBeenCalledWith(imageAttachment.downloadEndpoint);
    expect(fetchInternalMailAttachmentContent).not.toHaveBeenCalled();
    expect(downloadInternalMailAttachment).not.toHaveBeenCalled();
  });

  test('PDF : comportement historique exact préservé (previewInternalMailAttachment inchangé)', () => {
    render(<AttachmentStrip attachments={[pdfAttachment]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Voir contrat.pdf' }));
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger contrat.pdf' }));
    expect(previewInternalMailAttachment).toHaveBeenCalledWith(pdfAttachment.previewEndpoint);
    expect(previewInternalMailAttachment).toHaveBeenCalledWith(pdfAttachment.downloadEndpoint);
    expect(fetchInternalMailAttachmentContent).not.toHaveBeenCalled();
  });

  test('fermeture de l\'aperçu : Échap ferme la fenêtre, bouton fermer présent et accessible', async () => {
    fetchInternalMailAttachmentContent.mockResolvedValue('<p>ok</p>');
    render(<AttachmentStrip attachments={[htmlAttachment]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Voir facture.html' }));
    await screen.findByTestId('attachment-safe-frame');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('échec de récupération du contenu : message explicite, pas de crash, téléchargement toujours proposé', async () => {
    fetchInternalMailAttachmentContent.mockRejectedValue(new Error('network'));
    render(<AttachmentStrip attachments={[htmlAttachment]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Voir facture.html' }));
    expect(await screen.findByText(/Aperçu indisponible/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Télécharger l'aperçu de facture.html" })).toBeInTheDocument();
  });
});
