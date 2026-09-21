#!/usr/bin/env node
// scripts/certify.js — LEVEL-2 domain certification runner (see
// docs/testing/CERTIFICATION.md and CLAUDE.md).
//
// Runs a curated Jest pattern set for a single business domain against
// the server test suite (Mongo-integration + unit as needed). Prints a
// summary and exits non-zero if any suite fails.
//
// Usage:
//   node scripts/certify.js <domain>
//   npm run certify:<domain>          (from root)
//
// Domains:
//   tenant, contracts, rental, sales, financial, architecture,
//   frontend, release
//
// The `release` domain composes the existing `npm run release-check`
// (local-ci in release mode) — it is expensive (~1–2 h Mongo full).
// LEVEL-1 (feature-only) work should never invoke certify:release.

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server');
const CLIENT = path.join(ROOT, 'client');

// Curated pattern lists per domain. Patterns are Jest testPathPatterns
// regex fragments (dot-escaped, anchored on the filename). Add-only —
// removing a pattern requires explicit architecture review.
const BUNDLES = {
  tenant: {
    workspace: SERVER,
    jestPatterns: [
      'tenantMembershipRole\\.',
      'tenantAttributionPropertyDirect2E1X\\.',
      'tenantMembershipPromotion2E1\\.',
      'tenantHardening\\.',
      'tenantHardening2\\.',
      'tenantCert2\\.',
      'architectureBoundaries\\.',
    ],
  },
  contracts: {
    workspace: SERVER,
    jestPatterns: [
      'contratDomainSplit2E2XIV\\.',
      'legacyContratMutationRetirement3C\\.',
      'postContractContratTenantAuthority2E2XIII\\.',
      'contratUpdateLifecycleGuard\\.',
      'saleContractLifecycle\\.',
      'rentalLeaseLifecycleRoutes\\.',
      'rentalLeaseLifecycleTenantContext2E1XI\\.',
      'architectureBoundaries\\.',
    ],
  },
  rental: {
    workspace: SERVER,
    jestPatterns: [
      'rentalLeaseLifecycleRoutes\\.',
      'rentalLeaseLifecycleTenantContext2E1XI\\.',
      'paymentLocationDomain2E1XI\\.',
      'rentalContractRegularization',
      'tenantMembershipRole\\.',
      'contratDomainSplit2E2XIV\\.',
      'architectureBoundaries\\.',
    ],
  },
  sales: {
    workspace: SERVER,
    jestPatterns: [
      'saleContractLifecycle\\.',
      'contratDomainSplit2E2XIV\\.',
      'postContractContratTenantAuthority2E2XIII\\.',
      'saleCommercialPlatformAuthority2E1XI\\.',
      'tenantMembershipRole\\.',
      'tenantAttributionPropertyDirect2E1X\\.',
      'legacyContratMutationRetirement3C\\.',
      'contratUpdateLifecycleGuard\\.',
      'architectureBoundaries\\.',
    ],
  },
  financial: {
    workspace: SERVER,
    jestPatterns: [
      'realEstateTransactionFinalization',
      'financialCore\\.',
      'financialIdempotency',
      'financialAllocationService',
      'financialSequenceService',
      'paymentLocationDomain2E1XI\\.',
      'transactionCancellationReleasesReservation',
      'financialAuthorityHotel\\.',
      'financialSecurityHotelAdapter\\.',
      'hotelCheckoutFinancialReadiness\\.',
      'hotelFinancialCheckoutF23\\.',
      'hotelInvoicePdfRenderer\\.',
      'hotelFinancialPdfEmailF24\\.',
      'hotelFinancialDashboardService\\.',
      'hotelFinancialDashboardF25\\.',
      'architectureBoundaries\\.',
    ],
  },
  architecture: {
    workspace: SERVER,
    jestPatterns: ['architectureBoundaries\\.'],
    extraSteps: [
      // Structural check is independent of Jest — it inspects source.
      { label: 'server/architecture:check', cwd: SERVER, npm: ['run', 'architecture:check'] },
    ],
  },
  frontend: {
    workspace: CLIENT,
    npm: ['run', 'test', '--', '--run'],
  },
  release: {
    workspace: ROOT,
    npm: ['run', 'release-check'],
    warning: 'certify:release invokes the full local-ci release pipeline (~1–2 h). Only run at release boundary.',
  },
};

const domain = process.argv[2];
if (!domain || !BUNDLES[domain]) {
  console.error(`Usage: node scripts/certify.js <${Object.keys(BUNDLES).join('|')}>`);
  process.exit(2);
}

const bundle = BUNDLES[domain];
if (bundle.warning) console.error(`\n⚠  ${bundle.warning}\n`);

const started = Date.now();
const results = [];

function run({ label, cwd, cmd, args }) {
  console.log(`\n▶ ${label}  (${cwd.replace(ROOT, '.')}: ${cmd} ${args.join(' ')})`);
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, CI: process.env.CI || '1' },
  });
  results.push({ label, ok: res.status === 0 });
  return res.status === 0;
}

if (bundle.jestPatterns) {
  const args = [
    'jest',
    ...bundle.jestPatterns,
    '--runInBand',
    '--forceExit',
    '--colors',
  ];
  run({ label: `${domain}: jest`, cwd: bundle.workspace, cmd: 'npx', args });
}

if (bundle.extraSteps) {
  for (const step of bundle.extraSteps) {
    run({ label: step.label, cwd: step.cwd, cmd: 'npm', args: step.npm });
  }
}

if (bundle.npm) {
  run({ label: `${domain}: ${bundle.npm.join(' ')}`, cwd: bundle.workspace, cmd: 'npm', args: bundle.npm });
}

const duration = ((Date.now() - started) / 1000).toFixed(1);
const failed = results.filter((r) => !r.ok);

console.log('\n============================================');
console.log(`CERTIFY:${domain.toUpperCase()}  —  ${duration}s`);
for (const r of results) console.log(`  ${r.ok ? '✅' : '❌'}  ${r.label}`);
console.log('============================================');

if (failed.length) {
  console.log(`\n${failed.length} step(s) failed — see logs above.`);
  console.log('Classify per docs/testing/FAILURE_CLASSIFICATION.md before deciding whether to block.');
  process.exit(1);
}
console.log('\n✅ Domain certification GREEN.');
process.exit(0);
