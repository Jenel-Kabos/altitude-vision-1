import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CookieBanner from '../components/CookieBanner';

const consentChange = vi.fn();

beforeEach(() => {
  localStorage.clear();
  consentChange.mockClear();
  window.addEventListener('cookie_consent_change', consentChange);
});

afterEach(() => {
  window.removeEventListener('cookie_consent_change', consentChange);
});

describe('FINAL — consentement cookies public', () => {
  test('COOKIE-01/05/06/08 : présente une bannière compacte, nommée et entièrement actionnable', async () => {
    render(<CookieBanner />);

    const banner = await screen.findByRole('dialog', { name: 'Vos préférences de confidentialité' });
    expect(banner).toHaveAttribute('aria-describedby', 'cookie-consent-description');
    expect(screen.getByRole('link', { name: 'Consulter la politique de confidentialité' }))
      .toHaveAttribute('href', '/politique-confidentialite#cookies');
    expect(screen.getByRole('button', { name: 'Refuser les cookies analytiques' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Accepter les cookies analytiques' })).toBeEnabled();
    expect(banner).toHaveAttribute('data-cookie-layout', 'compact');
  });

  test('COOKIE-02/04 : accepter persiste le choix, émet le signal analytics et ferme la bannière', async () => {
    render(<CookieBanner />);
    fireEvent.click(await screen.findByRole('button', { name: 'Accepter les cookies analytiques' }));

    expect(localStorage.getItem('cookie_consent')).toBe('accepted');
    expect(consentChange).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('COOKIE-03/04 : refuser persiste le choix, émet le signal analytics et ferme la bannière', async () => {
    render(<CookieBanner />);
    fireEvent.click(await screen.findByRole('button', { name: 'Refuser les cookies analytiques' }));

    expect(localStorage.getItem('cookie_consent')).toBe('refused');
    expect(consentChange).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test.each(['accepted', 'refused'])('COOKIE-04/07 : le choix %s empêche la réapparition après montage', async (choice) => {
    localStorage.setItem('cookie_consent', choice);
    render(<CookieBanner />);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
