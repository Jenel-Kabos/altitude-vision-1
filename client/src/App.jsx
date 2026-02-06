import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";

// Layouts
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";

// Pages publiques
import HomePage from "./pages/HomePage";
import AltimmoPage from "./pages/AltimmoPage";
import AltimmoAnnonces from "./pages/AltimmoAnnonces";
import PropertyDetailPage from "./pages/PropertyDetailPage";
import CommissionCalculatorPage from "./pages/CommissionCalculatorPage";
import MilaEventsPage from "./pages/MilaEventsPage";
import MilaEventsAnnonces from "./pages/MilaEventsAnnonces";
import EventDetailPage from "./pages/EventDetailPage";
import CreateProjectPage from "./pages/CreateProjectPage";
import AltcomPage from "./pages/AltcomPage";
import AltcomAnnonces from "./pages/AltcomAnnonces";
import AltcomServiceDetailPage from "./pages/AltcomServiceDetailPage";
import AltcomPortfolioDetailPage from "./pages/AltcomPortfolioDetailPage";
import ContactPage from "./pages/ContactPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import NotFoundPage from "./pages/NotFoundPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import MentionsLegales from "./pages/MentionsLegales";

// Page de vérification d'email
import VerifyEmailPage from "./pages/VerifyEmailPage";

// Pages Services Altimmo
import VenteDeBiensPage from "./pages/services/VenteDeBiensPage";
import LocationGestionPage from "./pages/services/LocationGestionPage";
import ConseilInvestissementPage from "./pages/services/ConseilInvestissementPage";

// Pages Services Altcom
import CouvertureMediatiquePage from "./pages/services/CouvertureMediatiquePage";

// Dashboard Admin/Collaborateur
import AdminDashboard from "./pages/dashboard/AdminDashboard";
import DashboardHome from "./pages/dashboard/DashboardHome";
import ManagePropertiesPage from "./pages/dashboard/ManagePropertiesPage";
import AddPropertyPage from "./pages/dashboard/AddPropertyPage";
import ManageEventsPage from "./pages/dashboard/ManageEventsPage";
import ManageQuotesPage from "./pages/dashboard/ManageQuotesPage";
import ModerationPage from "./pages/dashboard/ModerationPage";
// ✅ IMPORT CORRECT (Celui que nous avons corrigé)
import UserManagementPage from "./pages/dashboard/UserManagementPage";
import ActiveSessionsPage from "./pages/dashboard/ActiveSessionsPage"; 

// Page de gestion Altcom
import ManageAltcomPage from "./pages/dashboard/ManageAltcomPage";

// Pages Emails & Messagerie
import ManageEmailsPage from "./pages/dashboard/ManageEmailsPage";
import InternalMessagingPage from "./pages/dashboard/InternalMessagingPage";

// Pages interactives - Likes, Commentaires, Messagerie
import FavoritesPage from './pages/FavoritesPage';
import MessagesPage from './pages/MessagesPage';

// Utilisateur / Propriétaire
import AccountPage from "./pages/AccountPage";
import ProfilePage from "./services/ProfilePage";

// Layout Propriétaire et Composant de gestion
import OwnerDashboard from "./pages/dashboard/OwnerDashboard";
import OwnerPropertyManagement from "./pages/dashboard/OwnerPropertyManagement";

// Routes protégées
import ProtectedRoute from "./components/routing/ProtectedRoute";
import AdminRoute from "./components/routing/AdminRoute";
import OwnerRoute from "./components/routing/OwnerRoute";
import PublicAuthRoute from "./components/routing/PublicAuthRoute";


// ==========================================================
// Layout principal (Header/Footer global)
// ==========================================================
const MainLayout = ({ children }) => {
    const location = useLocation();

    // Exclusion du header/footer uniquement sur les tableaux de bord
    const isDashboard =
        location.pathname.startsWith("/dashboard") ||
        location.pathname.startsWith("/mes-biens");

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            {!isDashboard && <Header />}
            <main className="flex-grow">{children}</main> 
            {!isDashboard && <Footer />}
        </div>
    );
};

// ==========================================================
// Application Principale
// ==========================================================
function App() {
    return (
        <>
            <Toaster position="top-right" />
            <Routes>
                {/* === PAGES PUBLIQUES === */}
                <Route path="/" element={<MainLayout><HomePage /></MainLayout>} />
                
                {/* ALTIMMO */}
                <Route path="/altimmo" element={<MainLayout><AltimmoPage /></MainLayout>} />
                <Route path="/altimmo/annonces" element={<MainLayout><AltimmoAnnonces /></MainLayout>} />
                <Route path="/altimmo/property/:propertyId" element={<MainLayout><PropertyDetailPage /></MainLayout>} />
                <Route path="/trouve-ta-commission" element={<MainLayout><CommissionCalculatorPage /></MainLayout>} />
                
                {/* SERVICES ALTIMMO */}
                <Route path="/altimmo/services/vente-de-biens" element={<MainLayout><VenteDeBiensPage /></MainLayout>} />
                <Route path="/altimmo/services/location-gestion" element={<MainLayout><LocationGestionPage /></MainLayout>} />
                <Route path="/altimmo/services/conseil-en-investissement" element={<MainLayout><ConseilInvestissementPage /></MainLayout>} />
                
                {/* MILA EVENTS */}
                <Route path="/mila-events" element={<MainLayout><MilaEventsPage /></MainLayout>} />
                <Route path="/mila-events/annonces" element={<MainLayout><MilaEventsAnnonces /></MainLayout>} />
                <Route path="/mila-events/event/:eventId" element={<MainLayout><EventDetailPage /></MainLayout>} />
                <Route path="/mila-events/creer-projet" element={<MainLayout><CreateProjectPage /></MainLayout>} />
                
                {/* ALTCOM */}
                <Route path="/altcom" element={<MainLayout><AltcomPage /></MainLayout>} />
                <Route path="/altcom/annonces" element={<MainLayout><AltcomAnnonces /></MainLayout>} />
                <Route path="/altcom/service/:serviceId" element={<MainLayout><AltcomServiceDetailPage /></MainLayout>} />
                <Route path="/altcom/portfolio/:portfolioId" element={<MainLayout><AltcomPortfolioDetailPage /></MainLayout>} />
                
                {/* SERVICES ALTCOM */}
                <Route path="/altcom/couverture-mediatique" element={<MainLayout><CouvertureMediatiquePage /></MainLayout>} />
                
                {/* PAGES LÉGALES & INFORMATIONS */}
                <Route path="/mentions-legales" element={<MainLayout><MentionsLegales /></MainLayout>} />
                
                {/* AUTRES */}
                <Route path="/contact" element={<MainLayout><ContactPage /></MainLayout>} />
                <Route path="/unauthorized" element={<MainLayout><UnauthorizedPage /></MainLayout>} />

                {/* ✅ NOUVELLE ROUTE : VALIDATION EMAIL (Accessible à tous) */}
                <Route path="/verify-email/:token" element={<MainLayout><VerifyEmailPage /></MainLayout>} />

                {/* === ROUTES PUBLIQUES AUTHENTIFICATION === */}
                <Route element={<PublicAuthRoute />}>
                    <Route path="/login" element={<MainLayout><LoginPage /></MainLayout>} />
                    <Route path="/register" element={<MainLayout><RegisterPage /></MainLayout>} />
                </Route>

                {/* === ROUTES PROTÉGÉES (UTILISATEURS CONNECTÉS) === */}
                <Route element={<ProtectedRoute />}>
                    {/* Pages utilisateur accessibles à tous les rôles connectés */}
                    <Route path="/mon-compte" element={<MainLayout><AccountPage /></MainLayout>} />
                    <Route path="/profile" element={<MainLayout><ProfilePage /></MainLayout>} />
                    
                    {/* MESSAGERIE CLIENT/PROPRIÉTAIRE & FAVORIS */}
                    <Route path="/favoris" element={<MainLayout><FavoritesPage /></MainLayout>} />
                    <Route path="/messages" element={<MainLayout><MessagesPage /></MainLayout>} />

                    {/* === TABLEAU DE BORD ADMIN / COLLABORATEUR === */}
                    <Route element={<AdminRoute />}>
                        <Route path="/dashboard" element={<AdminDashboard />}>
                            <Route index element={<DashboardHome />} />
                            <Route path="properties" element={<ManagePropertiesPage />} />
                            <Route path="properties/add" element={<AddPropertyPage />} />
                            <Route path="events" element={<ManageEventsPage />} />
                            <Route path="quotes" element={<ManageQuotesPage />} />
                            <Route path="moderation" element={<ModerationPage />} />
                            
                            {/* C'est ici que la magie opère pour la gestion des utilisateurs */}
                            <Route path="users" element={<UserManagementPage />} />
                            
                            {/* GESTION DES PROJETS ALTCOM */}
                            <Route path="altcom" element={<ManageAltcomPage />} />
                            
                            {/* SESSIONS ACTIVES */}
                            <Route path="active-sessions" element={<ActiveSessionsPage />} />

                            {/* GESTION DES COMMUNICATIONS ADMIN */}
                            <Route path="emails" element={<ManageEmailsPage />} />
                            <Route path="messages" element={<InternalMessagingPage />} />
                        </Route>
                    </Route>

                    {/* === TABLEAU DE BORD PROPRIÉTAIRE === */}
                    <Route element={<OwnerRoute />}> 
                        <Route path="/mes-biens" element={<OwnerDashboard />}>
                            <Route index element={<OwnerPropertyManagement />} />
                            <Route path="securite" element={<h1 className="text-3xl font-bold p-6">Sécurité du Compte (Propriétaire)</h1>} />
                        </Route>
                    </Route>
                </Route>

                {/* === 404 === */}
                <Route path="*" element={<MainLayout><NotFoundPage /></MainLayout>} />
            </Routes>
        </>
    );
}

export default App;