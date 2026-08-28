import { uploadToCloudinary } from '../services/publiciteService';

// HOTFIX-WEB-PUBLICITES-CLOUDINARY-1 — caractérise puis prouve la fermeture
// du bug réel : `cloud_name = undefined` produisait un appel réseau vers
// `https://api.cloudinary.com/v1_1/undefined/image/upload` (401 confirmé en
// production) au lieu d'échouer clairement côté client. La cause racine
// prouvée est une variable d'environnement Netlify manquante
// (`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`/`NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`,
// voir HOTFIX_WEB_PUBLICITES_CLOUDINARY1_ROOT_CAUSE.md) — le code source
// utilisait déjà le nom canonique correct, documenté par `.env.example`.
// Ce test ne corrige donc pas une variable, il verrouille un garde-fou
// fail-fast qui empêche l'appel `/undefined/` de se reproduire, quelle
// que soit la cause d'une configuration manquante.

describe('uploadToCloudinary — configuration Cloudinary (fail-fast)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  test('cloud_name manquant : aucune requête réseau vers /undefined/, erreur claire', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', '');
    vi.stubEnv('NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET', 'lqwel6X6');
    global.fetch = vi.fn();

    await expect(uploadToCloudinary(new Blob(['x']))).rejects.toThrow(/configuration/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('upload_preset manquant : aucune requête réseau, erreur claire', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', 'dop8vzm5z');
    vi.stubEnv('NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET', '');
    global.fetch = vi.fn();

    await expect(uploadToCloudinary(new Blob(['x']))).rejects.toThrow(/configuration/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('configuration valide + succès Cloudinary : URL correcte, jamais "undefined", secure_url retourné', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', 'dop8vzm5z');
    vi.stubEnv('NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET', 'lqwel6X6');
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ secure_url: 'https://res.cloudinary.com/dop8vzm5z/image/upload/v1/x.jpg' }),
    });

    const url = await uploadToCloudinary(new Blob(['x']));

    expect(url).toBe('https://res.cloudinary.com/dop8vzm5z/image/upload/v1/x.jpg');
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toBe('https://api.cloudinary.com/v1_1/dop8vzm5z/image/upload');
    expect(calledUrl).not.toContain('undefined');
  });

  test('configuration valide + échec Cloudinary (pas de secure_url) : erreur explicite', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', 'dop8vzm5z');
    vi.stubEnv('NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET', 'lqwel6X6');
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ error: { message: 'Invalid upload preset' } }),
    });

    await expect(uploadToCloudinary(new Blob(['x']))).rejects.toThrow(/Échec upload Cloudinary/);
  });
});
