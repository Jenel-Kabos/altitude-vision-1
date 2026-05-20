import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

// -- Composants de Layout --
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';

// -- Composants de Routing --
import ProtectedRoute from './components/routing/ProtectedRoute';
import AdminRoute from './components/routing/AdminRoute';

// -- Pages Publiques --
import HomePage from './pages/HomePage';
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import AltimmoPage from './pages/Altimmo/AltimmoPage';
import PropertyDetailPage from './pages/Altimmo/PropertyDetailPage';
import MilaEventsPage from './pages/MilaEvents/MilaEventsPage';
import AltcomPage from './pages/Altcom/AltcomPage';
import NotFoundPage from './pages/NotFoundPage';

// -- Pages Protégées --
import DashboardPage from './pages/DashboardPage';
import SubmitPropertyPage from './pages/Altimmo/SubmitPropertyPage';
import EditPropertyPage from './pages/Altimmo/EditPropertyPage';

// -- Pages d'Administration --
import AdminPropertyList from './pages/Admin/AdminPropertyList';
import AdminProjectList from './pages/Admin/AdminProjectList';

/* ─── Bouton WhatsApp flottant ─── */
const WhatsAppButton = () => (
  <a
    href="https://wa.me/+242068002151?text=Bonjour%2C%20je%20souhaite%20en%20savoir%20plus%20sur%20vos%20services."
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Nous contacter sur WhatsApp"
    style={{
      position:        'fixed',
      bottom:          '24px',
      right:           '24px',
      width:           '56px',
      height:          '56px',
      borderRadius:    '50%',
      background:      '#25D366',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      boxShadow:       '0 4px 16px rgba(37,211,102,0.40)',
      zIndex:          9999,
      transition:      'transform 0.2s, box-shadow 0.2s',
      textDecoration:  'none',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform  = 'scale(1.08)';
      e.currentTarget.style.boxShadow  = '0 6px 24px rgba(37,211,102,0.55)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform  = 'scale(1)';
      e.currentTarget.style.boxShadow  = '0 4px 16px rgba(37,211,102,0.40)';
    }}
  >
    {/* Icône WhatsApp SVG officielle */}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="#ffffff"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.116.549 4.103 1.508 5.836L.057 23.213a.75.75 0 00.93.93l5.377-1.451A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.693-.505-5.23-1.387l-.374-.22-3.884 1.049 1.048-3.884-.22-.374A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
    </svg>
  </a>
);

function App() {
  return (
    <HelmetProvider>
      <Router>
        <div className="flex flex-col min-h-screen bg-light">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              {/* --- Routes Publiques --- */}
              <Route path="/"             element={<HomePage />} />
              <Route path="/login"        element={<LoginPage />} />
              <Route path="/register"     element={<RegisterPage />} />
              <Route path="/altimmo"      element={<AltimmoPage />} />
              <Route path="/altimmo/:id"  element={<PropertyDetailPage />} />
              <Route path="/mila-events"  element={<MilaEventsPage />} />
              <Route path="/altcom"       element={<AltcomPage />} />

              {/* --- Routes Protégées (Utilisateurs connectés) --- */}
              <Route
                path="/dashboard"
                element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
              />
              <Route
                path="/soumettre-propriete"
                element={<ProtectedRoute><SubmitPropertyPage /></ProtectedRoute>}
              />
              <Route
                path="/altimmo/:id/edit"
                element={<ProtectedRoute><EditPropertyPage /></ProtectedRoute>}
              />

              {/* --- Routes d'Administration (Admins seulement) --- */}
              <Route
                path="/admin/biens"
                element={<AdminRoute><AdminPropertyList /></AdminRoute>}
              />
              <Route
                path="/admin/projets"
                element={<AdminRoute><AdminProjectList /></AdminRoute>}
              />

              {/* --- 404 --- */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <Footer />

          {/* Bouton WhatsApp flottant — visible sur toutes les pages */}
          <WhatsAppButton />
        </div>
      </Router>
    </HelmetProvider>
  );
}

export default App;