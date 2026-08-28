import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import InternalMessagingPage from '../pages/dashboard/InternalMessagingPage';
import {
  getReceivedMessages, countUnread, markAsRead, addStar,
} from '../services/messageService';
import { getAllUsers } from '../services/userService';

// INBOX-PRO-2 — tests UX (mandat §48) : sélection, non-lu, aucune
// sélection, loading, erreur, recherche, filtres, drawer, pièces jointes.
// Réutilise le patron déjà établi par MessagesResponsive.test.jsx /
// DashboardResponsiveNavigation.test.jsx (mêmes mocks de service).
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/dashboard/messages',
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { _id: 'ME', name: 'Moi', role: 'Admin' } }),
}));

vi.mock('../services/userService', () => ({ getAllUsers: vi.fn() }));

vi.mock('../services/messageService', () => ({
  sendInternalMail: vi.fn(), getReceivedMessages: vi.fn(), getSentMessages: vi.fn(),
  getUnreadMessages: vi.fn(), getStarredMessages: vi.fn(), getDraftMessages: vi.fn(),
  getTrashedMessages: vi.fn(), markAsRead: vi.fn(), addStar: vi.fn(), removeStar: vi.fn(),
  moveToTrash: vi.fn(), restoreFromTrash: vi.fn(), permanentlyDelete: vi.fn(),
  emptyTrash: vi.fn(), saveDraft: vi.fn(), updateDraft: vi.fn(), deleteDraft: vi.fn(),
  countUnread: vi.fn(), previewInternalMailAttachment: vi.fn(),
}));

const unreadMail = {
  _id: 'MAIL-UNREAD', subject: 'Facture à régler', content: 'Merci de régler la facture ci-jointe.',
  isRead: false, isStarred: false,
  sender: { name: 'Client Externe', email: 'client@example.test', role: 'Client' },
  receiver: { name: 'Moi' }, createdAt: '2030-01-01T09:00:00.000Z',
  html: '<p>Merci de régler la <strong>facture</strong> ci-jointe.</p>',
  attachments: [{ filename: 'facture.pdf', mimetype: 'application/pdf', size: 128000, canPreview: true, previewEndpoint: '/x', downloadEndpoint: '/y' }],
};
const readMail = {
  _id: 'MAIL-READ', subject: 'Compte-rendu réunion', content: 'Voici le compte-rendu.',
  isRead: true, isStarred: false,
  sender: { name: 'Collègue Interne', email: 'collegue@altitudevision.agency', role: 'Collaborateur' },
  receiver: { name: 'Moi' }, createdAt: '2030-01-02T09:00:00.000Z',
  attachments: [],
};

describe('InternalMessagingPage — UX (INBOX-PRO-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllUsers.mockResolvedValue([]);
    countUnread.mockResolvedValue(1);
    markAsRead.mockResolvedValue({});
    addStar.mockResolvedValue({});
  });

  test('loading : un skeleton est affiché pendant le chargement initial', async () => {
    let resolveMessages;
    getReceivedMessages.mockReturnValue(new Promise((resolve) => { resolveMessages = resolve; }));
    const { container } = render(<InternalMessagingPage />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    resolveMessages([]);
    await waitFor(() => expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument());
  });

  test('empty state : aucun message affiche un texte explicite, pas un cadre vide', async () => {
    getReceivedMessages.mockResolvedValue([]);
    render(<InternalMessagingPage />);
    expect(await screen.findByText('Aucun message.')).toBeInTheDocument();
  });

  test('error state : un échec de chargement affiche un message clair avec un bouton réessayer', async () => {
    getReceivedMessages.mockRejectedValueOnce(new Error('network down'));
    render(<InternalMessagingPage />);
    expect(await screen.findByText('Impossible de charger les messages.')).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'Réessayer' });
    getReceivedMessages.mockResolvedValueOnce([readMail]);
    fireEvent.click(retry);
    expect(await screen.findByText('Compte-rendu réunion')).toBeInTheDocument();
  });

  test('no selection : le panneau central invite explicitement à sélectionner une conversation', async () => {
    getReceivedMessages.mockResolvedValue([readMail]);
    render(<InternalMessagingPage />);
    expect(await screen.findByText('Sélectionnez une conversation pour afficher les messages.')).toBeInTheDocument();
  });

  test('unread styling : un message non lu est visuellement distingué (police plus forte) d’un message lu', async () => {
    getReceivedMessages.mockResolvedValue([unreadMail, readMail]);
    render(<InternalMessagingPage />);
    const unreadSubject = await screen.findByText('Facture à régler');
    const readSubject = await screen.findByText('Compte-rendu réunion');
    expect(unreadSubject.className).toMatch(/font-semibold|font-bold/);
    expect(readSubject.className).not.toMatch(/font-semibold|font-bold/);
  });

  test('sélection : cliquer une conversation l’ouvre, marque comme lu et affiche le contenu HTML sécurisé', async () => {
    getReceivedMessages.mockResolvedValue([unreadMail]);
    render(<InternalMessagingPage />);
    fireEvent.click(await screen.findByText('Facture à régler'));
    expect(await screen.findByRole('heading', { name: 'Facture à régler' })).toBeInTheDocument();
    await waitFor(() => expect(markAsRead).toHaveBeenCalledWith('MAIL-UNREAD'));
    // Le contenu passe par SafeHtmlEmailViewer (iframe sandboxée), jamais
    // un dangerouslySetInnerHTML direct — voir INBOX-PRO-1.
    const frame = document.querySelector('iframe[data-testid="email-html-frame"]');
    expect(frame).toBeInTheDocument();
    expect(frame.getAttribute('sandbox')).not.toMatch(/allow-scripts/);
  });

  test('pleine hauteur : liste et lecteur ont chacun un seul scroll logique, avec header hors du scroll du message', async () => {
    getReceivedMessages.mockResolvedValue([unreadMail]);
    render(<InternalMessagingPage />);
    fireEvent.click(await screen.findByText('Facture à régler'));
    await screen.findByRole('heading', { name: 'Facture à régler' });

    const listScroll = screen.getByTestId('inbox-message-list-scroll');
    const viewer = screen.getByTestId('inbox-message-viewer');
    const bodyScroll = screen.getByTestId('inbox-message-body-scroll');
    const header = screen.getByRole('heading', { name: 'Facture à régler' }).closest('.flex-shrink-0');

    expect(listScroll).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
    expect(viewer).toHaveClass('min-h-0', 'flex-1', 'flex', 'flex-col', 'overflow-hidden');
    expect(viewer).not.toHaveClass('overflow-y-auto');
    expect(bodyScroll).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto', 'overflow-x-hidden');
    expect(header).not.toBeNull();
    expect(bodyScroll).not.toContainElement(header);

    const frame = screen.getByTestId('email-html-frame');
    expect(frame).toHaveStyle({ width: '100%', display: 'block' });
    expect(frame.getAttribute('sandbox')).toBe('allow-popups allow-popups-to-escape-sandbox');
  });

  test('recherche : filtre la liste déjà chargée par objet/expéditeur/contenu', async () => {
    getReceivedMessages.mockResolvedValue([unreadMail, readMail]);
    render(<InternalMessagingPage />);
    await screen.findByText('Facture à régler');
    fireEvent.change(screen.getByPlaceholderText('Rechercher dans ce dossier...'), { target: { value: 'facture' } });
    expect(screen.getByText('Facture à régler')).toBeInTheDocument();
    expect(screen.queryByText('Compte-rendu réunion')).not.toBeInTheDocument();
  });

  test('filtres : "Non lus" et "Avec pièce jointe" réduisent la liste sans appel réseau supplémentaire', async () => {
    getReceivedMessages.mockResolvedValue([unreadMail, readMail]);
    render(<InternalMessagingPage />);
    await screen.findByText('Facture à régler');
    expect(getReceivedMessages).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Non lus' }));
    expect(screen.getByText('Facture à régler')).toBeInTheDocument();
    expect(screen.queryByText('Compte-rendu réunion')).not.toBeInTheDocument();
    expect(getReceivedMessages).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Tous' }));
    fireEvent.click(screen.getByRole('button', { name: 'Avec pièce jointe' }));
    expect(screen.getByText('Facture à régler')).toBeInTheDocument();
    expect(screen.queryByText('Compte-rendu réunion')).not.toBeInTheDocument();
  });

  test('drawer contact : s’ouvre au clic sur l’expéditeur et se ferme via son bouton', async () => {
    getReceivedMessages.mockResolvedValue([unreadMail]);
    render(<InternalMessagingPage />);
    fireEvent.click(await screen.findByText('Facture à régler'));
    await screen.findByRole('heading', { name: 'Facture à régler' });

    fireEvent.click(screen.getByRole('button', { name: /Voir les informations de Client Externe/i }));
    const drawer = await screen.findByRole('dialog', { name: "Informations sur le contact" });
    expect(within(drawer).getByText('client@example.test')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: "Fermer le panneau d'informations" }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Informations sur le contact' })).not.toBeInTheDocument());
  });

  test('pièces jointes : présentées en bande compacte avec actions voir/télécharger', async () => {
    getReceivedMessages.mockResolvedValue([unreadMail]);
    render(<InternalMessagingPage />);
    fireEvent.click(await screen.findByText('Facture à régler'));
    expect(await screen.findByText(/Pièces jointes · 1/)).toBeInTheDocument();
    expect(screen.getByText('facture.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voir facture.pdf' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Télécharger facture.pdf' })).toBeInTheDocument();
  });

  test('favoris : basculer l’étoile appelle le service et affiche une confirmation', async () => {
    getReceivedMessages.mockResolvedValue([unreadMail]);
    render(<InternalMessagingPage />);
    fireEvent.click(await screen.findByText('Facture à régler'));
    await screen.findByRole('heading', { name: 'Facture à régler' });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter aux favoris' }));
    await waitFor(() => expect(addStar).toHaveBeenCalledWith('MAIL-UNREAD'));
    expect(await screen.findByText('Ajouté aux favoris')).toBeInTheDocument();
  });
});
