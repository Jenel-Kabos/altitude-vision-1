const { takeBlockedAttempts } = require('../test-utils/externalNetworkGuard');

afterEach(() => {
  const blocked = takeBlockedAttempts();
  if (blocked.length) throw new Error(`Unexpected external network attempt(s): ${blocked.map(({ host }) => host).join(', ')}`);
});
