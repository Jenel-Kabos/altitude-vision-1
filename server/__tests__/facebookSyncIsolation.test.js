describe('Facebook sync provider injection', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.FACEBOOK_ACCESS_TOKEN = 'fake-facebook-token';
  });

  afterEach(() => { process.env.FACEBOOK_ACCESS_TOKEN = ''; });

  test('synchronise une réponse fake sans appeler Graph API', async () => {
    const axios = require('axios');
    const getSpy = jest.spyOn(axios, 'get');
    const { syncFacebook } = require('../scripts/sync-facebook');
    const fetchPosts = jest.fn().mockResolvedValue([{
      id: 'fake-post-1', message: 'Fixture', full_picture: 'https://example.test/image.jpg',
      permalink_url: 'https://example.test/post', created_time: '2026-08-13T00:00:00.000Z',
    }]);
    const PostModel = { findOneAndUpdate: jest.fn().mockResolvedValue({}) };

    await expect(syncFacebook({ fetchPosts, PostModel })).resolves.toEqual([
      { page: 'Altitude Vision', success: true, count: 1 },
    ]);
    expect(fetchPosts).toHaveBeenCalledWith('267164619819268');
    expect(PostModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(getSpy).not.toHaveBeenCalled();
    getSpy.mockRestore();
  });
});
