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

    test('keeps the missing-intent legacy Web contract and verifies the configured audience', async () => {
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

    test('login + existing account creates a session without creating a user', async () => {
        verifyIdToken.mockResolvedValue({ getPayload: () => verifiedPayload });
        const res = response();

        await authController.googleToken({
            body: { idToken: 'opaque-valid-token', intent: 'login' },
        }, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            status: 'success', token: expect.any(String), isNewUser: false,
        }));
        expect(User.create).not.toHaveBeenCalled();
    });

    test('login + absent account returns ACCOUNT_NOT_FOUND without creation or session', async () => {
        verifyIdToken.mockResolvedValue({ getPayload: () => verifiedPayload });
        User.findOne.mockResolvedValue(null);
        const res = response();

        await authController.googleToken({
            body: { idToken: 'opaque-valid-token', intent: 'login' },
        }, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ACCOUNT_NOT_FOUND' }));
        expect(res.json.mock.calls[0][0]).not.toHaveProperty('token');
        expect(User.create).not.toHaveBeenCalled();
        expect(PendingRegistration.findOne).not.toHaveBeenCalled();
    });

    test('signup + absent account creates one Client account and a session', async () => {
        verifyIdToken.mockResolvedValue({ getPayload: () => verifiedPayload });
        User.findOne.mockResolvedValue(null);
        const createdUser = {
            _id: 'created-user-id', tokenVersion: 0, role: 'Client',
            name: verifiedPayload.name, email: verifiedPayload.email,
            isEmailVerified: true, save: jest.fn().mockResolvedValue(undefined),
        };
        User.create.mockResolvedValue(createdUser);
        const res = response();

        await authController.googleToken({
            body: { idToken: 'opaque-valid-token', intent: 'signup', role: 'Admin' },
        }, res);

        expect(User.create).toHaveBeenCalledTimes(1);
        expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
            email: verifiedPayload.email,
            googleId: verifiedPayload.sub,
            role: 'Client',
            authProvider: 'google',
        }));
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            token: expect.any(String), isNewUser: true,
        }));
    });

    test('signup + existing account returns conflict without linking, creation, or session', async () => {
        verifyIdToken.mockResolvedValue({ getPayload: () => verifiedPayload });
        const existingUser = await User.findOne();
        existingUser.googleId = undefined;
        User.findOne.mockResolvedValue(existingUser);
        const res = response();

        await authController.googleToken({
            body: { idToken: 'opaque-valid-token', intent: 'signup' },
        }, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'ACCOUNT_ALREADY_EXISTS',
        }));
        expect(res.json.mock.calls[0][0]).not.toHaveProperty('token');
        expect(existingUser.googleId).toBeUndefined();
        expect(existingUser.save).not.toHaveBeenCalled();
        expect(User.create).not.toHaveBeenCalled();
    });

    test('a repeated signup sees the existing account and cannot create a duplicate', async () => {
        verifyIdToken.mockResolvedValue({ getPayload: () => verifiedPayload });
        const createdUser = {
            _id: 'created-user-id', tokenVersion: 0, role: 'Client',
            name: verifiedPayload.name, email: verifiedPayload.email,
            isEmailVerified: true, save: jest.fn().mockResolvedValue(undefined),
        };
        User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(createdUser);
        User.create.mockResolvedValue(createdUser);

        await authController.googleToken({
            body: { idToken: 'opaque-valid-token', intent: 'signup' },
        }, response());
        const replayResponse = response();
        await authController.googleToken({
            body: { idToken: 'opaque-valid-token', intent: 'signup' },
        }, replayResponse);

        expect(User.create).toHaveBeenCalledTimes(1);
        expect(replayResponse.status).toHaveBeenCalledWith(409);
        expect(replayResponse.json.mock.calls[0][0]).not.toHaveProperty('token');
    });

    test('rejects an invalid explicit intent before verifying the token', async () => {
        const res = response();

        await authController.googleToken({
            body: { idToken: 'opaque-token', intent: 'register-or-login' },
        }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'INVALID_AUTH_INTENT',
        }));
        expect(verifyIdToken).not.toHaveBeenCalled();
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
