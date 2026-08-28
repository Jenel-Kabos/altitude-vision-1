import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PublicitesPage from '../pages/dashboard/PublicitesPage';
import { getAllPublicites, createPublicite, uploadToCloudinary } from '../services/publiciteService';

// HOTFIX-WEB-PUBLICITES-CLOUDINARY-1 — mandat §30/§31/§32/§33 : prouve que
// `createPublicite` (backend) n'est jamais appelé si l'upload échoue
// (aucune publicité avec media URL vide/undefined), et qu'il l'est bien
// avec l'URL réelle quand l'upload réussit. `uploadToCloudinary` lui-même
// est mocké ici (déjà testé unitairement dans publiciteService.test.js) —
// ce fichier teste uniquement le contrat entre le formulaire et l'appel
// backend.

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { _id: 'u1', name: 'Admin', role: 'Admin' } }),
}));
vi.mock('../services/publiciteService', () => ({
  getAllPublicites: vi.fn(),
  createPublicite: vi.fn(),
  updatePublicite: vi.fn(),
  deletePublicite: vi.fn(),
  uploadToCloudinary: vi.fn(),
}));

const fillAndSubmit = async (container) => {
  fireEvent.click(screen.getByRole('button', { name: /ajouter/i }));
  const titre = await screen.findByPlaceholderText(/promotion noël/i);
  fireEvent.change(titre, { target: { value: 'Promo test' } });
  const fileInput = container.querySelector('input[type="file"]');
  const file = new File(['x'], 'ad.jpg', { type: 'image/jpeg' });
  fireEvent.change(fileInput, { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: /créer la publicité/i }));
};

describe('PublicitesPage — soumission après upload (HOTFIX-WEB-PUBLICITES-CLOUDINARY-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllPublicites.mockResolvedValue([]);
  });

  test("échec de l'upload : createPublicite n'est jamais appelé, aucune publicité partielle", async () => {
    uploadToCloudinary.mockRejectedValue(new Error("Configuration d'upload indisponible. Contactez un administrateur."));
    const { container } = render(<PublicitesPage />);
    await screen.findByRole('button', { name: /ajouter/i });

    await fillAndSubmit(container);

    await waitFor(() => expect(uploadToCloudinary).toHaveBeenCalled());
    expect(createPublicite).not.toHaveBeenCalled();
    expect(await screen.findByText(/configuration d'upload indisponible/i)).toBeTruthy();
  });

  test("succès de l'upload : createPublicite est appelé avec l'URL réelle retournée par Cloudinary", async () => {
    uploadToCloudinary.mockResolvedValue('https://res.cloudinary.com/dop8vzm5z/image/upload/v1/ad.jpg');
    createPublicite.mockResolvedValue({ _id: 'pub1', titre: 'Promo test', media: 'https://res.cloudinary.com/dop8vzm5z/image/upload/v1/ad.jpg' });
    const { container } = render(<PublicitesPage />);
    await screen.findByRole('button', { name: /ajouter/i });

    await fillAndSubmit(container);

    await waitFor(() => expect(createPublicite).toHaveBeenCalledTimes(1));
    expect(createPublicite.mock.calls[0][0]).toMatchObject({
      media: 'https://res.cloudinary.com/dop8vzm5z/image/upload/v1/ad.jpg',
      titre: 'Promo test',
    });
  });
});
