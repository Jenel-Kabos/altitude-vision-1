// src/App.jsx
// ✅ CORRECTION PERFORMANCE : Lazy loading de toutes les pages
import React, { Suspense, lazy, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import SEOHead from "./components/SEOHead";

import Header     from "./components/layout/Header";
import Footer     from "./components/layout/Footer";
import ChatWidget from "./components/ChatWidget";
import ProtectedRoute  from "./components/routing/ProtectedRoute";
import AdminRoute      from "./components/routing/AdminRoute";
import OwnerRoute      from "./components/routing/OwnerRoute";
import PublicAuthRoute from "./components/routing/PublicAuthRoute";

// Pages publiques — lazy
const HomePage                  = lazy(() => import("./pages/HomePage"));
const AltimmoPage               = lazy(() => import("./pages/AltimmoPage"));
const AltimmoAnnonces           = lazy(() => import("./pages/AltimmoAnnonces"));
const PropertyDetailPage        = lazy(() => import("./pages/PropertyDetailPage"));
const CommissionCalculatorPage  = lazy(() => import("./pages/CommissionCalculatorPage"));
const MilaEventsPage            = lazy(() => import("./pages/MilaEventsPage"));
const MilaEventsAnnonces        = lazy(() => import("./pages/MilaEventsAnnonces"));
const EventDetailPage           = lazy(() => import("./pages/EventDetailPage"));
const CreateProjectPage         = lazy(() => import("./pages/CreateProjectPage"));
const AltcomPage                = lazy(() => import("./pages/altcom/AltcomPage"));
const AltcomAnnonces            = lazy(() => import("./pages/altcom/AltcomAnnonces"));
const AltcomServicePage         = lazy(() => import("./pages/altcom/AltcomServicePage"));
const AltcomPortfolioDetailPage = lazy(() => import("./pages/altcom/AltcomPortfolioDetailPage"));
const ContactPage               = lazy(() => import("./pages/ContactPage"));
const LoginPage                 = lazy(() => import("./pages/LoginPage"));
const RegisterPage              = lazy(() => import("./pages/RegisterPage"));
const NotFoundPage              = lazy(() => import("./pages/NotFoundPage"));
const UnauthorizedPage          = lazy(() => import("./pages/UnauthorizedPage"));
const MentionsLegales           = lazy(() => import("./pages/MentionsLegales"));
const ActualitesPage            = lazy(() => import("./pages/ActualitesPage"));
const VerifyEmailPendingPage    = lazy(() => import("./pages/VerifyEmailPendingPage"));
const VerifyEmailPage           = lazy(() => import("./pages/VerifyEmailPage"));
const LeaveReviewPage           = lazy(() => import("./pages/LeaveReviewPage"));
const ForgotPasswordPage        = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage         = lazy(() => import("./pages/ResetPasswordPage"));

const VenteDeBiensPage          = lazy(() => import("./pages/services/VenteDeBiensPage"));
const LocationGestionPage       = lazy(() => import("./pages/services/LocationGestionPage"));
const ConseilInvestissementPage = lazy(() => import("./pages/services/ConseilInvestissementPage"));

const AdminDashboard          = lazy(() => import("./pages/dashboard/AdminDashboard"));
const DashboardHome           = lazy(() => import("./pages/dashboard/DashboardHome"));
const ManagePropertiesPage    = lazy(() => import("./pages/dashboard/ManagePropertiesPage"));
const AddPropertyPage         = lazy(() => import("./pages/dashboard/AddPropertyPage"));
const ManageEventsPage        = lazy(() => import("./pages/dashboard/ManageEventsPage"));
const ManageQuotesPage        = lazy(() => import("./pages/dashboard/ManageQuotesPage"));
const PropertyModerationPage  = lazy(() => import("./pages/dashboard/PropertyModerationPage"));
const ReviewModerationPage    = lazy(() => import("./pages/dashboard/ReviewModerationPage"));
const UsersPanel              = lazy(() => import("./pages/dashboard/UsersPanel"));
const ActiveSessionsPage      = lazy(() => import("./pages/dashboard/ActiveSessionsPage"));
const ManageAltcomPage        = lazy(() => import("./pages/dashboard/ManageAltcomPage"));
const ManageEmailsPage        = lazy(() => import("./pages/dashboard/ManageEmailsPage"));
const InternalMessagingPage   = lazy(() => import("./pages/dashboard/InternalMessagingPage"));
const FavoritesPage           = lazy(() => import("./pages/FavoritesPage"));
const MessagesPage            = lazy(() => import("./pages/MessagesPage"));
const AccountPage             = lazy(() => import("./pages/AccountPage"));
const ProfilePage             = lazy(() => import("./pages/ProfilePage"));
const OwnerDashboard          = lazy(() => import("./pages/dashboard/OwnerDashboard"));
const OwnerPropertyManagement = lazy(() => import("./pages/dashboard/OwnerPropertyManagement"));

const PageLoader = () => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', background:'#FAF8F5' }}>
    <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid #E8E2DA', borderTop:'3px solid #C8872A', animation:'spin 0.7s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const resolvePageTitle = (pathname) => {
  if (pathname.startsWith("/altimmo"))     return "Altimmo";
  if (pathname.startsWith("/mila-events")) return "Mila Events";
  if (pathname.startsWith("/altcom"))      return "Altcom";
  if (pathname.startsWith("/contact"))     return "Contact";
  if (pathname.startsWith("/actualites"))  return "Actualités";
  return "";
};

const MainLayout = ({ children }) => {
  const location    = useLocation();
  const isDashboard = location.pathname.startsWith("/dashboard") || location.pathname.startsWith("/mes-biens");
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {!isDashboard && <Header />}
      <main className="flex-grow">{children}</main>
      {!isDashboard && <Footer />}
      {!isDashboard && <ChatWidget currentPageTitle={resolvePageTitle(location.pathname)} />}
    </div>
  );
};

function App() {
  useEffect(() => {
    fetch("https://altitude-vision.onrender.com/api/health").catch(() => {});
  }, []);

  return (
    <>
      <SEOHead />
      <Toaster position="top-right" />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/"            element={<MainLayout><HomePage /></MainLayout>} />
          <Route path="/actualites"  element={<MainLayout><ActualitesPage /></MainLayout>} />
          <Route path="/altimmo"                                 element={<MainLayout><AltimmoPage /></MainLayout>} />
          <Route path="/altimmo/annonces"                        element={<MainLayout><AltimmoAnnonces /></MainLayout>} />
          <Route path="/altimmo/property/:propertyId"            element={<MainLayout><PropertyDetailPage /></MainLayout>} />
          <Route path="/trouve-ta-commission"                    element={<MainLayout><CommissionCalculatorPage /></MainLayout>} />
          <Route path="/altimmo/services/vente-de-biens"         element={<MainLayout><VenteDeBiensPage /></MainLayout>} />
          <Route path="/altimmo/services/location-gestion"       element={<MainLayout><LocationGestionPage /></MainLayout>} />
          <Route path="/altimmo/services/conseil-investissement" element={<MainLayout><ConseilInvestissementPage /></MainLayout>} />
          <Route path="/mila-events"                  element={<MainLayout><MilaEventsPage /></MainLayout>} />
          <Route path="/mila-events/annonces"         element={<MainLayout><MilaEventsAnnonces /></MainLayout>} />
          <Route path="/mila-events/event/:eventId"   element={<MainLayout><EventDetailPage /></MainLayout>} />
          <Route path="/mila-events/creer-projet"     element={<MainLayout><CreateProjectPage /></MainLayout>} />
          <Route path="/altcom"                        element={<MainLayout><AltcomPage /></MainLayout>} />
          <Route path="/altcom/annonces"               element={<MainLayout><AltcomAnnonces /></MainLayout>} />
          <Route path="/altcom/portfolio/:portfolioId" element={<MainLayout><AltcomPortfolioDetailPage /></MainLayout>} />
          <Route path="/altcom/:serviceSlug"           element={<MainLayout><AltcomServicePage /></MainLayout>} />
          <Route path="/mentions-legales"    element={<MainLayout><MentionsLegales /></MainLayout>} />
          <Route path="/contact"             element={<MainLayout><ContactPage /></MainLayout>} />
          <Route path="/unauthorized"        element={<MainLayout><UnauthorizedPage /></MainLayout>} />
          <Route path="/verify-email/:token" element={<MainLayout><VerifyEmailPage /></MainLayout>} />
          <Route element={<PublicAuthRoute />}>
            <Route path="/login"                 element={<MainLayout><LoginPage /></MainLayout>} />
            <Route path="/register"              element={<MainLayout><RegisterPage /></MainLayout>} />
            <Route path="/verify-email-pending"  element={<VerifyEmailPendingPage />} />
            <Route path="/forgot-password"       element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/mon-compte"   element={<MainLayout><AccountPage /></MainLayout>} />
            <Route path="/profile"      element={<MainLayout><ProfilePage /></MainLayout>} />
            <Route path="/avis/nouveau" element={<MainLayout><LeaveReviewPage /></MainLayout>} />
            <Route path="/favoris"      element={<MainLayout><FavoritesPage /></MainLayout>} />
            <Route path="/messages"     element={<MainLayout><MessagesPage /></MainLayout>} />
            <Route element={<AdminRoute />}>
              <Route path="/dashboard" element={<AdminDashboard />}>
                <Route index                        element={<DashboardHome />} />
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
            <Route element={<OwnerRoute />}>
              <Route path="/mes-biens" element={<OwnerDashboard />}>
                <Route index element={<OwnerPropertyManagement />} />
                <Route path="securite" element={<h1 className="text-3xl font-bold p-6">Sécurité</h1>} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<MainLayout><NotFoundPage /></MainLayout>} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;