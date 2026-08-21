const EXPECTED_CLIENT_ID = '872164120879-test.apps.googleusercontent.com';

process.env.GOOGLE_CLIENT_ID = EXPECTED_CLIENT_ID;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-with-sufficient-length';

jest.mock('google-auth-library', () => ({
    OAuth2Client: jest.fn(() => ({ verifyIdToken: jest.fn() })),
}));
jest.mock('../models/User');
jest.mock('../models/PendingRegistration');
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const PendingRegistration = require('../models/PendingRegistration');
const authController = require('../controllers/authController');

const verifyIdToken = OAuth2Client.mock.results[0].value.verifyIdToken;

const response = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
};

const verifiedPayload = {
    sub: 'google-subject-present',
    email: 'oauth-test@example.test',
    name: 'OAuth Test',
    email_verified: true,
    iss: 'https://accounts.google.com',
    aud: EXPECTED_CLIENT_ID,
};

describe('POST /api/auth/google verification contract', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        PendingRegistration.findOne.mockResolvedValue(null);
        User.findOne.mockResolvedValue({
            _id: 'user-id',
            tokenVersion: 0,
            name: 'OAuth Test',
            email: verifiedPayload.email,
            role: 'Client',
            isActive: true,
            status: 'Actif',
            isEmailVerified: true,
            googleId: verifiedPayload.sub,
            save: jest.fn().mockResolvedValue(undefined),
        });
    });

    test('accepts a Google ticket verified for the configured Web client audience', async () => {
        verifyIdToken.mockResolvedValue({ getPayload: () => verifiedPayload });
        const res = response();

        await authController.googleToken({ body: { idToken: 'opaque-valid-token' } }, res);

        expect(verifyIdToken).toHaveBeenCalledWith({
            idToken: 'opaque-valid-token',
            audience: [EXPECTED_CLIENT_ID],
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
    });

    test.each([
        ['wrong audience', 'Wrong recipient, payload audience != requiredAudience'],
        ['wrong issuer', 'Invalid issuer'],
        ['expired token', 'Token used too late'],
        ['malformed token', 'Wrong number of segments in token'],
    ])('returns the exact controller 401 for a %s rejected by google-auth-library', async (_case, message) => {
        verifyIdToken.mockRejectedValue(new Error(message));
        const res = response();

        await authController.googleToken({ body: { idToken: 'opaque-rejected-token' } }, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ status: 'fail', message: 'Token Google invalide.' });
        expect(User.findOne).not.toHaveBeenCalled();
    });

    test('rejects a cryptographically verified token whose email is not verified', async () => {
        verifyIdToken.mockResolvedValue({
            getPayload: () => ({ ...verifiedPayload, email_verified: false }),
        });
        const res = response();

        await authController.googleToken({ body: { idToken: 'opaque-unverified-email-token' } }, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ status: 'fail', message: 'Email Google non vérifié.' });
        expect(User.findOne).not.toHaveBeenCalled();
    });

    test('rejects a missing token before invoking google-auth-library', async () => {
        const res = response();

        await authController.googleToken({ body: {} }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ status: 'fail', message: 'idToken requis.' });
        expect(verifyIdToken).not.toHaveBeenCalled();
    });
});
