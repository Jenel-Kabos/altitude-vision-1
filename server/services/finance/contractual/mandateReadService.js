// F-U1.G — Lecture d'un mandat et de sa version courante, pour le staff
// habilité (CONTRACT_READ) ou le propriétaire / représentant (pouvoir VIEW).

const mongoose = require('mongoose');
const ManagementMandate = require('../../../models/ManagementMandate');
const ManagementMandateVersion = require('../../../models/ManagementMandateVersion');
const { fail } = require('../financialError');
const { authorizeMandateRead } = require('./ownerAuthorityService');

async function getMandateForRead({ actor, mandateId }) {
  const mandate = mongoose.isValidObjectId(mandateId) ? await ManagementMandate.findById(mandateId).lean() : null;
  if (!mandate) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Mandat inaccessible.', 404);
  const access = await authorizeMandateRead(actor, mandate);
  const version = await ManagementMandateVersion.findById(mandate.currentVersion).lean();
  return { mandate, version, viewer: access.viewer };
}

module.exports = { getMandateForRead };
