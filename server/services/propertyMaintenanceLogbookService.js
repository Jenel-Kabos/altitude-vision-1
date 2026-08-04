// GL-ASSET-1 — Phase 3 : carnet d'entretien. Agrège RentalMaintenanceTicket
// (seul modèle de maintenance non-hôtelier — MaintenanceTicket.js est
// exclusivement hôtelier, jamais utilisé ici) — jamais un second modèle.
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');

async function getMaintenanceLogbook(propertyId) {
  const tickets = await RentalMaintenanceTicket.find({ property: propertyId }).sort({ createdAt: 1 }).lean();

  const coutTotal = tickets.reduce((sum, t) => sum + (t.actualCost || 0), 0);
  const interventionsOuvertes = tickets.filter((t) => !['resolu', 'cloture'].includes(t.status)).length;
  const entreprises = [...new Set(tickets.map((t) => t.entrepriseIntervenante).filter(Boolean))];
  const garantiesActives = tickets.filter((t) => t.garantieJusquau && new Date(t.garantieJusquau) > new Date());

  return {
    propertyId,
    tickets,
    coutTotal,
    interventionsOuvertes,
    entreprises,
    garantiesActives: garantiesActives.map((t) => ({ ticketId: t._id, entreprise: t.entrepriseIntervenante, garantieJusquau: t.garantieJusquau })),
  };
}

module.exports = { getMaintenanceLogbook };
