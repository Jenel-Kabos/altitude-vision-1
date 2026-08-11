const User = require('../../models/User');
const Hotel = require('../../models/Hotel');
const organizationService = require('../../services/organizationService');
const platformTenantService = require('../../services/platformTenant/platformTenantService');

let sequence = 0;

async function createTenantFixture({ label = 'Tenant fixture', bootstrap } = {}) {
  sequence += 1;
  const actor = bootstrap || await User.create({
    name: 'Tenant Bootstrap',
    email: `tenant-bootstrap-${Date.now()}-${sequence}@example.test`,
    password: 'Password123!',
    passwordConfirm: 'Password123!',
    role: 'Admin',
    isEmailVerified: true,
  });
  const tenant = await platformTenantService.createTenant({ name: `${label} ${Date.now()} ${sequence}`, actor });
  return { tenant, bootstrap: actor };
}

async function addTenantMember({ tenant, user, bootstrap }) {
  await organizationService.grantMembership({ userId: user._id, orgUnitId: tenant.rootOrgUnit, actor: bootstrap });
  return tenantActor(user, tenant);
}

function tenantActor(user, tenant, tenantScopeUserIds) {
  return {
    role: user.role,
    _id: user._id,
    platformTenant: tenant,
    tenantScopeUserIds: tenantScopeUserIds || [user._id],
  };
}

async function createTenantUser({ tenant, bootstrap, overrides = {} }) {
  sequence += 1;
  const user = await User.create({
    name: 'Tenant User',
    email: `tenant-user-${Date.now()}-${sequence}@example.test`,
    password: 'Password123!',
    passwordConfirm: 'Password123!',
    role: 'Collaborateur',
    isEmailVerified: true,
    ...overrides,
  });
  const actor = await addTenantMember({ tenant, user, bootstrap });
  return { user, actor };
}

async function createTenantHotel({ tenant, manager, createdBy, overrides = {} }) {
  sequence += 1;
  return Hotel.create({
    name: `Tenant Hotel ${sequence}`,
    tenant: tenant._id,
    manager: manager?._id || manager,
    createdBy: createdBy?._id || createdBy || manager?._id || manager,
    ...overrides,
  });
}

module.exports = { createTenantFixture, addTenantMember, tenantActor, createTenantUser, createTenantHotel };
