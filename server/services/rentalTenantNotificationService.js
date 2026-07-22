const Contrat = require('../models/Contrat');
const Locataire = require('../models/Locataire');
const { notify } = require('./notificationService');

async function tenantUserForContract(contractOrId) {
  const contract = contractOrId?.locataire !== undefined ? contractOrId : await Contrat.findById(contractOrId).select('locataire').lean();
  const tenantId = contract?.locataire?._id || contract?.locataire;
  if (!tenantId) return null;
  const tenant = contract.locataire?.user !== undefined ? contract.locataire : await Locataire.findById(tenantId).select('user').lean();
  return tenant?.user || null;
}

async function notifyContractTenant(contractOrId, payload) {
  const recipient = await tenantUserForContract(contractOrId);
  if (!recipient) return null;
  return notify({ recipient, link: '/espace-locataire', ...payload });
}

module.exports = { tenantUserForContract, notifyContractTenant };
