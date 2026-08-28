const Property = require('../models/Property');
const User = require('../models/User');
const { notify } = require('../services/notificationService');
const { buildMobilePropertyData } = require('../services/propertyPublicationInputService');

const createPropertyMobile = async (req, res) => {
  try {
    const propertyData = buildMobilePropertyData(req.body, req.user.id);
    const property = await Property.create(propertyData);

    // Notifier les Admin (modération réservée à ce rôle, cf. AdminDashboard
    // NAV_SECTIONS "Modération Biens" → roles: ['Admin']) — best-effort
    User.find({ role: 'Admin' }).select('_id').lean()
      .then((admins) => Promise.allSettled(admins.map((a) => notify({ recipient: a._id,
        type:  'property_pending_moderation',
        title: `Nouveau bien à modérer : ${req.body.titre}`,
        body:  `${req.body.ville || ''} ${req.body.arrondissement || ''}`.trim(),
        link:  '/dashboard/moderation/properties',
        data:  { screen: 'ModerationProperties', propertyId: property._id.toString() },
      }))))
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
