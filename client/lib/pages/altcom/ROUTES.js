// À ajouter dans votre fichier de routes (ex: src/App.jsx ou src/router.jsx)
// ─────────────────────────────────────────────────────────────────────────────
// Remplacez l'ancienne route /altcom et /altcom/service/:id par ceci :

import AltcomPage        from './pages/altcom/AltcomPage';
import AltcomServicePage from './pages/altcom/AltcomServicePage';

// Dans votre <Routes> :
//
//   <Route path="/altcom"             element={<AltcomPage />} />
//   <Route path="/altcom/:serviceSlug" element={<AltcomServicePage />} />
//
// Les URLs générées automatiquement par altcomData.js :
//   /altcom/communication-digitale
//   /altcom/branding-design
//   /altcom/conseil-strategie
//   /altcom/couverture-mediatique
//
// ⚠️  Si vous avez d'autres routes sous /altcom (ex: /altcom/annonces),
//     déclarez-les AVANT la route dynamique :
//
//   <Route path="/altcom"              element={<AltcomPage />} />
//   <Route path="/altcom/annonces"     element={<AltcomAnnoncesPage />} />  {/* avant */}
//   <Route path="/altcom/:serviceSlug" element={<AltcomServicePage />} />   {/* après */}