// Import du modèle Event (correspond au fichier Event.js)
const Event = require('../models/Event');
const { logAction, buildAuteur } = require('../services/actionLogService');

/**
 * @desc    Créer un nouvel événement
 */
exports.createEvent = async (req, res) => {
  try {
    const newEvent = await Event.create(req.body);
    res.status(201).json({
      status: 'success',
      data: { event: newEvent },
    });
    logAction({
      action: 'Événement créé',
      description: `Événement "${newEvent.title}" ajouté`,
      module: 'MilaEvents',
      typeAction: 'CRÉATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(newEvent._id), type: 'Event', nom: newEvent.title },
      req,
    });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * @desc    Récupérer tous les événements avec tri dynamique sécurisé
 */
exports.getAllEvents = async (req, res) => {
  try {
    let query = Event.find();

    // --- Tri dynamique ---
    // Exemple : ?sort=-date ou ?sort=title
    if (req.query.sort) {
      const sortParam = req.query.sort;

      // Vérifie que le champ existe dans le schéma
      const validFields = ['title', 'date', 'location', 'createdAt', 'updatedAt'];
      const field = sortParam.replace('-', '');
      if (!validFields.includes(field)) {
        return res.status(400).json({
          status: 'fail',
          message: `Champ de tri invalide: ${field}`,
        });
      }

      query = query.sort(sortParam);
    } else {
      // Tri par défaut par date décroissante
      query = query.sort('-date');
    }

    const events = await query;

    res.status(200).json({
      status: 'success',
      results: events.length,
      data: { events },
    });
  } catch (error) {
    console.error('ERREUR DANS getAllEvents:', error);
    res.status(500).json({
      status: 'error',
      message: 'Une erreur est survenue sur le serveur.',
      error: error.message, // utile pour debug
    });
  }
};

/**
 * @desc    Récupérer un seul événement
 */
exports.getEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        status: 'fail',
        message: 'Aucun événement trouvé avec cet ID',
      });
    }
    res.status(200).json({
      status: 'success',
      data: { event },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

/**
 * @desc    Mettre à jour un événement
 */
exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!event) {
      return res.status(404).json({
        status: 'fail',
        message: 'Aucun événement trouvé avec cet ID',
      });
    }
    res.status(200).json({
      status: 'success',
      data: { event },
    });
    logAction({
      action: 'Événement modifié',
      description: `Événement "${event.title}" mis à jour`,
      module: 'MilaEvents',
      typeAction: 'MODIFICATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(event._id), type: 'Event', nom: event.title },
      req,
    });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * @desc    Supprimer un événement
 */
exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
      return res.status(404).json({
        status: 'fail',
        message: 'Aucun événement trouvé avec cet ID',
      });
    }
    res.status(204).json({
      status: 'success',
      data: null,
    });
    logAction({
      action: 'Événement supprimé',
      description: `Événement "${event.title}" supprimé`,
      module: 'MilaEvents',
      typeAction: 'SUPPRESSION',
      auteur: buildAuteur(req.user),
      cible: { id: String(event._id), type: 'Event', nom: event.title },
      req,
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
