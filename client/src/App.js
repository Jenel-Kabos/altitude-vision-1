import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

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

// -- Pages Protégées --
import DashboardPage from './pages/DashboardPage';
import SubmitPropertyPage from './pages/Altimmo/SubmitPropertyPage';
import EditPropertyPage from './pages/Altimmo/EditPropertyPage';

// -- Pages d'Administration --
import AdminPropertyList from './pages/Admin/AdminPropertyList';
import AdminProjectList from './pages/Admin/AdminProjectList';
// import AdminServiceList from './pages/Admin/AdminServiceList'; // À créer
// import AdminProjectCreatePage from './pages/Admin/AdminProjectCreatePage'; // À créer
// import AdminProjectEditPage from './pages/Admin/AdminProjectEditPage'; // À créer


function App() {
  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-light">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            {/* --- Routes Publiques --- */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/altimmo" element={<AltimmoPage />} />
            <Route path="/altimmo/:id" element={<PropertyDetailPage />} />
            <Route path="/mila-events" element={<MilaEventsPage />} />
            <Route path="/altcom" element={<AltcomPage />} />

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
            {/* Exemples de futures routes admin :
              <Route path="/admin/services" element={<AdminRoute><AdminServiceList /></AdminRoute>} />
              <Route path="/admin/projets/creer" element={<AdminRoute><AdminProjectCreatePage /></AdminRoute>} />
              <Route path="/admin/projets/:id/edit" element={<AdminRoute><AdminProjectEditPage /></AdminRoute>} />
            */}

          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;