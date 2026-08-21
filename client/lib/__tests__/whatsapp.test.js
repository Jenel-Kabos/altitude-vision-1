import { normalizePhoneForWhatsApp, buildWhatsAppLink } from '../utils/whatsapp';

describe('normalizePhoneForWhatsApp', () => {
  test('numéro déjà international avec + (format placeholder du projet)', () => {
    expect(normalizePhoneForWhatsApp('+242 06 123 4567')).toBe('242061234567');
  });

  test('numéro déjà international sans espaces', () => {
    expect(normalizePhoneForWhatsApp('+242061234567')).toBe('242061234567');
  });

  test('numéro international sans + (déjà préfixé 242)', () => {
    expect(normalizePhoneForWhatsApp('242061234567')).toBe('242061234567');
  });

  test('numéro local congolais avec espaces (format fixture réel)', () => {
    expect(normalizePhoneForWhatsApp('06 111 22 33')).toBe('242061112233');
  });

  test('numéro local congolais avec tirets', () => {
    expect(normalizePhoneForWhatsApp('06-123-45-67')).toBe('242061234567');
  });

  test('+242 non dupliqué même si déjà présent', () => {
    const result = normalizePhoneForWhatsApp('+242068002151');
    expect(result).toBe('242068002151');
    expect(result.startsWith('242242')).toBe(false);
  });

  test('numéro international plausible d\'un autre pays préservé tel quel (jamais préfixé 242)', () => {
    expect(normalizePhoneForWhatsApp('+33612345678')).toBe('33612345678');
  });

  test('numéro absent → null', () => {
    expect(normalizePhoneForWhatsApp(null)).toBeNull();
    expect(normalizePhoneForWhatsApp(undefined)).toBeNull();
    expect(normalizePhoneForWhatsApp('')).toBeNull();
  });

  test('numéro invalide (trop court, non exploitable) → null', () => {
    expect(normalizePhoneForWhatsApp('123')).toBeNull();
    expect(normalizePhoneForWhatsApp('abc')).toBeNull();
  });
});

describe('buildWhatsAppLink', () => {
  test('construit une URL wa.me correcte avec message encodé', () => {
    const link = buildWhatsAppLink('+242 06 123 4567', 'Bonjour, je vous contacte depuis Altitude Vision.');
    expect(link).toBe('https://wa.me/242061234567?text=Bonjour%2C%20je%20vous%20contacte%20depuis%20Altitude%20Vision.');
  });

  test("encode correctement accents, guillemets, &, ? (jamais de caractère brut cassant l'URL)", () => {
    const message = `Bonjour, concernant l'annonce « Villa & Jardin ? » — merci`;
    const link = buildWhatsAppLink('+242061234567', message);
    expect(link).toContain(encodeURIComponent(message));
    // & et ? bruts casseraient la query string wa.me (nouveaux paramètres) — doivent être encodés.
    const textParam = link.split('?text=')[1];
    expect(textParam).not.toContain('«');
    expect(textParam).not.toContain('&Jardin');
    expect(textParam).not.toContain(' ');
  });

  test('sans message : URL sans paramètre text', () => {
    expect(buildWhatsAppLink('+242061234567')).toBe('https://wa.me/242061234567');
  });

  test('numéro invalide → null (jamais wa.me/undefined)', () => {
    expect(buildWhatsAppLink('', 'Bonjour')).toBeNull();
    expect(buildWhatsAppLink(null, 'Bonjour')).toBeNull();
  });
});
