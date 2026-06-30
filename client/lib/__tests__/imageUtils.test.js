import { getValidImageUrl, getFirstValidImage, cleanImageArray } from '../utils/imageUtils';

const FALLBACK = 'https://placehold.co/600x400/60A5FA/FFFFFF?text=No+Image';

// ─────────────────────────────────────────────────────────────
describe('getValidImageUrl', () => {
  it('retourne le fallback pour une valeur null', () => {
    expect(getValidImageUrl(null)).toBe(FALLBACK);
  });

  it('retourne le fallback pour une chaîne vide', () => {
    expect(getValidImageUrl('')).toBe(FALLBACK);
  });

  it('retourne le fallback pour un non-string', () => {
    expect(getValidImageUrl(42)).toBe(FALLBACK);
    expect(getValidImageUrl({})).toBe(FALLBACK);
  });

  it('retourne le fallback si l\'URL se termine par /', () => {
    expect(getValidImageUrl('https://example.com/')).toBe(FALLBACK);
  });

  it('retourne le fallback si l\'URL est trop courte (< 10 chars)', () => {
    expect(getValidImageUrl('/img.jpg')).toBe(FALLBACK); // 8 chars
  });

  it('retourne l\'URL telle quelle si elle commence par https://', () => {
    const url = 'https://res.cloudinary.com/altitude/image/upload/photo.jpg';
    expect(getValidImageUrl(url)).toBe(url);
  });

  it('retourne l\'URL telle quelle si elle commence par http://', () => {
    const url = 'http://example.com/image.png';
    expect(getValidImageUrl(url)).toBe(url);
  });

  it('préfixe / si le chemin relatif n\'en a pas', () => {
    expect(getValidImageUrl('images/photo.jpg')).toBe('/images/photo.jpg');
  });

  it('retourne le chemin relatif intact s\'il commence par /', () => {
    expect(getValidImageUrl('/uploads/photo.jpg')).toBe('/uploads/photo.jpg');
  });

  it('utilise le fallback personnalisé fourni', () => {
    const custom = '/images/no-image.png';
    expect(getValidImageUrl(null, custom)).toBe(custom);
  });
});

// ─────────────────────────────────────────────────────────────
describe('getFirstValidImage', () => {
  it('retourne le fallback pour un tableau vide', () => {
    expect(getFirstValidImage([])).toBe(FALLBACK);
  });

  it('retourne le fallback pour une valeur non-array', () => {
    expect(getFirstValidImage(null)).toBe(FALLBACK);
    expect(getFirstValidImage('string')).toBe(FALLBACK);
  });

  it('retourne la première URL valide du tableau', () => {
    const url = 'https://example.com/photo.jpg';
    expect(getFirstValidImage([url, 'https://example.com/photo2.jpg'])).toBe(url);
  });

  it('ignore les entrées invalides et retourne la première valide', () => {
    const valid = 'https://example.com/photo.jpg';
    expect(getFirstValidImage([null, '', valid])).toBe(valid);
  });

  it('retourne le fallback si aucune image n\'est valide', () => {
    expect(getFirstValidImage([null, '', 'bad/'])).toBe(FALLBACK);
  });
});

// ─────────────────────────────────────────────────────────────
describe('cleanImageArray', () => {
  it('retourne un tableau vide pour une entrée non-array', () => {
    expect(cleanImageArray(null)).toEqual([]);
    expect(cleanImageArray('string')).toEqual([]);
  });

  it('filtre les valeurs null et undefined', () => {
    expect(cleanImageArray([null, undefined, 'https://example.com/img.jpg'])).toHaveLength(1);
  });

  it('filtre les URLs se terminant par /', () => {
    expect(cleanImageArray(['https://example.com/'])).toEqual([]);
  });

  it('filtre les URLs trop courtes', () => {
    expect(cleanImageArray(['/img.jpg', 'x'])).toEqual([]);
  });

  it('conserve les URLs valides', () => {
    const urls = ['https://example.com/a.jpg', '/uploads/b.png'];
    expect(cleanImageArray(urls)).toEqual(urls);
  });

  it('retourne un tableau vide pour un tableau entièrement invalide', () => {
    expect(cleanImageArray([null, '', 'bad/'])).toEqual([]);
  });
});
