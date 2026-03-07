import React, { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";

// Layouts
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";

// SEO + ChatWidget
import ChatWidget from "./components/ChatWidget";

// Pages publiques
import HomePage                  from "./pages/HomePage";
import AltimmoPage               from "./pages/AltimmoPage";
import AltimmoAnnonces           from "./pages/AltimmoAnnonces";
import PropertyDetailPage        from "./pages/PropertyDetailPage";
import CommissionCalculatorPage  from "./pages/CommissionCalculatorPage";
import MilaEventsPage            from "./pages/MilaEventsPage";
import MilaEventsAnnonces        from "./pages/MilaEventsAnnonces";
import EventDetailPage           from "./pages/EventDetailPage";
import CreateProjectPage         from "./pages/CreateProjectPage";
import AltcomPage                from "./pages/AltcomPage";
import AltcomAnnonces            from "./pages/AltcomAnnonces";
import AltcomServiceDetailPage   from "./pages/AltcomServiceDetailPage";
import AltcomPortfolioDetailPage from "./pages/AltcomPortfolioDetailPage";
import ContactPage               from "./pages/ContactPage";
import LoginPage                 from "./pages/LoginPage";
import RegisterPage              from "./pages/RegisterPage";
import NotFoundPage              from "./pages/NotFoundPage";
import UnauthorizedPage          from "./pages/UnauthorizedPage";
import MentionsLegales           from "./pages/MentionsLegales";
import ActualitesPage            from "./pages/ActualitesPage";
import VerifyEmailPendingPage    from "./pages/VerifyEmailPendingPage";
import VerifyEmailPage           from "./pages/VerifyEmailPage";
import LeaveReviewPage           from "./pages/LeaveReviewPage";

// Pages Services Altimmo
import VenteDeBiensPage          from "./pages/services/VenteDeBiensPage";
import LocationGestionPage       from "./pages/services/LocationGestionPage";
import ConseilInvestissementPage from "./pages/services/ConseilInvestissementPage";

// Pages Services Altcom
import CouvertureMediatiquePage  from "./pages/services/CouvertureMediatiquePage";

// Dashboard Admin/Collaborateur
import AdminDashboard          from "./pages/dashboard/AdminDashboard";
import DashboardHome           from "./pages/dashboard/DashboardHome";
import ManagePropertiesPage    from "./pages/dashboard/ManagePropertiesPage";
import AddPropertyPage         from "./pages/dashboard/AddPropertyPage";
import ManageEventsPage        from "./pages/dashboard/ManageEventsPage";
import ManageQuotesPage        from "./pages/dashboard/ManageQuotesPage";
import PropertyModerationPage  from "./pages/dashboard/PropertyModerationPage";
import ReviewModerationPage    from "./pages/dashboard/ReviewModerationPage";
import UsersPanel              from "./pages/dashboard/UsersPanel";
import ActiveSessionsPage      from "./pages/dashboard/ActiveSessionsPage";
import ManageAltcomPage        from "./pages/dashboard/ManageAltcomPage";
import ManageEmailsPage        from "./pages/dashboard/ManageEmailsPage";
import InternalMessagingPage   from "./pages/dashboard/InternalMessagingPage";

// Pages interactives
import FavoritesPage from "./pages/FavoritesPage";
import MessagesPage  from "./pages/MessagesPage";

// Utilisateur / Propriétaire
import AccountPage from "./pages/AccountPage";
import ProfilePage from "./pages/ProfilePage";

// Layout Propriétaire
import OwnerDashboard          from "./pages/dashboard/OwnerDashboard";
import OwnerPropertyManagement from "./pages/dashboard/OwnerPropertyManagement";

// Routes protégées
import ProtectedRoute  from "./components/routing/ProtectedRoute";
import AdminRoute      from "./components/routing/AdminRoute";
import OwnerRoute      from "./components/routing/OwnerRoute";
import PublicAuthRoute from "./components/routing/PublicAuthRoute";

// ─── Résolution du titre de page pour le ChatWidget ──────────
const resolvePageTitle = (pathname) => {
    if (pathname.startsWith("/altimmo"))     return "Altimmo";
    if (pathname.startsWith("/mila-events")) return "Mila Events";
    if (pathname.startsWith("/altcom"))      return "Altcom";
    if (pathname.startsWith("/contact"))     return "Contact";
    if (pathname.startsWith("/actualites"))  return "Actualités";
    return "";
};

// ─── Layout principal (Header / Footer / ChatWidget) ─────────
const MainLayout = ({ children }) => {
    const location    = useLocation();
    const isDashboard =
        location.pathname.startsWith("/dashboard") ||
        location.pathname.startsWith("/mes-biens");

    const pageTitle = resolvePageTitle(location.pathname);

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            {!isDashboard && <Header />}
            <main className="flex-grow">{children}</main>
            {!isDashboard && <Footer />}
            {!isDashboard && <ChatWidget currentPageTitle={pageTitle} />}
        </div>
    );
};

// ─── Application Principale ───────────────────────────────────
function App() {
    useEffect(() => {
        fetch("https://altitude-vision.onrender.com/api/health").catch(() => {});
    }, []);

    return (
        <>
            <Toaster position="top-right" />
            <Routes>

                {/* ══ PAGES PUBLIQUES ══════════════════════════════════════ */}
                <Route path="/" element={<MainLayout><HomePage /></MainLayout>} />

                {/* ACTUALITÉS */}
                <Route path="/actualites" element={<MainLayout><ActualitesPage /></MainLayout>} />

                {/* ALTIMMO */}
                <Route path="/altimmo"                                element={<MainLayout><AltimmoPage /></MainLayout>} />
                <Route path="/altimmo/annonces"                       element={<MainLayout><AltimmoAnnonces /></MainLayout>} />
                <Route path="/altimmo/property/:propertyId"           element={<MainLayout><PropertyDetailPage /></MainLayout>} />
                <Route path="/trouve-ta-commission"                    element={<MainLayout><CommissionCalculatorPage /></MainLayout>} />

                {/* SERVICES ALTIMMO */}
                <Route path="/altimmo/services/vente-de-biens"         element={<MainLayout><VenteDeBiensPage /></MainLayout>} />
                <Route path="/altimmo/services/location-gestion"       element={<MainLayout><LocationGestionPage /></MainLayout>} />
                <Route path="/altimmo/services/conseil-investissement"  element={<MainLayout><ConseilInvestissementPage /></MainLayout>} />

                {/* MILA EVENTS */}
                <Route path="/mila-events"                            element={<MainLayout><MilaEventsPage /></MainLayout>} />
                <Route path="/mila-events/annonces"                   element={<MainLayout><MilaEventsAnnonces /></MainLayout>} />
                <Route path="/mila-events/event/:eventId"             element={<MainLayout><EventDetailPage /></MainLayout>} />
                <Route path="/mila-events/creer-projet"               element={<MainLayout><CreateProjectPage /></MainLayout>} />

                {/* ALTCOM */}
                <Route path="/altcom"                                 element={<MainLayout><AltcomPage /></MainLayout>} />
                <Route path="/altcom/annonces"                        element={<MainLayout><AltcomAnnonces /></MainLayout>} />
                <Route path="/altcom/service/:serviceId"              element={<MainLayout><AltcomServiceDetailPage /></MainLayout>} />
                <Route path="/altcom/portfolio/:portfolioId"          element={<MainLayout><AltcomPortfolioDetailPage /></MainLayout>} />

                {/* SERVICES ALTCOM */}
                <Route path="/altcom/couverture-mediatique"           element={<MainLayout><CouvertureMediatiquePage /></MainLayout>} />

                {/* LÉGAL & AUTRES */}
                <Route path="/mentions-legales"                       element={<MainLayout><MentionsLegales /></MainLayout>} />
                <Route path="/contact"                                element={<MainLayout><ContactPage /></MainLayout>} />
                <Route path="/unauthorized"                           element={<MainLayout><UnauthorizedPage /></MainLayout>} />
                <Route path="/verify-email/:token"                    element={<MainLayout><VerifyEmailPage /></MainLayout>} />

                {/* ══ AUTH PUBLIQUE ════════════════════════════════════════ */}
                <Route element={<PublicAuthRoute />}>
                    <Route path="/login"                element={<MainLayout><LoginPage /></MainLayout>} />
                    <Route path="/register"             element={<MainLayout><RegisterPage /></MainLayout>} />
                    <Route path="/verify-email-pending" element={<VerifyEmailPendingPage />} />
                </Route>

                {/* ══ ROUTES PROTÉGÉES ═════════════════════════════════════ */}
                <Route element={<ProtectedRoute />}>
                    <Route path="/mon-compte"   element={<MainLayout><AccountPage /></MainLayout>} />
                    <Route path="/profile"      element={<MainLayout><ProfilePage /></MainLayout>} />
                    <Route path="/avis/nouveau" element={<MainLayout><LeaveReviewPage /></MainLayout>} />
                    <Route path="/favoris"      element={<MainLayout><FavoritesPage /></MainLayout>} />
                    <Route path="/messages"     element={<MainLayout><MessagesPage /></MainLayout>} />

                    {/* DASHBOARD ADMIN */}
                    <Route element={<AdminRoute />}>
                        <Route path="/dashboard" element={<AdminDashboard />}>
                            <Route index                         element={<DashboardHome />} />
                            <Route path="properties"            element={<ManagePropertiesPage />} />
                            <Route path="properties/add"        element={<AddPropertyPage />} />
                            <Route path="events"                element={<ManageEventsPage />} />
                            <Route path="quotes"                element={<ManageQuotesPage />} />
                            <Route path="altcom"                element={<ManageAltcomPage />} />
                            <Route path="moderation/properties" element={<PropertyModerationPage />} />
                            <Route path="moderation/reviews"    element={<ReviewModerationPage />} />
                            <Route path="users"                 element={<UsersPanel />} />
                            <Route path="active-sessions"       element={<ActiveSessionsPage />} />
                            <Route path="emails"                element={<ManageEmailsPage />} />
                            <Route path="messages"              element={<InternalMessagingPage />} />
                        </Route>
                    </Route>

                    {/* DASHBOARD PROPRIÉTAIRE */}
                    <Route element={<OwnerRoute />}>
                        <Route path="/mes-biens" element={<OwnerDashboard />}>
                            <Route index element={<OwnerPropertyManagement />} />
                            <Route
                                path="securite"
                                element={<h1 className="text-3xl font-bold p-6">Sécurité du Compte (Propriétaire)</h1>}
                            />
                        </Route>
                    </Route>
                </Route>

                {/* 404 */}
                <Route path="*" element={<MainLayout><NotFoundPage /></MainLayout>} />

            </Routes>
        </>
    );
}

export default App;