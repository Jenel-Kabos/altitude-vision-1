const mongoose = require('mongoose');
const Hotel = require('../models/Hotel');
const Property = require('../models/Property');

/**
 * Réapplique atomiquement la frontière de modération lorsqu'un propriétaire
 * modifie directement la Property canonique d'un hôtel déjà publié.
 *
 * Hotel.publicationStatus reste la décision canonique de la file hôtelière.
 * Property.statusAdmin/isPublished restent les gates de projection publique
 * et de l'espace « Mes annonces ». Aucun document n'est créé ici.
 */
async function updateOwnerPropertyAndQueueLinkedHotel({ propertyId, updateData, actorId }) {
  const session = await mongoose.startSession();
  let property;
  let hotel = null;
  const submittedAt = new Date();

  try {
    await session.withTransaction(async () => {
      property = await Property.findByIdAndUpdate(
        propertyId,
        { ...updateData, statusAdmin: 'En attente', isPublished: false },
        { new: true, runValidators: true, session },
      );
      if (!property) {
        const error = new Error('Propriété introuvable pendant la revalidation.');
        error.statusCode = 409;
        throw error;
      }

      hotel = await Hotel.findOneAndUpdate(
        { property: propertyId, publicationStatus: 'publie' },
        {
          $set: {
            publicationStatus: 'soumis',
            submittedAt,
            reviewedBy: null,
            rejectionReason: '',
            updatedBy: actorId,
          },
        },
        { new: true, session },
      );
      if (!hotel) {
        const error = new Error('Le statut de publication de l’hôtel a changé. Rechargez avant de modifier.');
        error.statusCode = 409;
        error.code = 'HOTEL_REPUBLICATION_STATE_CHANGED';
        throw error;
      }
    });
  } finally {
    await session.endSession();
  }

  return { property, hotel };
}

module.exports = { updateOwnerPropertyAndQueueLinkedHotel };
