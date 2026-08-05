const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Proprietaire = require('../models/Proprietaire');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const Contrat = require('../models/Contrat');
const onboarding = require('../services/rentalAssetOnboardingService');

jest.setTimeout(120000);
let counter = 0;
const user = role => User.create({ name:'Owner Test', email:`options${++counter}${Date.now()}@test.dev`, password:'Password123!', passwordConfirm:'Password123!', role });
const property = (owner, title, extra={}) => Property.create({ owner, title, description:'Description suffisamment longue pour ce bien de test.', type:'Appartement', pole:'Altimmo', status:'location', price:200000, address:{street:`Rue ${title}`,city:'Brazzaville',arrondissement:'Centre'}, latitude:-4.2, longitude:15.2, images:['https://placehold.co/1200x800/png'], surface:80, availability:'Disponible', statusAdmin:'En attente', isPublished:false, ...extra });
const fiche = (linkedUser, extra={}) => Proprietaire.create({ nom:`Nom${++counter}`, prenom:'Gestion', telephone:`+24206${String(counter).padStart(7,'0')}`, user:linkedUser || null, biensPropres:[], ...extra });

beforeAll(async()=>{ await startFinancialMongo(); await Promise.all([Property.syncIndexes(),RentalManagement.syncIndexes(),Contrat.syncIndexes()]); });
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('classe les Property privés/publiés, les blocages et les biensPropres depuis le seul référentiel Proprietaire',async()=>{
  const linked=await user('Proprietaire'); const gestion=await fiche(linked._id);
  const privateP=await property(linked._id,'Privé');
  const publishedP=await property(linked._id,'Publié',{isPublished:true,statusAdmin:'Validée'});
  const sold=await property(linked._id,'Vendu',{availability:'Vendu'});
  const removed=await property(linked._id,'Retiré',{availability:'Retiré'});
  const archived=await property(linked._id,'Archivé',{assetCycle:'archive'});
  const managed=await property(linked._id,'Géré'); await RentalManagement.create({property:managed._id,owner:linked._id,managementActivated:true});
  const contracted=await property(linked._id,'Contrat'); await Contrat.create({type:'location',bien:contracted._id,proprietaire:gestion._id,statut:'actif'});
  const outsider=await user('Proprietaire'); await property(outsider._id,'Personnel hors gestion');
  const declaredOnly=await fiche(null,{biensPropres:[{typeBien:'location',titre:'Déclaré seul',type:'Appartement',adresse:'Rue D',ville:'Brazzaville',prixLoyer:150000,statut:'Disponible'}]});

  const result=await onboarding.getOptions();
  expect(result.existingEligibleProperties.map(p=>p.title)).toEqual(expect.arrayContaining(['Privé','Publié']));
  expect(result.existingEligibleProperties.map(p=>p.title)).not.toContain('Personnel hors gestion');
  expect(result.declaredOwnerAssets).toEqual(expect.arrayContaining([expect.objectContaining({title:'Déclaré seul',proprietaireId:String(declaredOnly._id),ownerUserId:null,sourceType:'proprietaire_bien_propre'})]));
  expect(Object.fromEntries(result.ineligibleProperties.map(p=>[p.title,p.reason]))).toMatchObject({'Vendu':'vendu','Retiré':'retiré','Archivé':'archivé','Géré':'déjà sous gestion','Contrat':'contrat actif'});
  expect(privateP.isPublished).toBe(false); expect(publishedP.isPublished).toBe(true); expect(sold).toBeTruthy(); expect(removed).toBeTruthy(); expect(archived).toBeTruthy();
});

test('exclut un biensPropres déjà importé et signale un doublon fiable',async()=>{
  const linked=await user('Proprietaire');
  const gestion=await fiche(linked._id,{biensPropres:[
    {typeBien:'location',titre:'Déjà importé',type:'Appartement',adresse:'Rue I',ville:'Brazzaville',prixLoyer:100000},
    {typeBien:'location',titre:'Doublon',type:'Appartement',adresse:'Rue Doublon',ville:'Brazzaville',prixLoyer:100000},
  ]});
  await property(linked._id,'Déjà importé',{sourceOwnerAssetId:`${gestion._id}:${gestion.biensPropres[0]._id}`});
  await property(linked._id,'Doublon',{address:{street:'Rue Doublon',city:'Brazzaville',arrondissement:'Centre'}});
  const result=await onboarding.getOptions();
  expect(result.declaredOwnerAssets.map(p=>p.title)).not.toContain('Déjà importé');
  expect(result.ineligibleProperties).toEqual(expect.arrayContaining([expect.objectContaining({title:'Doublon',reason:'doublon probable'})]));
});
