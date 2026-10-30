const Property = require('../models/Property');
const { buildMobilePropertyData } = require('../services/propertyPublicationInputService');
const { publicSnapshot, createPendingRevision } = require('../services/commercialPublicationService');
const { notifyPropertyLifecycleEvent } = require('../services/propertyPublicationNotificationService');

const createPropertyMobile = async (req, res) => {
  try {
    const propertyData = buildMobilePropertyData(req.body, req.user.id);
    propertyData.tenant = req.propertyCreationTenantId || null;
    const property = await Property.create(propertyData);
    const revision = await createPendingRevision({ resourceType: 'Property', resource: property, proposedSnapshot: publicSnapshot(property), actor: req.user });

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
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
};

module.exports = { createPropertyMobile };
