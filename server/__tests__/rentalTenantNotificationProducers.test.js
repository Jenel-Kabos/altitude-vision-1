jest.mock('../models/Contrat');
jest.mock('../models/Paiement');
jest.mock('../models/Property');
jest.mock('../models/RentalManagement');
jest.mock('../services/rentalListingSyncService');
jest.mock('../services/pdfService');
jest.mock('../services/zohoMailService', () => ({ sendEmail: jest.fn().mockResolvedValue() }));
jest.mock('../config/cloudinary', () => ({ uploadToCloudinary: jest.fn().mockResolvedValue({ secure_url: 'https://cdn.test/document.pdf' }) }));
jest.mock('../services/actionLogService', () => ({ logAction: jest.fn(), buildAuteur: jest.fn() }));
jest.mock('../services/notificationService', () => ({ notify: jest.fn(), notifyStaff: jest.fn() }));
jest.mock('../services/rentalTenantNotificationService', () => ({ notifyContractTenant: jest.fn().mockResolvedValue({}) }));

const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const pdf = require('../services/pdfService');
const tenantNotifications = require('../services/rentalTenantNotificationService');
const documentController = require('../controllers/gestionDocumentController');
const contratController = require('../controllers/contratController');
const paiementController = require('../controllers/paiementController');

const contract = { _id: 'CONTRACT-1', type: 'location', locataire: { _id: 'TENANT-1', user: 'USER-1', prenom: 'Test' }, proprietaire: {} };
const queryResolving = (value) => { const query = { populate: jest.fn(() => query), select: jest.fn(() => query), then: (resolve) => Promise.resolve(value).then(resolve) }; return query; };
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

describe('producteurs réels de notifications locatives GL-B3.1', () => {
  beforeEach(() => { jest.clearAllMocks(); Contrat.findById.mockReturnValue(queryResolving(contract)); Contrat.findByIdAndUpdate.mockResolvedValue({}); pdf.generateContratBail.mockResolvedValue(Buffer.from('pdf')); });
  test('bail visible sauvegardé → nouveau document, après persistance', async () => {
    await documentController.generateBail({ params:{contratId:contract._id}, user:{id:'STAFF'}, body:{} }, response());
    expect(Contrat.findByIdAndUpdate).toHaveBeenCalled();
    expect(tenantNotifications.notifyContractTenant).toHaveBeenCalledWith(contract, expect.objectContaining({ type:'tenant_document_added' }));
  });
  test('quittance téléchargeable → reçu distinct, sans notification document doublée', async () => {
    const payment={_id:'PAY-1',statut:'payé',mois:1,annee:2026,contrat:{_id:contract._id}};
    Paiement.findById.mockReturnValue(queryResolving(payment)); pdf.generateQuittanceLoyer.mockResolvedValue(Buffer.from('pdf'));
    await documentController.generateQuittance({params:{paiementId:payment._id},user:{id:'STAFF'}},response());
    expect(tenantNotifications.notifyContractTenant).toHaveBeenCalledTimes(1);
    expect(tenantNotifications.notifyContractTenant).toHaveBeenCalledWith(contract,expect.objectContaining({type:'tenant_receipt_added'}));
  });
  test('consultation seule / document interne → aucune notification', async () => {
    Contrat.findById.mockReturnValue(queryResolving({documents:[],etatsDesLieux:[]}));
    await documentController.getDocuments({params:{contratId:contract._id}},response());
    expect(tenantNotifications.notifyContractTenant).not.toHaveBeenCalled();
  });
  test('paiement créé en base → événement avec clé anti-doublon', async () => {
    Paiement.create.mockResolvedValue({_id:'PAY-2',contrat:contract._id,mois:2,annee:2026,statut:'impayé'});
    await contratController.createPaiement({params:{id:contract._id},body:{}},response());
    expect(tenantNotifications.notifyContractTenant).toHaveBeenCalledWith(contract._id,expect.objectContaining({type:'tenant_payment_recorded',dedupeKey:'tenant:payment:PAY-2:impayé'}));
  });
  test('paiement refusé en base → aucune notification', async () => {
    Paiement.create.mockRejectedValue(new Error('DB failure'));
    await contratController.createPaiement({params:{id:contract._id},body:{}},response());
    expect(tenantNotifications.notifyContractTenant).not.toHaveBeenCalled();
  });
  test('validation paiement réussie → destinataire résolu par contrat et événement payé', async () => {
    Paiement.findById.mockResolvedValue({_id:'PAY-3',contrat:contract._id,montant:100,penaliteAppliquee:false});
    Paiement.findOneAndUpdate.mockResolvedValue({_id:'PAY-3',contrat:contract._id,mois:3,annee:2026,statut:'payé'});
    await paiementController.marquerPaye({params:{id:'PAY-3'},body:{montantRecu:100},user:{id:'STAFF'}},response());
    expect(tenantNotifications.notifyContractTenant).toHaveBeenCalledWith(contract._id,expect.objectContaining({type:'tenant_payment_recorded',dedupeKey:'tenant:payment:PAY-3:payé'}));
  });
});
