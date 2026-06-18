const Property = require('../models/Property');

const createPropertyMobile = async (req, res) => {
  try {
    const {
      titre,
      description,
      prix,
      superficie,
      chambres,
      ville,
      quartier,
      type,
      categorie,
      photos,
      latitude,
      longitude,
    } = req.body;

    if (!photos || photos.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Au moins une photo requise',
      });
    }
    if (!quartier) {
      return res.status(400).json({
        status: 'error',
        message: 'Quartier requis',
      });
    }

    const property = await Property.create({
      title: titre,
      description,
      price: prix,
      surface: superficie,
      bedrooms: chambres || 0,
      address: {
        city: ville,
        district: quartier,
      },
      type,
      status:
        typeof categorie === 'string' ? categorie.toLowerCase() : categorie,
      images: photos,
      pole: 'Altimmo',
      owner: req.user.id,
      latitude: latitude || -4.2661,
      longitude: longitude || 15.2832,
    });

    return res.status(201).json({
      status: 'success',
      data: { property },
    });
  } catch (err) {
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
