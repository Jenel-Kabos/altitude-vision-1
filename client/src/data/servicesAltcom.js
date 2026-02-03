// src/data/servicesAltcom.js
import {
  MessageSquare,
  Brush,
  Megaphone,
  ChartBar,
  Camera,
  PenTool,
  Globe2,
} from "lucide-react";

// =============================================================
//  Fonction utilitaire pour générer des slugs SEO-friendly
// =============================================================
export const slugify = (text) =>
  text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// =============================================================
//  Liste officielle des services ALTCOM
// =============================================================
export const servicesAltcom = [
  {
    title: "Communication Digitale",
    description:
      "Stratégies modernes pour renforcer votre présence en ligne et engager votre audience.",
    longDescription:
      "Nos solutions en communication digitale vous permettent de renforcer votre notoriété, d’optimiser votre visibilité et d’engager durablement votre audience. De la création de contenu aux campagnes multicanales, nous vous accompagnons dans chaque étape de votre croissance.",
    features: [
      "Gestion des réseaux sociaux",
      "Campagnes social ads",
      "Création de contenu optimisé",
      "Audit et stratégie digitale",
    ],
    icon: MessageSquare,
    color: "blue",
  },

  {
    title: "Branding & Identité Visuelle",
    description:
      "Création d’identités visuelles fortes et mémorables reflétant votre ADN.",
    longDescription:
      "Nous construisons votre image de marque à travers une identité visuelle forte, moderne et cohérente. Logo, charte graphique, typographies, couleurs, ton éditorial… Tout est pensé pour que votre marque devienne inoubliable.",
    features: [
      "Logo professionnel",
      "Charte graphique complète",
      "Univers visuel cohérent",
      "Brandbook premium",
    ],
    icon: Brush,
    color: "purple",
  },

  {
    title: "Marketing & Acquisition",
    description:
      "Des stratégies orientées performance pour attirer plus de clients.",
    longDescription:
      "Nos services marketing ont pour objectif d’augmenter vos leads, vos ventes et votre visibilité via des stratégies modernes et une approche axée sur la performance.",
    features: [
      "Campagnes Ads (Meta, Google)",
      "Stratégies d’acquisition",
      "Funnels & automatisation",
      "Reporting & optimisation",
    ],
    icon: ChartBar,
    color: "green",
  },

  {
    title: "Production Vidéo & Photo",
    description:
      "Du contenu professionnel pour mettre en valeur vos produits, événements ou marque.",
    longDescription:
      "Nous produisons des contenus photo et vidéo premium pour renforcer votre image, améliorer vos conversions et inspirer votre communauté.",
    features: [
      "Tournage vidéo professionnel",
      "Montage créatif",
      "Shooting photos",
      "Post-production avancée",
    ],
    icon: Camera,
    color: "yellow",
  },

  {
    title: "Création de Contenu",
    description:
      "Du contenu moderne et engageant pour renforcer votre présence digitale.",
    longDescription:
      "Nous créons du contenu esthétique, impactant et adapté à chaque plateforme afin de mettre en valeur votre marque et engager votre audience.",
    features: [
      "Contenu social media",
      "Rédaction optimisée",
      "Mini-vidéos & formats courts",
      "Optimisation pour l'algorithme",
    ],
    icon: PenTool,
    color: "red",
  },

  {
    title: "Sites Web & Landing Pages",
    description:
      "Conception de sites modernes, rapides, optimisés et orientés conversion.",
    longDescription:
      "Nous créons des sites web et des landing pages professionnelles, pensées pour convertir, refléter votre identité et offrir une expérience fluide à vos utilisateurs.",
    features: [
      "Site vitrine complet",
      "Landing pages UX optimisées",
      "SEO technique",
      "Maintenance & sécurité",
    ],
    icon: Globe2,
    color: "indigo",
  },

  {
    title: "Publicité & Campagnes",
    description:
      "Faites connaître votre marque avec des campagnes créatives et performantes.",
    longDescription:
      "Nous concevons vos campagnes publicitaires de A à Z, de la stratégie créative jusqu’à l’analyse des performances.",
    features: [
      "Création publicitaire",
      "Campagnes multi-plateformes",
      "Stratégie d’audience",
      "Analyse & optimisation",
    ],
    icon: Megaphone,
    color: "pink",
  },
];

// =============================================================
//  Ajout automatique des slugs
// =============================================================
servicesAltcom.forEach((service) => {
  service.slug = slugify(service.title);
});
