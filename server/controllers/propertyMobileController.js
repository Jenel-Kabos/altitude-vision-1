const Property = require('../models/Property');

const createPropertyMobile = async (req, res) => {
  try {
    const {
      titre,
      description,
      prix,
      superficie,
      chambres,
      bathrooms,
      livingRooms,
      kitchens,
      ville,
      arrondissement,
      type,
      categorie,
      photos,
      amenities,
      latitude,
      longitude,
      cautionMultiplicateur,
      profilsLocataireRecherches,
      documentsRequis,
    } = req.body;

    if (!photos || photos.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Au moins une photo requise',
      });
    }
    if (!arrondissement) {
      return res.status(400).json({
        status: 'error',
        message: 'Arrondissement requis',
      });
    }

    const property = await Property.create({
      title: titre,
      description,
      price: prix,
      surface: superficie,
      bedrooms: chambres || 0,
      bathrooms: bathrooms || 0,
      livingRooms: livingRooms || 0,
      kitchens: kitchens || 0,
      amenities: Array.isArray(amenities) ? amenities : [],
      cautionMultiplicateur: cautionMultiplicateur !== undefined ? Number(cautionMultiplicateur) : 2,
      profilsLocataireRecherches: Array.isArray(profilsLocataireRecherches) ? profilsLocataireRecherches : [],
      documentsRequis: Array.isArray(documentsRequis) ? documentsRequis : [],
      address: {
        city: ville,
        arrondissement,
      },
      type,
      status:
        typeof categorie === 'string' ? categorie.toLowerCase() : categorie,
      images: photos,
      pole: 'Altimmo',
      statusAdmin: 'En attente',
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
