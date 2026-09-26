import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SubmitPropertyPage from '../pages/Properties/SubmitPropertyPage';
import { addProperty } from '../services/propertyService';

const push = vi.fn();
const replace = vi.fn();
let authState = { user: { _id: 'owner-1', role: 'Proprietaire' }, loading: false };

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../services/propertyService', () => ({ addProperty: vi.fn() }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const image = new File(['image'], 'villa.jpg', { type: 'image/jpeg' });
const imageTwo = new File(['image-2'], 'salon.png', { type: 'image/png' });

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function fillRequired({ withImage = true } = {}) {
  fireEvent.change(screen.getByLabelText(/Titre du bien/), { target: { value: 'Villa familiale' } });
  fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'Une maison lumineuse et bien située.' } });
  fireEvent.change(screen.getByLabelText(/Prix/), { target: { value: '850000' } });
  fireEvent.change(screen.getByLabelText(/Arrondissement/), { target: { value: 'Bacongo' } });
  fireEvent.change(screen.getByLabelText(/Surface/), { target: { value: '120' } });
  if (withImage) fireEvent.change(screen.getByLabelText(/Choisir des photos/), { target: { files: [image] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  authState = { user: { _id: 'owner-1', role: 'Proprietaire' }, loading: false };
  addProperty.mockResolvedValue({ _id: 'property-1', statusAdmin: 'En attente' });
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn((file) => `blob:${file.name}`),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('Property Submit — UX/UI et contrat fonctionnel', () => {
  test('PSUB-01/16 : rend une page structurée, un seul H1 et des labels associés', () => {
    render(<SubmitPropertyPage />);
    expect(screen.getByRole('heading', { level: 1, name: /Confiez-nous votre bien immobilier/ })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('form', { name: /Soumettre un bien immobilier/ })).toBeInTheDocument();
    for (const name of [/Titre du bien/, /Description/, /Prix/, /Type de bien/, /Ville/, /Arrondissement/, /Surface/]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
    expect(screen.getAllByText('01')).toHaveLength(2);
    expect(screen.getAllByText('06')).toHaveLength(2);
  });

  test('PSUB-02 : les champs réellement requis sont signalés et validés près du champ', async () => {
    render(<SubmitPropertyPage />);
    fireEvent.submit(screen.getByRole('form', { name: /Soumettre un bien immobilier/ }));
    expect(await screen.findByText('Veuillez renseigner le titre.')).toBeInTheDocument();
    expect(screen.getByText('Veuillez renseigner la description.')).toBeInTheDocument();
    expect(screen.getByText('Veuillez renseigner un prix supérieur à zéro.')).toBeInTheDocument();
    expect(screen.getByText("Veuillez sélectionner l'arrondissement.")).toBeInTheDocument();
    expect(screen.getByText('Veuillez renseigner une surface supérieure à zéro.')).toBeInTheDocument();
    expect(screen.getByText('Ajoutez au moins une photo du bien.')).toBeInTheDocument();
    expect(addProperty).not.toHaveBeenCalled();
  });

  test('PSUB-03/04 : type et dépendance ville-arrondissement utilisent les valeurs réelles', () => {
    render(<SubmitPropertyPage />);
    fireEvent.change(screen.getByLabelText(/Type de bien/), { target: { value: 'Villa' } });
    expect(screen.getByLabelText(/Type de bien/)).toHaveValue('Villa');
    fireEvent.change(screen.getByLabelText(/Arrondissement/), { target: { value: 'Bacongo' } });
    fireEvent.change(screen.getByLabelText(/Ville/), { target: { value: 'Pointe-Noire' } });
    expect(screen.getByLabelText(/Arrondissement/)).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Lumumba' })).toBeInTheDocument();
  });

  test('PSUB-05 : un équipement est sélectionnable via une cible lisible', () => {
    render(<SubmitPropertyPage />);
    const checkbox = screen.getByRole('checkbox', { name: 'Climatisation' });
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  test('PSUB-06/07/08 : sélection, previews et suppression des images restent locales', () => {
    render(<SubmitPropertyPage />);
    const input = screen.getByLabelText(/Choisir des photos/);
    fireEvent.change(input, { target: { files: [image, imageTwo] } });
    expect(screen.getByRole('img', { name: 'Aperçu de villa.jpg' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Aperçu de salon.png' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer villa.jpg' }));
    expect(screen.queryByRole('img', { name: 'Aperçu de villa.jpg' })).not.toBeInTheDocument();
    expect(screen.getByText('1 photo sélectionnée')).toBeInTheDocument();
  });

  test('PSUB-09 : le payload historique est préservé sans tenant, rôle, validation ou publication', async () => {
    render(<SubmitPropertyPage />);
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Soumettre mon bien' }));
    await waitFor(() => expect(addProperty).toHaveBeenCalledTimes(1));
    const payload = addProperty.mock.calls[0][0];
    expect(payload.get('title')).toBe('Villa familiale');
    expect(payload.get('pole')).toBe('Altimmo');
    expect(payload.get('status')).toBe('vente');
    expect(payload.get('availability')).toBe('Disponible');
    expect(payload.getAll('images')).toEqual([image]);
    for (const forbidden of ['tenant', 'tenantId', 'owner', 'role', 'statusAdmin', 'isPublished', 'validated']) {
      expect(payload.has(forbidden)).toBe(false);
    }
  });

  test('PSUB-10/18 : le succès et la redirection attendent la confirmation backend', async () => {
    const pending = deferred();
    addProperty.mockReturnValue(pending.promise);
    render(<SubmitPropertyPage />);
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Soumettre mon bien' }));
    expect(screen.queryByText(/Bien transmis/)).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    await act(async () => pending.resolve({ _id: 'property-1' }));
    expect(await screen.findByText(/Bien transmis à Altimmo/)).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith('/immobilier/property/property-1');
  });

  test('PSUB-11 : une erreur conserve les champs et les images pour réessayer', async () => {
    addProperty.mockRejectedValue(new Error('Network Error'));
    render(<SubmitPropertyPage />);
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Soumettre mon bien' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/envoi a échoué/i);
    expect(screen.getByLabelText(/Titre du bien/)).toHaveValue('Villa familiale');
    expect(screen.getByRole('img', { name: 'Aperçu de villa.jpg' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Soumettre mon bien' })).toBeEnabled();
  });

  test('PSUB-12 : une soumission en cours bloque uniquement le CTA et empêche le doublon', async () => {
    const pending = deferred();
    addProperty.mockReturnValue(pending.promise);
    render(<SubmitPropertyPage />);
    fillRequired();
    const form = screen.getByRole('form', { name: /Soumettre un bien immobilier/ });
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(addProperty).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Envoi de votre bien/ })).toBeDisabled();
    expect(screen.getByLabelText(/Titre du bien/)).toBeEnabled();
    await act(async () => pending.resolve({ _id: 'property-1' }));
  });

  test('PSUB-13 : un visiteur non connecté est dirigé vers la connexion', async () => {
    authState = { user: null, loading: false };
    render(<SubmitPropertyPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  test('PSUB-13B : une session expirée (401) affiche un message précis puis redirige', async () => {
    addProperty.mockRejectedValue({ response: { status: 401 } });
    render(<SubmitPropertyPage />);
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Soumettre mon bien' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/session a expiré/i);
    expect(replace).toHaveBeenCalledWith('/login');
  });

  test('PSUB-14 : une réponse 403 explique le rôle requis sans effacer le formulaire', async () => {
    addProperty.mockRejectedValue({ response: { status: 403, data: { message: 'Accès refusé.' } } });
    render(<SubmitPropertyPage />);
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Soumettre mon bien' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/réservée aux propriétaires autorisés/i);
    expect(screen.getByLabelText(/Titre du bien/)).toHaveValue('Villa familiale');
  });

  test('PSUB-15 : aucun champ de tenant ou propriétaire ne peut être saisi', () => {
    render(<SubmitPropertyPage />);
    expect(screen.queryByLabelText(/tenant/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/propriétaire/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Pôle/)).not.toBeInTheDocument();
  });

  test('PSUB-17 : refuse les fichiers non image et plus de dix images avant l’API', async () => {
    render(<SubmitPropertyPage />);
    const input = screen.getByLabelText(/Choisir des photos/);
    fireEvent.change(input, { target: { files: [new File(['pdf'], 'doc.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByText('Choisissez uniquement des images JPG, PNG ou WebP.')).toBeInTheDocument();
    const eleven = Array.from({ length: 11 }, (_, index) => new File(['x'], `${index}.jpg`, { type: 'image/jpeg' }));
    fireEvent.change(input, { target: { files: eleven } });
    expect(screen.getByText('Vous pouvez ajouter 10 photos maximum.')).toBeInTheDocument();
    expect(screen.queryAllByRole('img', { name: /Aperçu/ })).toHaveLength(0);
  });
});
