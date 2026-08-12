// STORAGE-LEGACY-1 — preuve OLD URL, axios mocké (aucune requête réseau réelle).
jest.mock('axios');
const axios = require('axios');
const { probeUrl, verifyOldUrlInaccessible, proveMigrationUrlContract } = require('../services/storage/verifyOldUrlProof');

describe('verifyOldUrlProof', () => {
  afterEach(() => jest.resetAllMocks());

  test('200 → accessible', async () => {
    axios.get.mockResolvedValue({ status: 200 });
    const result = await probeUrl('https://res.cloudinary.com/x/raw/upload/v1/a.pdf');
    expect(result.outcome).toBe('accessible');
  });

  test('404 après rename → inaccessible', async () => {
    axios.get.mockResolvedValue({ status: 404 });
    const result = await probeUrl('https://res.cloudinary.com/x/raw/upload/v1/a.pdf');
    expect(result.outcome).toBe('inaccessible');
  });

  test('401 authenticated sans signature → inaccessible', async () => {
    axios.get.mockResolvedValue({ status: 401 });
    expect(await verifyOldUrlInaccessible('https://res.cloudinary.com/x/raw/authenticated/v1/a.pdf')).toBe(true);
  });

  test('erreur réseau → unknown, jamais compté comme une preuve positive', async () => {
    axios.get.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }));
    expect(await verifyOldUrlInaccessible('https://res.cloudinary.com/x/raw/upload/v1/a.pdf')).toBe(false);
  });

  test('aucune URL à prouver → true trivialement (rien à révoquer)', async () => {
    expect(await verifyOldUrlInaccessible(null)).toBe(true);
  });

  test('proveMigrationUrlContract exige OLD inaccessible ET NEW unsigned inaccessible', async () => {
    axios.get.mockImplementation((url) => Promise.resolve({ status: url.includes('new') ? 401 : 404 }));
    const result = await proveMigrationUrlContract({ oldUrl: 'https://res.cloudinary.com/old', newUnsignedUrl: 'https://res.cloudinary.com/new' });
    expect(result.proven).toBe(true);
  });

  test('proveMigrationUrlContract échoue si OLD reste accessible', async () => {
    axios.get.mockImplementation((url) => Promise.resolve({ status: url.includes('old') ? 200 : 401 }));
    const result = await proveMigrationUrlContract({ oldUrl: 'https://res.cloudinary.com/old', newUnsignedUrl: 'https://res.cloudinary.com/new' });
    expect(result.proven).toBe(false);
  });
});
