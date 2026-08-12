jest.mock('../config/cloudinary', () => ({
  uploadToCloudinary: jest.fn(),
  cloudinary: {
    utils: { private_download_url: jest.fn((publicId, format, options) => `https://api.cloudinary.test/download?public_id=${publicId}&format=${format}&expires_at=${options.expires_at}`) },
    uploader: { destroy: jest.fn() },
  },
}));
jest.mock('axios', () => ({ get: jest.fn() }));

const axios = require('axios');
const { uploadToCloudinary, cloudinary } = require('../config/cloudinary');
const storage = require('../services/storage/secureStorageService');

describe('STORAGE-SECURITY-1 — frontière Public / Private', () => {
  beforeEach(() => jest.clearAllMocks());

  test('upload public conserve explicitement le delivery public', async () => {
    uploadToCloudinary.mockResolvedValue({ secure_url: 'https://res.cloudinary.test/image/upload/public.jpg' });
    const result = await storage.uploadPublicAsset(Buffer.from('image'), { folder: 'public' });
    expect(uploadToCloudinary).toHaveBeenCalledWith(expect.any(Buffer), expect.objectContaining({ folder: 'public', type: 'upload' }));
    expect(result.secure_url).toContain('/upload/');
  });

  test('upload privé impose authenticated et ne retourne aucune URL permanente', async () => {
    uploadToCloudinary.mockResolvedValue({ public_id: 'private/doc', resource_type: 'raw', version: 7, format: 'pdf', bytes: 3, secure_url: 'SHOULD_NOT_ESCAPE' });
    const asset = await storage.uploadPrivateAsset(Buffer.from('pdf'), {
      purpose: 'lease', ownerType: 'Contrat', ownerId: 'abc', filename: 'bail.pdf', mimeType: 'application/pdf',
    });
    expect(uploadToCloudinary).toHaveBeenCalledWith(expect.any(Buffer), expect.objectContaining({ type: 'authenticated', resource_type: 'raw' }));
    expect(asset).toMatchObject({ assetClass: 'PRIVATE_DOCUMENT', publicId: 'private/doc', deliveryType: 'authenticated' });
    expect(asset).not.toHaveProperty('url');
    expect(asset).not.toHaveProperty('secure_url');
  });

  test('accès signé expire au plus tard après 60 secondes par défaut', () => {
    const before = Math.floor(Date.now() / 1000);
    const result = storage.generatePrivateAccess({ assetClass: 'PRIVATE_DOCUMENT', purpose: 'identity', provider: 'cloudinary', publicId: 'private/id', resourceType: 'image', deliveryType: 'authenticated', format: 'jpg' });
    expect(result.expiresAt).toBeGreaterThan(before);
    expect(result.expiresAt).toBeLessThanOrEqual(before + 60);
    expect(cloudinary.utils.private_download_url).toHaveBeenCalledWith('private/id', 'jpg', expect.objectContaining({ type: 'authenticated', expires_at: result.expiresAt }));
  });

  test('lecture privée garde l’URL temporaire à l’intérieur du backend', async () => {
    axios.get.mockResolvedValue({ data: Buffer.from('secret') });
    const buffer = await storage.readPrivateAsset({ assetClass: 'PRIVATE_DOCUMENT', purpose: 'conversation', provider: 'cloudinary', publicId: 'private/a', resourceType: 'raw', deliveryType: 'authenticated', format: 'pdf', mimeType: 'application/pdf' });
    expect(buffer.toString()).toBe('secret');
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('expires_at='), expect.objectContaining({ responseType: 'arraybuffer' }));
  });

  test('une référence publique ou incomplète est refusée avant toute signature', () => {
    expect(() => storage.generatePrivateAccess({ publicId: 'public/leak', deliveryType: 'upload' })).toThrow('PRIVATE_ASSET_REFERENCE_INVALID');
    expect(cloudinary.utils.private_download_url).not.toHaveBeenCalled();
  });
});
