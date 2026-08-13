const http = require('http');
const net = require('net');
const path = require('path');
const { execFileSync } = require('child_process');
const { safeTestEnv, EXTERNAL_CREDENTIAL_KEYS } = require('../test-utils/safeTestEnv');
const { takeBlockedAttempts } = require('../test-utils/externalNetworkGuard');

describe('test external isolation', () => {
  test.each([
    ['Zoho SMTP', 'smtp.zoho.com'],
    ['Zoho IMAP', 'imap.zoho.com'],
    ['Cloudinary', 'api.cloudinary.com'],
    ['Facebook', 'graph.facebook.com'],
    ['CinetPay', 'api-checkout.cinetpay.com'],
    ['Google', 'oauth2.googleapis.com'],
    ['generic HTTP', 'external.invalid'],
  ])('%s est refusé avant connexion', (_provider, host) => {
    expect(() => net.connect({ host, port: 443 })).toThrow(expect.objectContaining({ code: 'EXTERNAL_NETWORK_BLOCKED_IN_TEST' }));
    expect(takeBlockedAttempts()).toEqual([{ host, code: 'EXTERNAL_NETWORK_BLOCKED_IN_TEST' }]);
  });

  test('localhost reste autorisé pour les serveurs jetables', async () => {
    const server = http.createServer((_req, res) => res.end('local-ok'));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const body = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}`, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => resolve(data));
      }).on('error', reject);
    });
    await new Promise((resolve) => server.close(resolve));
    expect(body).toBe('local-ok');
  });

  test('un child process reçoit un environnement assaini et le même kill-switch', () => {
    const guard = path.resolve(__dirname, '../test-utils/externalNetworkGuard.js');
    const inherited = { ...process.env };
    for (const key of EXTERNAL_CREDENTIAL_KEYS) inherited[key] = `real-${key.toLowerCase()}`;
    const env = safeTestEnv(inherited, { NODE_OPTIONS: `--require=${guard}` });
    const script = [
      "const net=require('net')",
      "let code=null;try{net.connect({host:'external.invalid',port:443})}catch(error){code=error.code}",
      `const keys=${JSON.stringify(EXTERNAL_CREDENTIAL_KEYS)}`,
      "process.stdout.write(JSON.stringify({code,clean:keys.every(key=>process.env[key]==='')}))",
    ].join(';');
    const result = JSON.parse(execFileSync(process.execPath, ['-e', script], { env, encoding: 'utf8' }));
    expect(result).toEqual({ code: 'EXTERNAL_NETWORK_BLOCKED_IN_TEST', clean: true });
  });
});
