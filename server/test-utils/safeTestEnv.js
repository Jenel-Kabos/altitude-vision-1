const EXTERNAL_CREDENTIAL_KEYS = Object.freeze([
  'ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN', 'ZOHO_ACCOUNT_ID',
  'ZOHO_IMAP_PASSWORD', 'ZOHO_WEBHOOK_SECRET', 'EMAIL_PASSWORD', 'EMAIL_USERNAME',
  'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'CLOUDINARY_URL',
  'FACEBOOK_ACCESS_TOKEN', 'CINETPAY_API_KEY', 'CINETPAY_SECRET', 'CINETPAY_SITE_ID',
  'GOOGLE_MAPS_API_KEY', 'GOOGLE_CLIENT_SECRET', 'TWILIO_AUTH_TOKEN',
  'YABETOO_SECRET_KEY', 'YABETOO_WEBHOOK_SECRET',
]);

function safeTestEnv(source = process.env, overrides = {}) {
  const env = { ...source };
  // Empty values deliberately shadow dotenv: deleting would let a later
  // dotenv.config() reload the developer's real server/.env credentials.
  for (const key of EXTERNAL_CREDENTIAL_KEYS) env[key] = '';
  return { ...env, NODE_ENV: overrides.NODE_ENV || 'test', DISABLE_SCHEDULED_JOBS: '1', TEST_EXTERNAL_NETWORK: 'deny', ...overrides };
}

function applySafeTestEnv(target = process.env, overrides = {}) {
  const safe = safeTestEnv(target, overrides);
  Object.assign(target, safe);
  return target;
}

module.exports = { EXTERNAL_CREDENTIAL_KEYS, safeTestEnv, applySafeTestEnv };
