// MARKETING-CONSENT-1 — Préférences de communications marketing.
//   GET   /api/users/me/marketing-preferences   (authentifié)
//   PATCH /api/users/me/marketing-preferences   (authentifié)
//   POST  /api/marketing-preferences/unsubscribe (public, jeton signé)
// L'identité provient EXCLUSIVEMENT de req.user (ou du jeton signé) — aucun
// identifiant de compte n'est accepté depuis le corps de la requête.
const asyncHandler = require('express-async-handler');
const consentService = require('../services/marketingConsentService');

const SETTINGS_SOURCES = Object.freeze({ mobile: 'mobile_settings', web: 'web_settings' });

function sendError(res, error) {
  if (error?.name === 'MarketingConsentError') {
    return res.status(error.statusCode || 400).json({ status: 'fail', code: error.code, message: error.message });
  }
  throw error;
}

exports.getMyPreferences = asyncHandler(async (req, res) => {
  try {
    const preferences = await consentService.getPreferences(req.user._id);
    res.json({ status: 'success', data: { preferences } });
  } catch (error) { sendError(res, error); }
});

exports.updateMyPreferences = asyncHandler(async (req, res) => {
  const changes = consentService.normalizeConsentInput(req.body?.channels);
  if (!Object.keys(changes).length) {
    return res.status(400).json({ status: 'fail', code: 'MARKETING_PREFERENCES_EMPTY', message: 'Aucune préférence valide fournie (booléens attendus pour email/push).' });
  }
  const source = SETTINGS_SOURCES[req.body?.client] || SETTINGS_SOURCES.web;
  try {
    const result = await consentService.applyConsentChanges(req.user._id, changes, { source });
    res.json({ status: 'success', data: { preferences: result.preferences, changed: result.changed } });
  } catch (error) { sendError(res, error); }
});

exports.unsubscribe = asyncHandler(async (req, res) => {
  try {
    const result = await consentService.unsubscribeWithToken(req.body?.token);
    res.json({ status: 'success', data: { channel: result.channel }, message: 'Votre désinscription est enregistrée.' });
  } catch (error) { sendError(res, error); }
});
