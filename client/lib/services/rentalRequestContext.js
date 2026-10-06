export const INDIVIDUAL_RENTAL_CONTEXT = Object.freeze({ mode: 'individual' });
export const ORGANIZATION_RENTAL_CONTEXT = Object.freeze({ mode: 'organization' });

export const isIndividualRentalContext = (context) => context?.mode === 'individual';

export const rentalRequestConfig = (context = ORGANIZATION_RENTAL_CONTEXT, params = {}, config = {}) => {
  const individual = isIndividualRentalContext(context);
  const headers = { ...(config.headers || {}) };
  if (individual) {
    delete headers['X-Platform-Tenant-Id'];
    delete headers['X-Tenant-Id'];
  }
  return {
    ...config,
    params: { ...params, ...(individual ? { scope: 'individual' } : {}) },
    ...(Object.keys(headers).length || config.headers ? { headers } : {}),
    ...(individual ? { platformScoped: true } : {}),
  };
};

export const rentalBasePath = (context = ORGANIZATION_RENTAL_CONTEXT) => (
  isIndividualRentalContext(context) ? '/mes-biens/gestion-locative' : '/dashboard/gestion-locative'
);

export const callWithRentalContext = (operation, context, ...args) => (
  isIndividualRentalContext(context) ? operation(...args, context) : operation(...args)
);
