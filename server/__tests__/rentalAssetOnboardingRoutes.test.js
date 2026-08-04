jest.mock('../models/Property');
jest.mock('../models/RentalManagement');
jest.mock('../models/Contrat');
jest.mock('../models/Paiement');
jest.mock('../models/User');
jest.mock('../services/rentalAssetOnboardingService', () => ({
  getOptions: jest.fn(), activateExisting: jest.fn(), createManaged: jest.fn(),
  OnboardingError: class OnboardingError extends Error { constructor(message, statusCode, code, missingFields=[]) { super(message); Object.assign(this,{statusCode,code,missingFields}); } },
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
const onboarding = require('../services/rentalAssetOnboardingService');
const ADMIN='507f1f77bcf86cd799439012'; const PROPERTY='507f191e810c19729de860ea';
const token=(id)=>jwt.sign({id,tokenVersion:0},process.env.JWT_SECRET,{expiresIn:'1d'});
const auth=(role)=>{ User.findById=jest.fn().mockReturnValue({select:jest.fn().mockResolvedValue({_id:ADMIN,id:ADMIN,name:'Staff',email:'staff@test.dev',role,isActive:true,status:'Actif',tokenVersion:0})}); User.findByIdAndUpdate=jest.fn().mockReturnValue({catch:jest.fn()}); };

describe('GL-ASSET-UX-1.1 — onboarding routes',()=>{
  afterEach(()=>jest.clearAllMocks());
  test.each(['Admin','GestionnaireImmobilier'])('le CTA API est autorisé pour %s',async(role)=>{ auth(role); onboarding.getOptions.mockResolvedValue({properties:[],owners:[]}); const res=await request(app).get('/api/rental-management/onboarding/options').set('Authorization',`Bearer ${token(ADMIN)}`); expect(res.statusCode).toBe(200); });
  test.each(['Proprietaire','Client','Locataire','Collaborateur'])('onboarding interdit pour %s',async(role)=>{ auth(role); const res=await request(app).post('/api/rental-management/onboarding').set('Authorization',`Bearer ${token(ADMIN)}`).send({mode:'existing',property:PROPERTY}); expect(res.statusCode).toBe(403); expect(onboarding.activateExisting).not.toHaveBeenCalled(); });
  test('active un Property existant et retourne le dossier',async()=>{ auth('Admin'); onboarding.activateExisting.mockResolvedValue({property:{_id:PROPERTY,isPublished:false},rental:{_id:'r1',managementActivated:true}}); const res=await request(app).post('/api/rental-management/onboarding').set('Authorization',`Bearer ${token(ADMIN)}`).send({mode:'existing',property:PROPERTY}); expect(res.statusCode).toBe(201); expect(res.body.data.rental.managementActivated).toBe(true); });
  test('crée un Property privé et son RentalManagement actif',async()=>{ auth('GestionnaireImmobilier'); onboarding.createManaged.mockResolvedValue({property:{_id:PROPERTY,isPublished:false,recommande:false},rental:{_id:'r1',managementActivated:true}}); const res=await request(app).post('/api/rental-management/onboarding').set('Authorization',`Bearer ${token(ADMIN)}`).send({mode:'new',owner:ADMIN,title:'Interne'}); expect(res.statusCode).toBe(201); expect(res.body.data.property.isPublished).toBe(false); expect(res.body.data.rental.managementActivated).toBe(true); });
  test('retourne le conflit métier clair sans doublon',async()=>{ auth('Admin'); onboarding.activateExisting.mockRejectedValue(new onboarding.OnboardingError('Ce bien est déjà sous gestion.',409,'ALREADY_MANAGED')); const res=await request(app).post('/api/rental-management/onboarding').set('Authorization',`Bearer ${token(ADMIN)}`).send({mode:'existing',property:PROPERTY}); expect(res.statusCode).toBe(409); expect(res.body.message).toBe('Ce bien est déjà sous gestion.'); });
});
