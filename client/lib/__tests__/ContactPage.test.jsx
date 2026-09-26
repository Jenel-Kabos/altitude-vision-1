import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ContactPage from '../pages/ContactPage';
import api from '../services/api';

// Keep sendContactMessage real: only the HTTP boundary is replaced, never production access.
vi.mock('../services/api', () => ({ default: { post: vi.fn() } }));

const message = {
  name: 'Visiteur test', email: 'visiteur@example.test',
  subject: 'Demande de renseignements', message: 'Je souhaite en savoir plus sur vos services.',
};
const success = { data: { status: 'success', data: { contactMessage: { id: 'contact-test' } } } };
const fields = () => ({
  name: screen.getByPlaceholderText('Jean Dupont'),
  email: screen.getByPlaceholderText('jean@email.com'),
  subject: screen.getByPlaceholderText('Ex : Demande de devis pour un événement'),
  message: screen.getByPlaceholderText('Décrivez votre projet ou votre demande en détail…'),
});
function fill() {
  Object.entries(fields()).forEach(([key, input]) => fireEvent.change(input, { target: { value: message[key] } }));
}
function submit() { fireEvent.click(screen.getByRole('button', { name: 'Envoyer le message' })); }
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => { vi.clearAllMocks(); api.post.mockResolvedValue(success); });

describe('WEB-01 — Contact réel et accessible', () => {
  test('CONTACT-01 : le formulaire transmet le message via le service HTTP existant', async () => {
    render(<ContactPage />); fill(); submit();
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/contact', message));
    expect(await screen.findByText(/Message envoyé !/)).toBeInTheDocument();
  });

  test('CONTACT-02 : aucun succès ni effacement avant confirmation du serveur', async () => {
    const pending = deferred(); api.post.mockReturnValue(pending.promise);
    render(<ContactPage />); fill(); submit();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Message envoyé !/)).not.toBeInTheDocument();
    Object.entries(fields()).forEach(([key, input]) => expect(input).toHaveValue(message[key]));
    await act(async () => { pending.resolve(success); });
    expect(await screen.findByText(/Message envoyé !/)).toBeInTheDocument();
    Object.values(fields()).forEach(input => expect(input).toHaveValue(''));
  });

  test.each([
    ['backend', { response: { data: { message: 'Service temporairement indisponible.' } } }, 'Service temporairement indisponible.'],
    ['réseau', new Error('Network Error'), 'Une erreur est survenue. Veuillez réessayer.'],
  ])('CONTACT-03/04 : échec %s sans succès, saisie conservée et erreur accessible', async (_kind, error, expected) => {
    api.post.mockRejectedValue(error);
    render(<ContactPage />); fill(); submit();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(expected);
    expect(alert).toHaveFocus();
    expect(screen.queryByText(/Message envoyé !/)).not.toBeInTheDocument();
    Object.entries(fields()).forEach(([key, input]) => {
      expect(input).toHaveValue(message[key]);
      expect(input).toHaveAccessibleDescription(expected);
    });
    expect(screen.getByRole('button', { name: 'Envoyer le message' })).toBeEnabled();
  });

  test('CONTACT-05 : clics et soumissions répétées ne dupliquent pas une requête en attente', async () => {
    const pending = deferred(); api.post.mockReturnValue(pending.promise);
    render(<ContactPage />); fill();
    const form = screen.getByRole('form', { name: 'Envoyez-nous un message' });
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(screen.getByRole('button', { name: /Envoi en cours/ })).toBeDisabled();
    expect(form).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Envoi en cours/ }));
    expect(api.post).toHaveBeenCalledTimes(1);
    Object.values(fields()).forEach(input => expect(input).toBeDisabled());
    await act(async () => { pending.resolve(success); });
    expect(form).toHaveAttribute('aria-busy', 'false');
  });

  test('CONTACT-06 : les quatre labels nomment leur champ et la validation native reste active', () => {
    render(<ContactPage />);
    for (const label of ['Votre nom', 'Votre email', 'Sujet', 'Votre message']) {
      expect(screen.getByLabelText(new RegExp(label))).toBeRequired();
    }
    expect(screen.getByLabelText(/Votre email/)).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText(/Votre message/)).toHaveAttribute('maxLength', '2000');
  });

  test('une réponse sans confirmation canonique ne produit jamais de faux succès', async () => {
    api.post.mockResolvedValue({ data: { status: 'error', message: 'Message non enregistré.' } });
    render(<ContactPage />); fill(); submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Message non enregistré.');
    expect(screen.queryByText(/Message envoyé !/)).not.toBeInTheDocument();
    expect(fields().message).toHaveValue(message.message);
  });

  test('une erreur peut être corrigée puis soumise avec succès', async () => {
    api.post.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce(success);
    render(<ContactPage />); fill(); submit();
    await screen.findByRole('alert');
    submit();
    expect(await screen.findByText(/Message envoyé !/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(2);
  });
});
