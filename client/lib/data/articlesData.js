// client/lib/data/articlesData.js
import { Building2, CalendarCheck, Briefcase, BookOpen } from 'lucide-react';

export const BLUE      = '#2E7BB5';
export const BLUE_DARK = '#1A5A8A';
export const GOLD      = '#C8960C';
export const GOLD_DARK = '#A0671A';
export const RED       = '#D42B2B';

export const ARTICLES = [
    {
        id: 'a1',
        slug: 'marche-immobilier-brazzaville-2025',
        category: 'Immobilier',
        categoryColor: BLUE,
        categoryIconName: 'Building2',
        title: 'Le marché immobilier à Brazzaville en 2025 : tendances et opportunités',
        excerpt: 'Le secteur immobilier congolais connaît une dynamique nouvelle. Entre demande croissante de résidences haut de gamme et essor des quartiers émergents, Altimmo vous décrypte les tendances clés pour bien investir cette année.',
        date: '2025-03-15',
        readTime: '5 min',
        image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1600&auto=format&fit=crop',
        servicePage: '/immobilier',
        serviceLabel: 'Découvrir Altimmo',
        tags: ['Immobilier', 'Brazzaville', 'Investissement', 'Marché 2025'],
        sections: [
            {
                type: 'intro',
                content: "Brazzaville traverse une période de transformation immobilière sans précédent. Portée par une classe moyenne en expansion et des projets d'infrastructure d'envergure, la capitale congolaise attire de plus en plus d'investisseurs locaux et de la diaspora. Voici les grandes tendances que notre équipe Altimmo observe sur le terrain.",
            },
            {
                type: 'heading',
                content: '1. La résidence haut de gamme : une demande qui explose',
            },
            {
                type: 'paragraph',
                content: "Les quartiers de Bacongo, Poto-Poto et surtout le secteur de la Corniche connaissent une demande soutenue pour des logements modernes, sécurisés et équipés. Les familles cadres, les expatriés et les professionnels de retour de l'étranger recherchent des appartements de standing avec parking, groupe électrogène et connexion fibre — des critères devenus incontournables.",
            },
            {
                type: 'stat',
                label: 'Hausse des demandes haut de gamme',
                value: '+34%',
                sub: 'en 12 mois sur Brazzaville',
                color: BLUE,
            },
            {
                type: 'heading',
                content: '2. Les quartiers émergents : où investir ?',
            },
            {
                type: 'paragraph',
                content: "Talangaï et Moungali s'imposent comme les nouveaux pôles résidentiels à surveiller. Plus accessibles que le centre-ville, ils bénéficient d'un meilleur accès routier depuis les travaux d'élargissement de la route nationale. Les terrains y restent encore acquérables à des prix raisonnables, offrant une fenêtre d'opportunité avant la montée inévitable des valeurs foncières.",
            },
            {
                type: 'pullquote',
                content: "« Investir dans un quartier en développement aujourd'hui, c'est préparer une plus-value significative à 5 ans. Le moment d'agir, c'est maintenant. »",
                author: 'Équipe Altimmo',
            },
            {
                type: 'heading',
                content: '3. La location professionnelle : un marché en pleine structuration',
            },
            {
                type: 'paragraph',
                content: "Le segment des bureaux et des locaux commerciaux se professionnalise. Les entreprises internationales et les ONG présentes à Brazzaville recherchent des espaces conformes aux standards internationaux : open-space modulable, salles de réunion, climatisation centralisée. Altimmo accompagne les propriétaires souhaitant valoriser leurs actifs commerciaux.",
            },
            {
                type: 'list',
                items: [
                    'Demande croissante pour les surfaces > 200 m² en zone centrale',
                    'Les baux professionnels 3-6-9 ans offrent la meilleure rentabilité',
                    'La mise aux normes électriques conditionne désormais les locations premium',
                    "Les espaces de coworking émergent comme alternative flexible pour les startups",
                ],
            },
            {
                type: 'heading',
                content: '4. Le financement : nouvelles solutions pour les acquéreurs',
            },
            {
                type: 'paragraph',
                content: "L'accès au crédit immobilier se démocratise progressivement au Congo. Les banques locales commencent à proposer des offres adaptées aux salariés du secteur public et privé, avec des durées de remboursement allant jusqu'à 15 ans. Altimmo travaille en partenariat avec plusieurs établissements financiers pour faciliter les démarches de nos clients acquéreurs.",
            },
            {
                type: 'heading',
                content: 'Notre conseil pour 2025',
            },
            {
                type: 'paragraph',
                content: "Dans un marché encore peu digitalisé, faire confiance à une agence reconnue comme Altimmo reste le meilleur moyen de sécuriser votre transaction. Notre connaissance fine du terrain, notre réseau de propriétaires et notre transparence contractuelle vous protègent à chaque étape — de la visite à la signature définitive.",
            },
        ],
    },
    {
        id: 'a2',
        slug: 'tendances-evenementielles-luxe-brazzaville',
        category: 'Événementiel',
        categoryColor: RED,
        categoryIconName: 'CalendarCheck',
        title: 'Mila Events : 5 tendances événementielles qui redéfinissent le luxe à Brazzaville',
        excerpt: "Des mariages intimistes aux galas d'entreprise, l'événementiel haut de gamme se réinvente. Découvrez comment Mila Events intègre scénographie immersive, traiteur premium et expériences sur-mesure pour chaque occasion.",
        date: '2025-02-28',
        readTime: '4 min',
        image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=1600&auto=format&fit=crop',
        servicePage: '/evenementiel',
        serviceLabel: 'Découvrir Mila Events',
        tags: ['Événementiel', 'Luxe', 'Mariage', 'Gala', 'Brazzaville'],
        sections: [
            {
                type: 'intro',
                content: "L'événementiel à Brazzaville change de visage. Fini les formules standardisées : les organisateurs d'événements haut de gamme réinventent chaque célébration comme une expérience unique, mémorable et racontable. Mila Events, pôle événementiel d'Altitude-Vision, décrypte pour vous les 5 tendances qui façonnent le secteur en 2025.",
            },
            {
                type: 'heading',
                content: 'Tendance 1 — La scénographie immersive',
            },
            {
                type: 'paragraph',
                content: "Les mariages et galas d'entreprise intègrent désormais des éléments de décor immersifs : mapping vidéo sur les murs, éclairage LED programmable, allées de fleurs suspendues et plafonds de lumière. L'objectif ? Transporter les invités dans un univers pensé de A à Z, cohérent et émotionnellement fort.",
            },
            {
                type: 'stat',
                label: 'Budget moyen scénographie',
                value: '×2',
                sub: 'en 3 ans dans nos événements',
                color: RED,
            },
            {
                type: 'heading',
                content: 'Tendance 2 — Le traiteur gastronomique personnalisé',
            },
            {
                type: 'paragraph',
                content: "La restauration événementielle monte en gamme. Nos clients privilégient des menus sur-mesure alliant cuisine congolaise revisitée et influences internationales. Les stations de live cooking — où le chef prépare en direct devant les invités — créent un moment spectaculaire qui suscite échanges et souvenirs durables.",
            },
            {
                type: 'pullquote',
                content: "« Un événement réussi se souvient par ses émotions, ses saveurs et ses images. Nous orchestrons les trois simultanément. »",
                author: 'Équipe Mila Events',
            },
            {
                type: 'heading',
                content: 'Tendance 3 — Les événements intimistes & exclusifs',
            },
            {
                type: 'paragraph',
                content: "Contre la tendance au « grand nombre », une clientèle exigeante choisit désormais des événements plus restreints (50–150 personnes) mais d'une qualité irréprochable. Moins d'invités, mais plus d'attention portée à chacun, une décoration plus travaillée et un budget par tête plus élevé. Mila Events est expert dans ce format intimiste haut de gamme.",
            },
            {
                type: 'heading',
                content: 'Tendance 4 — La captation professionnelle multi-angles',
            },
            {
                type: 'paragraph',
                content: "La mémoire visuelle de l'événement est devenue aussi importante que l'événement lui-même. Nos clients investissent dans des équipes photo/vidéo professionnelles, des drones pour les vues aériennes et des films de mariage cinématographiques dignes d'une production audiovisuelle.",
            },
            {
                type: 'list',
                items: [
                    'Couverture photo professionnelle multi-photographes',
                    'Film de mariage cinématique (durée 8–15 min)',
                    'Drone pour les prises de vue extérieures',
                    'Restitution du teaser dans les 48h',
                ],
            },
            {
                type: 'heading',
                content: 'Tendance 5 — L\'expérience invité pensée dans les moindres détails',
            },
            {
                type: 'paragraph',
                content: "Des faire-part personnalisés aux cadeaux de départ, chaque point de contact avec l'invité est orchestré. Accueil VIP, programme imprimé luxe, signalétique sur-mesure, espace photo instagrammable — tout concourt à offrir une expérience globale que les invités partagent spontanément sur les réseaux sociaux.",
            },
        ],
    },
    {
        id: 'a3',
        slug: 'altcom-offres-communication-digitale-pme',
        category: 'Communication',
        categoryColor: GOLD,
        categoryIconName: 'Briefcase',
        title: 'Altcom lance ses nouvelles offres de communication digitale pour les PME congolaises',
        excerpt: "Face à l'essor des réseaux sociaux en République du Congo, Altcom déploie des packages adaptés aux PME locales : gestion des réseaux sociaux, création de contenus visuels et campagnes publicitaires ciblées.",
        date: '2025-02-10',
        readTime: '3 min',
        image: 'https://images.unsplash.com/photo-1611926653458-09294b3142bf?q=80&w=1600&auto=format&fit=crop',
        servicePage: '/communication',
        serviceLabel: 'Découvrir Altcom',
        tags: ['Communication', 'Digital', 'PME', 'Réseaux sociaux', 'Branding'],
        sections: [
            {
                type: 'intro',
                content: "En 2025, une entreprise qui n'est pas visible sur les réseaux sociaux est une entreprise invisible. Pourtant, pour beaucoup de PME congolaises, gérer sa communication digitale reste un défi faute de ressources ou d'expertise. Altcom, pôle communication d'Altitude-Vision, a conçu des packages clé-en-main spécialement pour le marché local.",
            },
            {
                type: 'heading',
                content: 'Un contexte digital en pleine accélération',
            },
            {
                type: 'paragraph',
                content: "Le taux de pénétration des smartphones au Congo dépasse désormais 65% en zone urbaine. Facebook, WhatsApp et TikTok sont devenus les premiers médias d'information et de découverte des marques pour une majorité de Brazzavillois. Ignorer ces canaux, c'est laisser le champ libre à ses concurrents.",
            },
            {
                type: 'stat',
                label: 'PME congolaises actives sur les réseaux',
                value: '28%',
                sub: 'seulement — un potentiel immense à saisir',
                color: GOLD,
            },
            {
                type: 'heading',
                content: 'Nos packages Altcom 2025',
            },
            {
                type: 'list',
                items: [
                    "Pack Starter : 2 publications/semaine, identité visuelle, rapport mensuel",
                    "Pack Croissance : 4 publications/semaine, stories quotidiennes, 1 campagne pub/mois",
                    "Pack Prestige : Community management 7j/7, production vidéo, stratégie de marque complète",
                    "Pack Événement : couverture photo/vidéo live, publication en temps réel, montage J+1",
                ],
            },
            {
                type: 'pullquote',
                content: "« Nous ne créons pas juste du contenu. Nous construisons une audience fidèle qui devient votre meilleur vecteur de croissance. »",
                author: 'Équipe Altcom',
            },
            {
                type: 'heading',
                content: 'Ce qui différencie Altcom',
            },
            {
                type: 'paragraph',
                content: "Notre force est de conjuguer connaissance profonde du marché congolais et maîtrise des meilleures pratiques digitales internationales. Nos créatifs connaissent les codes culturels locaux, les références qui résonnent, les humors qui fonctionnent — des nuances impossibles à importer depuis l'étranger. Chaque contenu est pensé pour votre audience, pas pour un marché générique.",
            },
            {
                type: 'heading',
                content: 'Au-delà des réseaux sociaux',
            },
            {
                type: 'paragraph',
                content: "Altcom accompagne aussi ses clients dans la création de site web vitrine, la production de vidéos institutionnelles, la conception d'affiches et flyers, et la couverture médiatique d'événements. Une offre 360° pour une image de marque cohérente sur tous les supports.",
            },
        ],
    },
    {
        id: 'a4',
        slug: 'altitude-vision-agence-multidisciplinaire',
        category: 'Altitude-Vision',
        categoryColor: BLUE,
        categoryIconName: 'BookOpen',
        title: 'Altitude-Vision : une agence multidisciplinaire au service de votre ambition',
        excerpt: "Trois pôles d'expertise — immobilier, événementiel, communication — qui travaillent en synergie pour vous offrir une approche 360°. Découvrez comment notre modèle unique crée de la valeur pour nos clients.",
        date: '2025-01-20',
        readTime: '6 min',
        image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1600&auto=format&fit=crop',
        servicePage: '/contact',
        serviceLabel: 'Nous contacter',
        tags: ['Altitude-Vision', 'Stratégie', 'Synergie', '360°'],
        sections: [
            {
                type: 'intro',
                content: "Dans un monde où les défis des entreprises et des particuliers ne se limitent plus à un seul domaine, Altitude-Vision a fait le pari de l'excellence multidisciplinaire. Notre modèle repose sur trois pôles complémentaires qui, ensemble, offrent à nos clients une vision globale et des solutions intégrées.",
            },
            {
                type: 'heading',
                content: 'Pourquoi une agence multidisciplinaire ?',
            },
            {
                type: 'paragraph',
                content: "Les projets d'envergure nécessitent rarement un seul type d'expertise. Un entrepreneur qui crée son siège social a besoin d'un bien immobilier adapté, d'une communication pour son inauguration et d'une identité visuelle solide. En travaillant avec Altitude-Vision, il accède à ces trois compétences sous un seul toit, avec une coordination parfaite entre les équipes.",
            },
            {
                type: 'heading',
                content: 'Pôle 1 — Altimmo : l\'immobilier ancré dans la réalité locale',
            },
            {
                type: 'paragraph',
                content: "Altimmo est notre pôle spécialisé dans les transactions immobilières à Brazzaville et dans les principales villes du Congo. Notre équipe d'agents agréés accompagne acheteurs, vendeurs et locataires dans leurs projets, avec une connaissance fine du marché local et un réseau de propriétaires soigneusement sélectionnés.",
            },
            {
                type: 'stat',
                label: 'Transactions accompagnées',
                value: '200+',
                sub: 'depuis notre création',
                color: BLUE,
            },
            {
                type: 'heading',
                content: 'Pôle 2 — Mila Events : l\'excellence événementielle',
            },
            {
                type: 'paragraph',
                content: "Mila Events conçoit et produit des événements haut de gamme : mariages, galas d'entreprise, lancements de produit, séminaires et cérémonies officielles. Notre approche combine direction artistique soignée, logistique rigoureuse et réseau de prestataires premium pour livrer des événements dont chaque détail est maîtrisé.",
            },
            {
                type: 'heading',
                content: 'Pôle 3 — Altcom : la communication au service de la croissance',
            },
            {
                type: 'paragraph',
                content: "Altcom est notre agence de communication digitale et créative. De la stratégie de marque à la gestion des réseaux sociaux, en passant par la production audiovisuelle et la couverture médiatique, Altcom construit la visibilité de nos clients sur tous les supports pertinents.",
            },
            {
                type: 'pullquote',
                content: "« L'altitude, c'est notre état d'esprit : toujours viser plus haut, pour chacun de nos clients, à chaque mission. »",
                author: 'Direction Altitude-Vision',
            },
            {
                type: 'heading',
                content: 'La force de la synergie',
            },
            {
                type: 'paragraph',
                content: "Ce qui distingue vraiment Altitude-Vision, c'est la collaboration entre nos pôles. Quand un client Altimmo inaugure son nouveau bien, Mila Events organise la réception et Altcom en assure la couverture. Quand une entreprise fait appel à Altcom pour son branding, nous pouvons l'accompagner dans la recherche de nouveaux locaux via Altimmo. Cette synergie crée une valeur ajoutée unique que les agences mono-disciplinaires ne peuvent pas offrir.",
            },
            {
                type: 'list',
                items: [
                    'Vision à 360° pour chaque projet client',
                    'Coordination interne entre les pôles, sans friction',
                    'Facturation simplifiée sur une seule relation commerciale',
                    'Cohérence de qualité et de valeurs sur toutes les prestations',
                ],
            },
            {
                type: 'heading',
                content: 'Notre engagement',
            },
            {
                type: 'paragraph',
                content: "Altitude-Vision s'engage à placer l'excellence et la transparence au cœur de chaque collaboration. Nous ne promettons que ce que nous pouvons tenir, et nous tenons ce que nous promettons. C'est sur cette réputation que nous avons bâti notre position à Brazzaville — et c'est sur elle que nous continuons de grandir.",
            },
        ],
    },
];

export function getArticleBySlug(slug) {
    return ARTICLES.find(a => a.slug === slug) || null;
}

export function getOtherArticles(currentId) {
    return ARTICLES.filter(a => a.id !== currentId);
}
