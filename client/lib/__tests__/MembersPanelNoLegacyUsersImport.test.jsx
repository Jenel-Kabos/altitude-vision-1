// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1F · LEGACY-18 — statique.
// MembersPanel et son service ne doivent référencer AUCUN endpoint
// administratif /users/* (create-by-admin, :id/role, :id/suspend,
// :id/activate, DELETE :id). Ceci prévient toute réintroduction furtive.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const readFile = (rel) => readFileSync(resolve(here, rel), 'utf8');

describe('LEGACY-18 · MembersPanel has no legacy /users administrative call', () => {
  test('MembersPanel.jsx does not import legacy user admin service functions', () => {
    const src = readFile('../pages/dashboard/MembersPanel.jsx');
    expect(src).not.toMatch(/from ['"]\.\.\/services\/userService['"]/);
    expect(src).not.toMatch(/createUserByAdmin|updateUserRole|deleteAdminUser/);
  });

  test('tenantMemberService.js touches only /members endpoints', () => {
    const src = readFile('../services/tenantMemberService.js');
    // Explicit allowlist : the file must only address the /members surface.
    expect(src).not.toMatch(/['"]\/users\//);
    expect(src).toMatch(/['"]\/members/);
  });

  // C2.9 — la page délègue au routeur de contexte : plateforme → UsersPanel
  // (registre User), tenant → MembersPanel (OrgMembership).
  test('users/page.jsx renders the context router, never a panel directly', () => {
    const src = readFile('../../app/dashboard/users/page.jsx');
    expect(src).toMatch(/UsersContextPanel/);
    expect(src).not.toMatch(/import\s+(UsersPanel|MembersPanel)\b/);
  });
});
