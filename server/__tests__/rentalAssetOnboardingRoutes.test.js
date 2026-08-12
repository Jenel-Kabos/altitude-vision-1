jest.mock('../models/Property');
jest.mock('../models/RentalManagement');
jest.mock('../models/Contrat');
jest.mock('../models/Paiement');
jest.mock('../models/User');
jest.mock('../services/rentalAssetOnboardingService', () => ({
  getOptions: jest.fn(), activateExisting: jest.fn(),
  OnboardingError: class OnboardingError extends Error { constructor(message, statusCode, code, missingFields=[]) { super(message); Object.assign(this,{statusCode,code,missingFields}); } },
}));
// TENANT-CERT-2 — router.param('id', …) de rentalManagementRoutes.js
// vérifie désormais la frontière tenant (voir
// __tests__/tenantCert2.adversarial.mongo.integration.test.js pour la
// vérification réelle) ; mocké ici pour rester indépendant d'une vraie
// connexion Mongo dans ce test unitaire.
jest.mock('../services/platformTenant/tenantContextService', () => ({
  resolveEffectiveTenantContext: jest.fn().mockResolvedValue({ tenant: { _id: '607f1f77bcf86cd799439001', rootOrgUnit: '607f1f77bcf86cd799439001' }, source: 'single_membership' }),
  resolveTenantForUser: jest.fn().mockResolvedValue({ _id: '607f1f77bcf86cd799439001', rootOrgUnit: '607f1f77bcf86cd799439001' }),
  resolveRootOrgUnitId: jest.fn().mockResolvedValue('607f1f77bcf86cd799439001'),
  resolveAvailableTenantsForUser: jest.fn().mockResolvedValue([{ _id: '607f1f77bcf86cd799439001' }]),
  resolveTenantScope: jest.fn().mockResolvedValue({ scopeUserIds: new Set() }),
}));
jest.mock('../services/platformTenant/tenantResourceAttributionService', () => ({
  assertResourceTenant: jest.fn().mockResolvedValue({ status: 'resolved', tenantId: '607f1f77bcf86cd799439001' }),
  assertResourceTenantOrUnattributed: jest.fn().mockResolvedValue({ status: 'resolved', tenantId: '607f1f77bcf86cd799439001' }),
  resolveResourceTenant: jest.fn().mockResolvedValue({ status: 'resolved', tenantId: '607f1f77bcf86cd799439001' }),
}));
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../scripts/sync-facebook', () => ({ syncFacebook: jest.fn() }));
jest.mock('../services/zohoImapService', () => ({ pollZohoInbox: jest.fn() }));
jest.mock('../services/alerteService', () => ({ verifierPaiementsEnRetard: jest.fn() }));
jest.mock('../utils/generateSitemap', () => jest.fn().mockResolvedValue('<xml/>'));
jest.mock('../services/notificationService', () => ({ notify:jest.fn(), notifyStaff:jest.fn(), notifyMany:jest.fn() }));
jest.mock('../config/cloudinary', () => ({ ...jest.requireActual('../config/cloudinary'), destroyFromCloudinary:jest.fn() }));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../server');
const User = require('../models/User');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const Contrat = require('../models/Contrat');
const onboarding = require('../services/rentalAssetOnboardingService');
const ADMIN='507f1f77bcf86cd799439012'; const PROPERTY='507f191e810c19729de860ea';
const token=(id)=>jwt.sign({id,tokenVersion:0},process.env.JWT_SECRET,{expiresIn:'1d'});
const auth=(role)=>{ User.findById=jest.fn().mockReturnValue({select:jest.fn().mockResolvedValue({_id:ADMIN,id:ADMIN,name:'Staff',email:'staff@test.dev',role,isActive:true,status:'Actif',tokenVersion:0})}); User.findByIdAndUpdate=jest.fn().mockReturnValue({catch:jest.fn()}); };

describe('GL-ASSET-UX-1.1 — onboarding routes',()=>{
  afterEach(()=>jest.clearAllMocks());
  test.each(['Admin','GestionnaireImmobilier'])('le CTA API est autorisé pour %s',async(role)=>{ auth(role); onboarding.getOptions.mockResolvedValue({properties:[],owners:[]}); const res=await request(app).get('/api/rental-management/onboarding/options').set('Authorization',`Bearer ${token(ADMIN)}`); expect(res.statusCode).toBe(200); });
  test.each(['Proprietaire','Client','Locataire','Collaborateur','Secretaire'])('onboarding interdit pour %s',async(role)=>{ auth(role); const res=await request(app).post('/api/rental-management/onboarding').set('Authorization',`Bearer ${token(ADMIN)}`).send({mode:'existing',property:PROPERTY}); expect(res.statusCode).toBe(403); expect(onboarding.activateExisting).not.toHaveBeenCalled(); });
  test('lecture des options interdite sans authentification',async()=>{ const res=await request(app).get('/api/rental-management/onboarding/options'); expect(res.statusCode).toBe(401); });
  test('active un Property existant et retourne le dossier',async()=>{ auth('Admin'); onboarding.activateExisting.mockResolvedValue({property:{_id:PROPERTY,isPublished:false},rental:{_id:'r1',managementActivated:true}}); const res=await request(app).post('/api/rental-management/onboarding').set('Authorization',`Bearer ${token(ADMIN)}`).send({mode:'existing',property:PROPERTY}); expect(res.statusCode).toBe(201); expect(res.body.data.rental.managementActivated).toBe(true); });
  test('refuse toute création de Property depuis la Gestion locative',async()=>{ auth('GestionnaireImmobilier'); const res=await request(app).post('/api/rental-management/onboarding').set('Authorization',`Bearer ${token(ADMIN)}`).send({mode:'new',owner:ADMIN,title:'Interne'}); expect(res.statusCode).toBe(422); expect(res.body.code).toBe('EXISTING_PROPERTY_REQUIRED'); expect(onboarding.activateExisting).not.toHaveBeenCalled(); });
  test('retourne le conflit métier clair sans doublon',async()=>{ auth('Admin'); onboarding.activateExisting.mockRejectedValue(new onboarding.OnboardingError('Ce bien est déjà sous gestion.',409,'ALREADY_MANAGED')); const res=await request(app).post('/api/rental-management/onboarding').set('Authorization',`Bearer ${token(ADMIN)}`).send({mode:'existing',property:PROPERTY}); expect(res.statusCode).toBe(409); expect(res.body.message).toBe('Ce bien est déjà sous gestion.'); });

  test('retire seulement RentalManagement et conserve Property', async()=>{
    auth('Admin');
    const rental={_id:PROPERTY,property:PROPERTY,managementActivated:true,active:true,currentTenant:null,activeLease:null,occupancyStatus:'vacant',workflowHistory:[],save:jest.fn().mockResolvedValue()};
    rental.toObject=()=>({...rental,toObject:undefined,save:undefined});
    RentalManagement.findById.mockResolvedValue(rental);
    Contrat.find.mockReturnValue({select:jest.fn().mockResolvedValue([])});
    Property.exists.mockResolvedValue({_id:PROPERTY});
    const res=await request(app).post(`/api/rental-management/${PROPERTY}/deactivate`).set('Authorization',`Bearer ${token(ADMIN)}`).send({comment:'Fin de mandat'});
    expect(res.statusCode).toBe(200); expect(res.body.data.propertyStillExists).toBe(true);
    expect(rental.managementActivated).toBe(false); expect(rental.active).toBe(false);
    expect(rental.workflowHistory.at(-1).action).toBe('rental_management_deactivated');
  });

  test('refuse le retrait si un contrat est actif', async()=>{
    auth('GestionnaireImmobilier');
    RentalManagement.findById.mockResolvedValue({_id:PROPERTY,property:PROPERTY,managementActivated:true,workflowHistory:[]});
    Contrat.find.mockReturnValue({select:jest.fn().mockResolvedValue([{_id:PROPERTY}])});
    const Paiement=require('../models/Paiement'); Paiement.exists.mockResolvedValue(null);
    const res=await request(app).post(`/api/rental-management/${PROPERTY}/deactivate`).set('Authorization',`Bearer ${token(ADMIN)}`).send({});
    expect(res.statusCode).toBe(409); expect(res.body.code).toBe('ACTIVE_LEASE_BLOCKS_REMOVAL');
    expect(Property.exists).not.toHaveBeenCalled();
  });
});
