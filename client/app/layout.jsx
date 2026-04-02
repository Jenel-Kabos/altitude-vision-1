import "./globals.css";
import AppProviders from "./AppProviders";
import ClientLayout from "./ClientLayout";

export const metadata = {
  title: "Altitude-Vision",
  description: "Agence Altitude-Vision — Immobilier, Événements et Communication à Brazzaville.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <AppProviders>
          <ClientLayout>
            {children}
          </ClientLayout>
        </AppProviders>
      </body>
    </html>
  );
}
