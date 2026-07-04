import "./globals.css";
import { Cinzel, Cormorant_Garamond, DM_Sans } from 'next/font/google';
import AppProviders from "./AppProviders";
import ClientLayout from "./ClientLayout";
import JsonLd from "@/lib/components/JsonLd";
import GoogleAnalytics from "@/lib/components/GoogleAnalytics";
import { buildMetadata, SITE_URL } from "@/lib/seo";

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-cinzel',
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata = {
  metadataBase: new URL(SITE_URL),
  ...buildMetadata({
    title: "Immobilier, Événements & Communication à Brazzaville",
    description: "Altitude-Vision — Trouvez votre bien immobilier, organisez vos événements et boostez votre communication à Brazzaville, Congo.",
    url: "/",
  }),
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/images/Logo_Altitude1.png",
  },
  verification: {
    google: 'F4D7sKQm2QQaHzm8XU6CPY4hj2q00o1kY2ZlvKktsIs',
  },
};

const LOCAL_BUSINESS_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Altitude-Vision",
  description: "Agence Altitude-Vision — Immobilier, Événements et Communication à Brazzaville.",
  url: SITE_URL,
  logo: `${SITE_URL}/images/Logo_Altitude1.png`,
  image: `${SITE_URL}/og-default.jpg`,
  telephone: "+242 05 330 16 75",
  email: "contact@altitudevision.agency",
  address: {
    "@type": "PostalAddress",
    streetAddress: "24 Rue de Mfoa, Poto-Poto",
    addressLocality: "Brazzaville",
    addressCountry: "CG",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: -4.2634,
    longitude: 15.2429,
  },
  areaServed: { "@type": "City", name: "Brazzaville" },
  openingHoursSpecification: [
    { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday"], opens: "08:30", closes: "17:30" },
    { "@type": "OpeningHoursSpecification", dayOfWeek: ["Saturday"], opens: "09:00", closes: "12:00" },
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Services Altitude-Vision",
    itemListElement: [
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Altimmo — Immobilier" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Altcom — Communication & Business" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Mila Events — Organisation d'événements" } },
    ],
  },
  sameAs: [
    "https://www.facebook.com/profile.php?id=61558493665509",
    "https://www.instagram.com/immoaltitudevision/",
    "https://wa.me/242068002151",
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" data-scroll-behavior="smooth" className={`${cinzel.variable} ${cormorant.variable} ${dmSans.variable}`}>
      <body>
        <JsonLd schemas={[LOCAL_BUSINESS_SCHEMA]} />
        <AppProviders>
          <ClientLayout>
            {children}
          </ClientLayout>
        </AppProviders>
        <GoogleAnalytics />
      </body>
    </html>
  );
}