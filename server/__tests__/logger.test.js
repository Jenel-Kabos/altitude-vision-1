const { normalizeMetadata } = require('../utils/logger');

describe('logger metadata normalization', () => {
  test('preserves an object', () => expect(normalizeMetadata({ origin: 'https://www.altitudevision.agency' })).toEqual({ origin: 'https://www.altitudevision.agency' }));
  test('keeps a string as one detail', () => expect(normalizeMetadata('https://www.altitudevision.agency')).toEqual({ detail: 'https://www.altitudevision.agency' }));
  test('serializes an Error safely', () => expect(normalizeMetadata(new Error('socket timeout'))).toEqual(expect.objectContaining({ error: 'socket timeout' })));
  test('handles undefined metadata', () => expect(normalizeMetadata()).toEqual({}));
});
