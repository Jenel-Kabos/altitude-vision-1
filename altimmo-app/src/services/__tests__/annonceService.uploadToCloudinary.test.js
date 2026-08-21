jest.mock('axios', () => {
  const mockAxios = {
    post: jest.fn(),
    create: jest.fn(() => ({
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    })),
  };
  return { __esModule: true, default: mockAxios, ...mockAxios };
});

import axios from 'axios';
import { uploadToCloudinary } from '../annonceService';

// Régression HOTFIX-MOB-ADD-PROPERTY-1 : l'upload d'image utilisait fetch()
// global, qui depuis Expo SDK 57 est remplacé par expo/fetch et rejette la
// forme classique RN {uri, name, type} avec "Unsupported FormDataPart
// implementation". Le correctif bascule sur axios (déjà utilisé partout
// ailleurs dans l'app pour l'upload de fichiers, ex. ProfilScreen.jsx).
describe('uploadToCloudinary', () => {
  afterEach(() => jest.clearAllMocks());

  test('régression : utilise axios.post (jamais fetch global) pour envoyer le FormData', async () => {
    axios.post.mockResolvedValueOnce({ data: { secure_url: 'https://res.cloudinary.com/x/image/upload/v1/photo.jpg' } });

    const url = await uploadToCloudinary('file:///data/user/0/app/cache/photo123.jpg');

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [endpoint, body, config] = axios.post.mock.calls[0];
    expect(endpoint).toBe('https://api.cloudinary.com/v1_1/dop8vzm5z/auto/upload');
    expect(body).toBeInstanceOf(FormData);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
    expect(url).toBe('https://res.cloudinary.com/x/image/upload/v1/photo.jpg');
  });

  test('construit la partie "file" avec uri/name/type définis (jamais undefined)', async () => {
    const appendSpy = jest.spyOn(FormData.prototype, 'append');
    axios.post.mockResolvedValueOnce({ data: { secure_url: 'https://res.cloudinary.com/x/image/upload/v1/photo.jpg' } });

    const uri = 'file:///data/user/0/app/cache/photo123.jpg';
    await uploadToCloudinary(uri);

    const [, filePart] = appendSpy.mock.calls.find(([field]) => field === 'file');
    expect(filePart.uri).toBe(uri);
    expect(filePart.name).toEqual(expect.stringMatching(/\.jpg$/));
    expect(filePart.type).toBe('image/jpeg');
    appendSpy.mockRestore();
  });

  test('détecte une vidéo par extension et fixe le MIME correspondant', async () => {
    const appendSpy = jest.spyOn(FormData.prototype, 'append');
    axios.post.mockResolvedValueOnce({ data: { secure_url: 'https://res.cloudinary.com/x/video/upload/v1/clip.mov' } });

    await uploadToCloudinary('file:///data/user/0/app/cache/clip.mov');

    const [, filePart] = appendSpy.mock.calls.find(([field]) => field === 'file');
    expect(filePart.type).toBe('video/quicktime');
    expect(filePart.name).toEqual(expect.stringMatching(/\.mov$/));
    appendSpy.mockRestore();
  });

  test('envoie upload_preset en tant que chaîne (jamais undefined/objet)', async () => {
    const appendSpy = jest.spyOn(FormData.prototype, 'append');
    axios.post.mockResolvedValueOnce({ data: { secure_url: 'https://res.cloudinary.com/x/image/upload/v1/photo.jpg' } });

    await uploadToCloudinary('file:///cache/photo.jpg');

    const [, presetValue] = appendSpy.mock.calls.find(([field]) => field === 'upload_preset');
    expect(presetValue).toBe('lqwel6X6');
    appendSpy.mockRestore();
  });

  test('échec réseau/serveur : rejette avec un message clair, jamais un throw brut', async () => {
    axios.post.mockRejectedValueOnce(new Error('Network Error'));

    await expect(uploadToCloudinary('file:///cache/photo.jpg')).rejects.toThrow('Cloudinary upload failed');
  });
});
