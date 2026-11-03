const Property = require('../models/Property');
const { buildMobilePropertyData } = require('../services/propertyPublicationInputService');
const { submitPropertyForReview } = require('../services/propertyPublicationLifecycleService');
const { notifyPropertyLifecycleEvent } = require('../services/propertyPublicationNotificationService');

const createPropertyMobile = async (req, res) => {
  try {
    const propertyData = buildMobilePropertyData(req.body, req.user.id);
    propertyData.tenant = req.propertyCreationTenantId || null;
    const property = await Property.create(propertyData);
    // ALTIMMO-E2E-IMMOBILIER-02 (D-01) — même soumission rattachée que le dépôt web.
    const revision = await submitPropertyForReview({ propertyId: property._id, actor: req.user });

    notifyPropertyLifecycleEvent({ event: 'submitted', property, actor: req.user, transitionKey: String(revision._id) })
      .catch(() => {});

    return res.status(201).json({
      status: 'success',
      data: { property },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        status: 'error',
        message: err.message,
      });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        status: 'error',
        message: err.message,
      });
    }
    // ALTIMMO-E2E-IMMOBILIER-02 (D-14) — jamais le document ni l'erreur MongoDB brute dans la réponse.
    console.error('❌ [createPropertyMobile]', err.name || 'Error');
    return res.status(500).json({
      status: 'error',
      message: 'Création de l’annonce impossible.',
    });
  }
};

module.exports = { createPropertyMobile };
