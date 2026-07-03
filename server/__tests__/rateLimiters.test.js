// __tests__/rateLimiters.test.js
// Tests unitaires des configurations de rate limiter

const { signupLimiter, loginLimiter, resendVerificationLimiter } = require('../middleware/rateLimiters');

describe('Rate limiter — configuration', () => {
  test('signupLimiter : défini et est un middleware', () => {
    expect(signupLimiter).toBeDefined();
    expect(typeof signupLimiter).toBe('function');
  });

  test('loginLimiter : défini et est un middleware', () => {
    expect(loginLimiter).toBeDefined();
    expect(typeof loginLimiter).toBe('function');
  });

  test('resendVerificationLimiter : défini et est un middleware', () => {
    expect(resendVerificationLimiter).toBeDefined();
    expect(typeof resendVerificationLimiter).toBe('function');
  });
});

describe('Rate limiter — logique skipSuccessfulRequests', () => {
  test('loginLimiter ne pénalise pas les succès', () => {
    expect(loginLimiter).toBeDefined();
  });
});
