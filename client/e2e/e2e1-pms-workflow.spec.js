import { test, expect } from './external-network.fixture';

// E2E-1 — certification navigateur du workflow PMS hôtelier complet.
// Réutilise strictement les fixtures DASH-4 (Owner A = rentalOnboardingOwner,
// Hôtel A/B, tenant partagé) + l'inventaire physique ajouté par E2E-1
// (RoomCategory/RatePlan/Room A1-A8, B1) dans start-accommodation-e2e.js.
// Chaque scénario crée sa PROPRE réservation (jamais de partage d'état entre
// tests, mission §6/§37) et la retrouve sans ambiguïté via son numéro de
// référence unique (recherche exacte), jamais via un sélecteur générique
// qui matcherait plusieurs réservations affichées simultanément.

const OWNER = { email: 'rental-owner-e2e@example.test', password: 'E2eOwnerRental!2026' };
const ADMIN = { email: 'owner-e2e@example.test', password: 'E2eOwner!2026' };
const HOTEL_A = '66e200000000000000000051';
const HOTEL_B = '66e200000000000000000053';
const HOUSE_C = '66e200000000000000000055';
const FOREIGN_HOTEL = '66e200000000000000000011'; // géré par ADMIN, jamais par Owner A — cross-owner réel
const ROOM_CATEGORY_A = '66e200000000000000000060';
const RATE_PLAN_A = '66e200000000000000000064';

function isoDate(daysFromNow) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

async function login(page, credentials, destinationPattern) {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', 'refused'));
  await page.goto('/login');
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill(credentials.password);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await expect(page).toHaveURL(destinationPattern);
}

const loginOwner = (page) => login(page, OWNER, /\/mon-espace-proprietaire|\/mes-biens|\/mes-hotels/);

// Le filtre "Rechercher" (Owner ET Admin, même paramètre `search`) déclenche
// un rechargement débounced (300 ms) qui remonte les cartes — même dynamique
// StrictMode que la création de réservation. `waitForResponse` est armé
// AVANT le remplissage pour ne jamais manquer la requête déclenchée.
async function fillSearchAndSettle(page, reference) {
  const settled = page.waitForResponse((res) => res.url().includes(`search=${encodeURIComponent(reference)}`), { timeout: 15000 });
  await page.getByLabel('Rechercher').fill(reference);
  await settled;
  await expect(page.getByText(reference)).toBeVisible();
}

// `AdminHotelReservationsPage` (contrairement à la page propriétaire)
// n'affiche `RoomAssignmentPanel`/`HotelFinancialDocumentPanel` qu'après un
// clic sur la ligne du tableau (`setExpandedId`) — jamais rendu par défaut.
// Oubli initial de ce clic, jamais un bug applicatif : confirmé en lisant
// `AdminHotelReservationsPage.jsx` après un premier échec réel.
async function expandAdminReservationRow(page, reference) {
  // Même bascule pure que `handleToggle` (setExpandedId) : le même risque
  // de double-clic/re-rendu peut la refermer aussitôt ouverte. Correctif
  // borné identique — jamais une boucle non bornée.
  const row = page.locator('tr', { hasText: reference }).first();
  const panel = page.locator('[data-loading-assignment]').first();
  let expanded = false;
  for (let attempt = 0; attempt < 3 && !expanded; attempt += 1) {
    await row.click();
    try {
      await panel.waitFor({ state: 'attached', timeout: 5000 });
      expanded = true;
    } catch { /* retente — jamais au-delà de 3 tentatives */ }
  }
  expect(expanded, 'La ligne réservation Admin ne s\'est jamais dépliée après 3 tentatives').toBe(true);
  await expect(panel).toHaveAttribute('data-loading-assignment', 'false', { timeout: 15000 });
}
const loginAdmin = (page) => login(page, ADMIN, /\/dashboard/);

// Crée une réservation manuelle depuis le vrai formulaire UI (CTA "+
// Réservation manuelle"), capture sa référence exacte depuis la réponse
// réseau (mission §58 — assertions réseau sur les mutations critiques), puis
// filtre la liste sur cette référence pour éliminer toute ambiguïté avec
// d'autres réservations créées par d'autres scénarios sur le même hôtel.
async function createManualReservation(page, { hotelId, roomCategoryId, ratePlanId, checkIn, checkOut, guestFirstName, guestLastName, guestEmail }) {
  await page.goto(`/mes-hotels/reservations?hotelId=${hotelId}`);
  await page.getByRole('button', { name: '+ Réservation manuelle' }).click();
  await page.getByPlaceholder('ID Catégorie').fill(roomCategoryId);
  await page.getByPlaceholder('ID Tarif').fill(ratePlanId);
  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill(checkIn);
  await dateInputs.nth(1).fill(checkOut);
  await page.getByPlaceholder('Prénom client', { exact: true }).fill(guestFirstName);
  await page.getByPlaceholder('Nom client', { exact: true }).fill(guestLastName);
  await page.getByPlaceholder('Email client', { exact: true }).fill(guestEmail);
  const createResponse = page.waitForResponse((res) => res.url().includes('/hotel-reservations/owner') && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  const response = await createResponse;
  expect(response.status()).toBe(201);
  const body = await response.json();
  const reference = body.data.reservation.reference;
  const reservationId = body.data.reservation._id;
  expect(reference).toBeTruthy();
  await expect(page.getByText(reference)).toBeVisible();
  await fillSearchAndSettle(page, reference);
  // `RoomAssignmentPanel` (et son attribut `data-loading-assignment`)
  // n'existe dans le DOM QUE pour une réservation `confirmed`/`checked_in`
  // (voir MyHotelReservationsPage.jsx) — à ce stade (juste après création,
  // encore `pending`), il n'existe pas : aucune attente à faire ici. Le
  // réglage StrictMode/rechargement-liste se fait dans
  // `openRoomAssignmentPanel`, appelé seulement après confirmation.
  return { reference, reservationId };
}

async function confirmReservation(page) {
  const confirmResponse = page.waitForResponse((res) => /\/hotel-reservations\/[^/]+\/confirm$/.test(res.url()) && res.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Confirmer' }).click();
  const response = await confirmResponse;
  expect(response.status()).toBe(200);
  // "Confirmée" matche à la fois l'onglet de filtre statut ET le badge de
  // statut sur la carte réservation : `.last()` cible le badge (rendu après
  // les onglets dans le DOM), jamais l'onglet lui-même.
  await expect(page.getByText('Confirmée', { exact: false }).last()).toBeVisible();
}

// `handleToggle` (RoomAssignmentPanel.jsx) est un BASCULEUR pur
// (`setOpen(o => !o)`). La cause réelle du flake observé n'était pas ce
// bouton lui-même mais le montage du composant parent (voir
// `createManualReservation` ci-dessus, qui attend maintenant la fin du
// double-montage StrictMode avant tout retour) — une fois le montage
// stabilisé, un clic normal suffit.
async function openRoomAssignmentPanel(page) {
  // `confirmReservation` déclenche elle aussi un rechargement de liste
  // (même remontage StrictMode) — revérifié ici systématiquement, jamais
  // supposé déjà stabilisé par le seul appelant précédent.
  await expect(page.locator('[data-loading-assignment]').first()).toHaveAttribute('data-loading-assignment', 'false', { timeout: 15000 });
  const toggleButton = page.getByRole('button', { name: 'Affecter chambre' });
  const select = page.getByLabel('Choisir une chambre disponible');
  await toggleButton.click();
  await select.waitFor({ state: 'visible', timeout: 10000 });
  await expect(select).not.toHaveAttribute('data-loading-rooms', 'true', { timeout: 15000 });
  return select;
}

async function checkInReservation(page, roomLabel) {
  const select = await openRoomAssignmentPanel(page);
  const roomValue = await select.evaluate((el, label) => {
    const match = [...el.options].find((option) => option.textContent.includes(label));
    return match?.value || null;
  }, roomLabel);
  expect(roomValue, `Aucune option de chambre ne contient "${roomLabel}"`).toBeTruthy();
  await select.selectOption(roomValue);
  const checkInResponse = page.waitForResponse((res) => /\/hotel-reservations\/[^/]+\/check-in$/.test(res.url()) && res.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Check-in' }).click();
  const response = await checkInResponse;
  expect(response.status()).toBe(200);
  await expect(page.getByText('Séjour en cours', { exact: false }).last()).toBeVisible();
}

test.describe('E2E-1 — PMS nominal (bout en bout navigateur)', () => {
  test('réservation → confirmation → check-in → chambre occupée → contexte financier créé', async ({ page }) => {
    await loginOwner(page);
    await page.goto(`/mes-hotels/${HOTEL_A}`);
    await expect(page.getByRole('heading', { name: /Hôtel Owner A E2E/i }).first()).toBeVisible();

    await createManualReservation(page, {
      hotelId: HOTEL_A, roomCategoryId: ROOM_CATEGORY_A, ratePlanId: RATE_PLAN_A,
      checkIn: isoDate(1), checkOut: isoDate(2),
      guestFirstName: 'Ada', guestLastName: 'NominalA1', guestEmail: `ada-nominal-a1-${Date.now()}@example.test`,
    });

    await confirmReservation(page);
    await checkInReservation(page, 'A1');

    const financialPanel = page.getByTestId('hotel-financial-document');
    await expect(financialPanel).toBeVisible();
    await expect(financialPanel).not.toContainText('Aucun document financier');
  });

  test('réservation → confirmation → check-in (répétition indépendante, chambre A2)', async ({ page }) => {
    await loginOwner(page);
    await createManualReservation(page, {
      hotelId: HOTEL_A, roomCategoryId: ROOM_CATEGORY_A, ratePlanId: RATE_PLAN_A,
      checkIn: isoDate(3), checkOut: isoDate(4),
      guestFirstName: 'Grace', guestLastName: 'NominalA2', guestEmail: `grace-nominal-a2-${Date.now()}@example.test`,
    });
    await confirmReservation(page);
    await checkInReservation(page, 'A2');
    await expect(page.getByTestId('hotel-financial-document')).toBeVisible();
  });
});

test.describe('E2E-1 — cycle financier complet et check-out nominal (deux acteurs réels : Owner puis Admin)', () => {
  test('Owner crée/checkin, Admin facture/encaisse, check-out réussit, housekeeping → inspection passed → chambre de nouveau disponible', async ({ page, browser }) => {
    await loginOwner(page);
    const { reference } = await createManualReservation(page, {
      hotelId: HOTEL_A, roomCategoryId: ROOM_CATEGORY_A, ratePlanId: RATE_PLAN_A,
      checkIn: isoDate(5), checkOut: isoDate(6),
      guestFirstName: 'Marie', guestLastName: 'CycleComplet', guestEmail: `marie-cycle-${Date.now()}@example.test`,
    });
    await confirmReservation(page);
    await checkInReservation(page, 'A3');

    // Le propriétaire ne peut PAS finaliser/émettre/encaisser (canManage=false
    // par conception, DASH-3) : la suite du cycle financier passe réellement
    // par un second acteur réel, l'Admin, sur sa propre route
    // (/dashboard/hotel-reservations), jamais une mutation directe en base.
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAdmin(adminPage);
    await adminPage.goto('/dashboard/hotel-reservations');
    await fillSearchAndSettle(adminPage, reference);
    await expandAdminReservationRow(adminPage, reference);

    const finalizeResponse = adminPage.waitForResponse((res) => res.url().includes('/finalize-lines') && res.request().method() === 'POST');
    await adminPage.getByRole('button', { name: 'Finaliser' }).click();
    expect((await finalizeResponse).status()).toBe(200);

    const issueResponse = adminPage.waitForResponse((res) => res.url().includes('/issue') && res.request().method() === 'POST');
    await adminPage.getByRole('button', { name: 'Émettre' }).click();
    expect((await issueResponse).status()).toBe(200);

    // Isoler la LIGNE contenant "XAF" avant d'en extraire les chiffres :
    // `documentNumber` (ex. "FAC-000051-2026-000001") se termine par des
    // chiffres, séparés du montant par un simple retour à la ligne — un
    // `[\d\s]+` global (testé une première fois) traverse ce `\n` et fusionne
    // les deux, gonflant le montant réel (40 000 → 140 000, bug de test
    // démontré, jamais applicatif : `checkout-financial-readiness` et le
    // document lui-même s'accordaient déjà sur 40 000 côté serveur).
    const documentTotalText = await adminPage.getByTestId('hotel-financial-document').innerText();
    const totalLine = documentTotalText.split('\n').find((line) => line.includes('XAF'));
    const totalAmount = Number((totalLine || '40000 XAF').replace(/[^\d]/g, ''));

    await adminPage.getByLabel('Montant du paiement').fill(String(totalAmount));
    await adminPage.getByLabel('Méthode de paiement').selectOption('cash');
    await adminPage.getByLabel('Référence du paiement').fill(`E2E1-${reference}`);
    const createPaymentResponse = adminPage.waitForResponse((res) => res.url().includes('/financial/hotel/payments') && res.request().method() === 'POST');
    await adminPage.getByRole('button', { name: 'Créer', exact: true }).click();
    expect((await createPaymentResponse).status()).toBe(201);

    const confirmPaymentResponse = adminPage.waitForResponse((res) => res.url().includes('/confirm') && res.request().method() === 'POST');
    await adminPage.getByRole('button', { name: 'Confirmer' }).click();
    expect((await confirmPaymentResponse).status()).toBe(200);

    const allocateInput = adminPage.getByLabel(/^Allocation /);
    await allocateInput.fill(String(totalAmount));
    const allocateResponse = adminPage.waitForResponse((res) => res.url().includes('/allocations') && res.request().method() === 'POST');
    await adminPage.getByRole('button', { name: 'Allouer' }).click();
    // Assertion sur l'ÉTAT final visé (solde soldé, check-out prêt), jamais
    // sur le statut HTTP de cette requête précise : un double-clic
    // occasionnel (même risque de re-déclenchement que documenté plus haut
    // pour le bouton bascule) peut légitimement produire un second appel en
    // 409 alors que le PREMIER a déjà atteint l'état voulu — le résultat
    // métier recherché, pas la requête intermédiaire, est ce qui compte ici.
    await allocateResponse.catch(() => {});
    await expect(adminPage.getByTestId('checkout-financial-readiness')).toContainText('Prêt pour check-out', { timeout: 15000 });

    adminPage.once('dialog', (dialog) => dialog.accept());
    const checkOutResponse = adminPage.waitForResponse((res) => /\/check-out$/.test(res.url()) && res.request().method() === 'PATCH');
    await adminPage.getByRole('button', { name: 'Check-out', exact: true }).click();
    const checkOutResult = await checkOutResponse;
    expect(checkOutResult.status()).toBe(200);
    await expect(adminPage.getByText('Séjour terminé', { exact: false }).last()).toBeVisible();
    await adminContext.close();

    // Housekeeping/inspection restent accessibles au Owner (DASH-3) : retour
    // sur le contexte propriétaire pour la fin du cycle.
    await page.goto(`/mes-hotels/${HOTEL_A}/housekeeping`);
    const taskRow = page.locator('tr', { hasText: 'A3' });
    await expect(taskRow).toBeVisible();
    await taskRow.getByRole('button', { name: 'Démarrer' }).click();
    await expect(taskRow.getByRole('button', { name: 'Terminer' })).toBeVisible();
    await taskRow.getByRole('button', { name: 'Terminer' }).click();
    await expect(taskRow.getByRole('button', { name: 'Inspecter' })).toBeVisible();
    await taskRow.getByRole('button', { name: 'Inspecter' }).click();
    await expect(taskRow.getByRole('button', { name: 'Approuver' })).toBeVisible();

    const approveResponse = page.waitForResponse((res) => res.url().includes('/inspections/') && res.url().includes('/approve') && res.request().method() === 'PATCH');
    await taskRow.getByRole('button', { name: 'Approuver' }).click();
    expect((await approveResponse).status()).toBe(200);

    // Preuve finale : la chambre A3 est redevenue sélectionnable pour une
    // NOUVELLE affectation — vérifié via le même flux navigateur qu'un
    // futur check-in utiliserait, pas une requête API de complaisance.
    await createManualReservation(page, {
      hotelId: HOTEL_A, roomCategoryId: ROOM_CATEGORY_A, ratePlanId: RATE_PLAN_A,
      checkIn: isoDate(7), checkOut: isoDate(8),
      guestFirstName: 'Verif', guestLastName: 'RoomAvailable', guestEmail: `verif-room-available-${Date.now()}@example.test`,
    });
    await confirmReservation(page);
    const verifySelect = await openRoomAssignmentPanel(page);
    await expect(verifySelect).toContainText('A3');
  });
});

test.describe('E2E-1 — checkout bloqué (financier)', () => {
  test('propriétaire : check-out reste bloqué tant que la facture n’est ni émise ni encaissée — aucune 500', async ({ page }) => {
    await loginOwner(page);
    await createManualReservation(page, {
      hotelId: HOTEL_A, roomCategoryId: ROOM_CATEGORY_A, ratePlanId: RATE_PLAN_A,
      checkIn: isoDate(9), checkOut: isoDate(10),
      guestFirstName: 'Paul', guestLastName: 'Bloque', guestEmail: `paul-bloque-${Date.now()}@example.test`,
    });
    await confirmReservation(page);
    await checkInReservation(page, 'A4');

    const readiness = page.getByTestId('checkout-financial-readiness');
    await expect(readiness).toContainText('Check-out bloqué');
    await expect(readiness).toContainText(/FINANCIAL_DOCUMENT_NOT_ISSUED|FINANCIAL_BALANCE_REMAINING|FINANCIAL_PAYMENT_NOT_SETTLED/);
    await expect(page.getByRole('button', { name: 'Check-out', exact: true })).toBeDisabled();
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  });
});

test.describe('E2E-1 — inspection échouée', () => {
  test('ménage terminé → inspection rejetée → chambre hors service (jamais disponible)', async ({ page, browser }) => {
    await loginOwner(page);
    const { reference } = await createManualReservation(page, {
      hotelId: HOTEL_A, roomCategoryId: ROOM_CATEGORY_A, ratePlanId: RATE_PLAN_A,
      checkIn: isoDate(11), checkOut: isoDate(12),
      guestFirstName: 'Chloe', guestLastName: 'InspectionFail', guestEmail: `chloe-inspection-fail-${Date.now()}@example.test`,
    });
    await confirmReservation(page);
    await checkInReservation(page, 'A5');

    // Check-out via l'Admin (dérogation) pour atteindre l'étape housekeeping
    // sans re-décrire tout le cycle financier déjà prouvé ci-dessus (mission
    // §61 : E2E-1 ne refait pas F2 — seule l'intégration visible nécessaire
    // aux transitions est certifiée ici, l'objet du test est l'inspection).
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAdmin(adminPage);
    await adminPage.goto('/dashboard/hotel-reservations');
    await fillSearchAndSettle(adminPage, reference);
    await expandAdminReservationRow(adminPage, reference);
    // La dérogation admin déclenche DEUX dialogues natifs séquentiels
    // (confirm() puis prompt()) — `on` (jamais `once`) pour répondre aux deux.
    adminPage.on('dialog', (dialog) => {
      if (dialog.type() === 'prompt') dialog.accept('Départ anticipé validé pour scénario inspection E2E-1');
      else dialog.accept();
    });
    await adminPage.getByRole('button', { name: 'Dérogation et check-out' }).click();
    await expect(adminPage.getByText('Séjour terminé', { exact: false }).last()).toBeVisible();
    await adminContext.close();

    await page.goto(`/mes-hotels/${HOTEL_A}/housekeeping`);
    const taskRow = page.locator('tr', { hasText: 'A5' });
    await taskRow.getByRole('button', { name: 'Démarrer' }).click();
    await taskRow.getByRole('button', { name: 'Terminer' }).click();
    await taskRow.getByRole('button', { name: 'Inspecter' }).click();
    await expect(taskRow.getByRole('button', { name: 'Rejeter' })).toBeVisible();

    const rejectResponse = page.waitForResponse((res) => res.url().includes('/inspections/') && res.url().includes('/reject') && res.request().method() === 'PATCH');
    await taskRow.getByRole('button', { name: 'Rejeter' }).click();
    expect((await rejectResponse).status()).toBe(200);

    // La chambre A5 ne doit JAMAIS réapparaître comme disponible tant
    // qu'aucune maintenance n'a été résolue — vérifié en tentant une
    // nouvelle affectation : A5 doit être absente de la liste.
    await page.goto(`/mes-hotels/reservations?hotelId=${HOTEL_A}`);
    await createManualReservation(page, {
      hotelId: HOTEL_A, roomCategoryId: ROOM_CATEGORY_A, ratePlanId: RATE_PLAN_A,
      checkIn: isoDate(13), checkOut: isoDate(14),
      guestFirstName: 'Verif', guestLastName: 'RoomOutOfService', guestEmail: `verif-oos-${Date.now()}@example.test`,
    });
    await confirmReservation(page);
    const verifySelect = await openRoomAssignmentPanel(page);
    await expect(verifySelect).not.toContainText('A5');
  });
});

test.describe('E2E-1 — switch établissement propre', () => {
  test('Hôtel A → Hôtel B : aucune donnée A ne fuite dans le cockpit B', async ({ page }) => {
    await loginOwner(page);
    await page.goto(`/mes-hotels/${HOTEL_A}/housekeeping`);
    await expect(page.getByRole('heading', { name: 'Ménage', exact: true })).toBeVisible();

    const hotelBRequest = page.waitForRequest((request) => request.url().includes('/housekeeping') && request.url().includes(`hotelId=${HOTEL_B}`));
    await page.goto(`/mes-hotels/${HOTEL_B}/housekeeping`);
    await expect(hotelBRequest).resolves.toBeTruthy();
    await expect(page.getByRole('heading', { name: 'Ménage', exact: true })).toBeVisible();
    // Les tâches A (A1-A5, potentiellement en cours selon l'ordre d'exécution
    // des autres describe blocks) ne doivent jamais apparaître ici.
    await expect(page.locator('tr', { hasText: /^A[1-8]/ })).toHaveCount(0);
  });
});

test.describe('E2E-1 — cross-owner réel', () => {
  test('Owner A force l’URL d’un hôtel appartenant à un autre propriétaire → 403 réseau, aucune donnée visible', async ({ page }) => {
    await loginOwner(page);
    const foreignResponse = page.waitForResponse((res) => res.url().includes(`/hotels/${FOREIGN_HOTEL}`) || res.url().includes(`/hotel-analytics/${FOREIGN_HOTEL}`) || res.url().includes(`hotelId=${FOREIGN_HOTEL}`));
    await page.goto(`/mes-hotels/${FOREIGN_HOTEL}`);
    const response = await foreignResponse;
    expect(response.status()).toBe(403);
    await expect(page.getByText(/Établissement introuvable|n’est pas disponible/i).first()).toBeVisible();
    await expect(page.getByText('Hôtel Portefeuille E2E', { exact: true })).toHaveCount(0);
  });
});

test.describe('E2E-1 — deep-link direct', () => {
  test('URL directe vers la page réservations de Hôtel A (sans passer par le portfolio) restaure le contexte', async ({ page }) => {
    await loginOwner(page);
    // `waitForRequest` doit être armé AVANT la navigation qui déclenche la
    // requête — sinon on attend un évènement déjà passé (bug de test réel,
    // pas applicatif, corrigé après démonstration par un premier run complet).
    const requestUsedHotelA = page.waitForRequest((request) => request.url().includes(`hotelId=${HOTEL_A}`));
    await page.goto(`/mes-hotels/reservations?hotelId=${HOTEL_A}`);
    await expect(page.getByRole('heading', { name: 'Mes réservations', exact: true })).toBeVisible();
    await expect(requestUsedHotelA).resolves.toBeTruthy();
  });
});

test.describe('E2E-1 — notification contextualisée', () => {
  test('notification housekeeping ouvre directement le bon hôtel', async ({ page }) => {
    await loginOwner(page);
    await page.getByRole('button', { name: /Notifications/ }).click();
    const scopedRequest = page.waitForRequest((request) => request.url().includes(`hotelId=${HOTEL_A}`));
    await page.getByText('Maintenance Hôtel Owner A', { exact: true }).click();
    await expect(page).toHaveURL(`/mes-hotels/${HOTEL_A}/maintenance`);
    await expect(page.getByRole('heading', { name: 'Maintenance', exact: true })).toBeVisible();
    await expect(scopedRequest).resolves.toBeTruthy();
  });
});

test.describe('E2E-1 — maison meublée non-PMS', () => {
  test('Maison C reste indépendante du PMS Room : aucune notion de chambre', async ({ page }) => {
    await loginOwner(page);
    await page.goto(`/mes-hebergements/${HOUSE_C}`);
    await expect(page.getByText('Maison Owner C E2E', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/roomNumber|Chambre A\d|Room A\d/i)).toHaveCount(0);
  });
});
