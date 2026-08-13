// Gestion des routes non trouvées (404)
const notFound = (req, res, next) => {
  const error = new Error(`Introuvable - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Handler global d'erreurs avec formatage Mongoose
const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // ObjectId invalide (ex: /api/properties/abc)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Ressource non trouvée.';
  }

  // Champ unique violé (ex: email déjà pris)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0];
    message = field
      ? `La valeur '${err.keyValue[field]}' existe déjà pour le champ '${field}'.`
      : 'Valeur en doublon.';
  }

  // Erreur de validation Mongoose
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
  }

  // CORS
  if (err.message === 'Not allowed by CORS') {
    statusCode = 403;
    message = 'Bloqué par la politique CORS.';
  }

  // Multer
  if (err.name === 'MulterError') {
    statusCode = 400;
    message = `Erreur upload : ${err.message}`;
  }

  if (err.name === 'FinancialError') {
    statusCode = err.statusCode || 422;
    message = err.message;
  }

  if (err.name === 'HotelAccessError') {
    statusCode = err.statusCode || 403;
    message = err.message;
  }

  // USER-ARCH-1 — même convention que FinancialError/HotelAccessError.
  if (err.name === 'BusinessProfileError') {
    statusCode = err.statusCode || 400;
    message = err.message;
  }

  // ORGANIZATION-1 — même convention.
  if (err.name === 'OrganizationError') {
    statusCode = err.statusCode || 400;
    message = err.message;
  }

  if (['CrmError', 'TemplateError', 'CampaignError', 'TenantQuotaError', 'PlatformTenantError', 'ApiKeyError', 'TenantContextError', 'PlatformOperatorError'].includes(err.name)) {
    statusCode = err.statusCode || 400;
    message = err.message;
  }

  res.status(statusCode).json({
    status: statusCode >= 500 ? 'error' : 'fail',
    message,
    ...(err.name === 'FinancialError' && { code: err.code }),
    ...(err.name === 'HotelAccessError' && { code: err.code }),
    ...(err.name === 'BusinessProfileError' && { code: err.code }),
    ...(err.name === 'OrganizationError' && { code: err.code }),
    ...(['CrmError', 'TemplateError', 'CampaignError', 'TenantQuotaError', 'PlatformTenantError', 'ApiKeyError', 'TenantContextError', 'PlatformOperatorError'].includes(err.name) && { code: err.code }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };
