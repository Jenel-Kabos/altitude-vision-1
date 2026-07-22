async function financialCheckpoint(injector, point, context = {}) {
  if (!injector || process.env.NODE_ENV !== 'test') return;
  await injector(point, context);
}

module.exports = { financialCheckpoint };
