import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Send, 
  CheckCircle, 
  Star,
  Clock,
  TrendingUp,
  Users,
  Zap,
  Target,
  MessageSquare,
  Layout,
  Briefcase
} from 'lucide-react';

// Données détaillées des services Altcom
const servicesData = {
  1: {
    id: 1,
    title: "Communication Digitale",
    icon: MessageSquare,
    color: "text-blue-500",
    tagline: "Amplifiez votre présence en ligne",
    description: "Stratégies digitales complètes pour engager votre audience et développer votre notoriété sur tous les canaux numériques.",
    fullDescription: "Notre expertise en communication digitale vous permet de créer une présence en ligne cohérente et impactante. Nous développons des stratégies sur mesure incluant la gestion des réseaux sociaux, la création de contenus engageants, et l'optimisation de votre visibilité digitale.",
    benefits: [
      "Gestion complète des réseaux sociaux (Facebook, Instagram, LinkedIn, Twitter)",
      "Création de contenus visuels et rédactionnels adaptés à chaque plateforme",
      "Stratégie de contenus SEO pour améliorer votre référencement",
      "Campagnes publicitaires ciblées (Facebook Ads, Google Ads)",
      "Analyse des performances et reporting mensuel détaillé",
      "Community management et gestion de l'e-réputation"
    ],
    process: [
      { step: 1, title: "Audit Digital", description: "Analyse de votre présence actuelle et de vos concurrents" },
      { step: 2, title: "Stratégie", description: "Définition des objectifs, cibles et plan d'actions" },
      { step: 3, title: "Création", description: "Production de contenus créatifs et engageants" },
      { step: 4, title: "Déploiement", description: "Publication programmée et gestion quotidienne" },
      { step: 5, title: "Optimisation", description: "Analyse des résultats et ajustements continus" }
    ],
    pricing: {
      starter: { name: "Starter", price: "500 000", features: ["2 réseaux sociaux", "8 publications/mois", "Reporting mensuel"] },
      pro: { name: "Professional", price: "1 200 000", features: ["4 réseaux sociaux", "20 publications/mois", "Community management", "Campagnes Ads"] },
      premium: { name: "Premium", price: "2 500 000", features: ["Tous réseaux", "40+ publications/mois", "Stratégie complète", "Support dédié 24/7"] }
    },
    portfolio: [
      { title: "Campagne Lancement Produit", client: "Tech Solutions", result: "+250% engagement" },
      { title: "Refonte Stratégie Social Media", client: "Global Corp", result: "x3 followers en 6 mois" }
    ],
    testimonials: [
      { author: "Marie Dupont", company: "StartUp Innov", text: "Altcom a transformé notre présence digitale. Résultats visibles dès le premier mois!", rating: 5 }
    ]
  },
  2: {
    id: 2,
    title: "Branding & Design",
    icon: Layout,
    color: "text-purple-500",
    tagline: "Créez une identité visuelle mémorable",
    description: "Conception d'identités de marque uniques et supports graphiques qui captivent votre audience et renforcent votre positionnement.",
    fullDescription: "Notre équipe de designers crée des identités visuelles qui racontent votre histoire et résonnent avec votre audience. Du logo aux chartes graphiques complètes, nous donnons vie à votre vision avec créativité et professionnalisme.",
    benefits: [
      "Création de logo professionnel et déclinaisons",
      "Charte graphique complète (couleurs, typographies, usage)",
      "Design de supports print (cartes de visite, flyers, brochures)",
      "Design de supports digitaux (bannières, visuels réseaux sociaux)",
      "Packaging et design produit",
      "Templates personnalisés pour vos communications"
    ],
    process: [
      { step: 1, title: "Brief Créatif", description: "Compréhension de votre vision et de vos valeurs" },
      { step: 2, title: "Recherche", description: "Analyse du marché et inspiration créative" },
      { step: 3, title: "Concepts", description: "Présentation de 3 propositions créatives" },
      { step: 4, title: "Révisions", description: "Affinement selon vos retours" },
      { step: 5, title: "Livraison", description: "Fichiers finaux et guide d'utilisation" }
    ],
    pricing: {
      starter: { name: "Identité Basique", price: "800 000", features: ["Logo + 2 déclinaisons", "Charte couleurs", "Fichiers sources"] },
      pro: { name: "Identité Complète", price: "1 800 000", features: ["Logo complet", "Charte graphique", "10 supports design", "Guide de marque"] },
      premium: { name: "Branding 360°", price: "3 500 000", features: ["Identité complète", "20+ supports", "Packaging", "Suivi 6 mois"] }
    },
    portfolio: [
      { title: "Refonte Identité Visuelle", client: "BioTech Lab", result: "Reconnaissance +180%" },
      { title: "Branding Startup", client: "Green Energy", result: "Prix Design 2024" }
    ],
    testimonials: [
      { author: "Jean Martin", company: "Eco Solutions", text: "Un travail exceptionnel qui a donné à notre marque une nouvelle dimension.", rating: 5 }
    ]
  },
  3: {
    id: 3,
    title: "Conseil & Stratégie",
    icon: TrendingUp,
    color: "text-red-500",
    tagline: "Stratégies sur mesure pour votre croissance",
    description: "Accompagnement stratégique personnalisé pour définir et atteindre vos objectifs de communication et de développement.",
    fullDescription: "Nos consultants vous accompagnent dans la définition et la mise en œuvre de stratégies de communication efficaces. Nous analysons votre environnement, identifions les opportunités et construisons avec vous un plan d'actions concret.",
    benefits: [
      "Audit complet de votre communication actuelle",
      "Définition de positionnement et proposition de valeur",
      "Stratégie de contenu et calendrier éditorial",
      "Plan de communication 360° (digital + traditionnel)",
      "Accompagnement dans les relations presse",
      "Formation de vos équipes aux bonnes pratiques"
    ],
    process: [
      { step: 1, title: "Diagnostic", description: "Analyse approfondie de votre situation" },
      { step: 2, title: "Objectifs", description: "Définition claire des résultats attendus" },
      { step: 3, title: "Stratégie", description: "Élaboration du plan d'actions détaillé" },
      { step: 4, title: "Accompagnement", description: "Support dans la mise en œuvre" },
      { step: 5, title: "Évaluation", description: "Mesure des résultats et ajustements" }
    ],
    pricing: {
      starter: { name: "Audit & Recommandations", price: "1 000 000", features: ["Audit 2 jours", "Rapport stratégique", "Présentation"] },
      pro: { name: "Accompagnement 3 mois", price: "2 500 000", features: ["Stratégie complète", "Suivi mensuel", "Formation équipe"] },
      premium: { name: "Partenariat Annuel", price: "6 000 000", features: ["Accompagnement continu", "Révisions trimestrielles", "Support illimité"] }
    },
    portfolio: [
      { title: "Repositionnement Marque", client: "Retail Chain", result: "+45% trafic magasin" },
      { title: "Stratégie Lancement", client: "FinTech Startup", result: "1000 clients en 3 mois" }
    ],
    testimonials: [
      { author: "Sophie Laurent", company: "Retail Pro", text: "Un accompagnement précieux qui a transformé notre approche marketing.", rating: 5 }
    ]
  }
};

const AltcomServiceDetailPage = () => {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState('pro');

  useEffect(() => {
    const serviceData = servicesData[serviceId];
    if (serviceData) {
      setService(serviceData);
    } else {
      navigate('/altcom');
    }
  }, [serviceId, navigate]);

  if (!service) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Chargement...</p>
        </div>
      </div>
    );
  }

  const IconComponent = service.icon;
  const bgColorClass = service.color.replace('text-', 'bg-').replace('-500', '-100');

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header avec retour */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white shadow-sm sticky top-0 z-50"
      >
        <div className="container mx-auto px-6 py-4">
          <button
            onClick={() => navigate('/altcom')}
            className="flex items-center text-gray-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Retour aux services
          </button>
        </div>
      </motion.div>

      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-gradient-to-br from-blue-600 to-purple-700 text-white py-20"
      >
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1">
              <div className={`inline-block p-4 rounded-2xl ${bgColorClass} mb-6`}>
                <IconComponent className={`w-12 h-12 ${service.color}`} />
              </div>
              <h1 className="text-5xl lg:text-6xl font-extrabold mb-4">{service.title}</h1>
              <p className="text-2xl font-light mb-6">{service.tagline}</p>
              <p className="text-xl text-blue-100 mb-8">{service.fullDescription}</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/altcom', { state: { openQuoteModal: true, service: service.title } })}
                className="bg-white text-blue-600 px-8 py-4 rounded-full font-bold text-lg shadow-xl hover:shadow-2xl transition-all flex items-center gap-2"
              >
                <Send className="w-5 h-5" />
                Demander un Devis Gratuit
              </motion.button>
            </div>
            <div className="flex-1">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20"
              >
                <h3 className="text-2xl font-bold mb-6">Ce que vous obtenez</h3>
                <ul className="space-y-4">
                  {service.benefits.slice(0, 4).map((benefit, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                      <span className="text-lg">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Avantages détaillés */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-12">Tous les Avantages</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {service.benefits.map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-gray-50 p-6 rounded-xl border-l-4 border-blue-600 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                  <p className="text-gray-700">{benefit}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Notre Processus */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-4">Notre Processus</h2>
          <p className="text-center text-gray-600 mb-16 text-lg">Une approche structurée pour votre succès</p>
          <div className="relative">
            {service.process.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className={`flex items-center gap-8 mb-12 ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}
              >
                <div className="flex-1 text-right">
                  <div className={`inline-block bg-white p-8 rounded-2xl shadow-lg ${index % 2 !== 0 ? 'text-left' : ''}`}>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">{item.title}</h3>
                    <p className="text-gray-600">{item.description}</p>
                  </div>
                </div>
                <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold shadow-xl flex-shrink-0">
                  {item.step}
                </div>
                <div className="flex-1"></div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tarifs */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-4">Nos Forfaits</h2>
          <p className="text-center text-gray-600 mb-16 text-lg">Choisissez la formule adaptée à vos besoins</p>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {Object.entries(service.pricing).map(([key, plan]) => (
              <motion.div
                key={key}
                whileHover={{ y: -10 }}
                className={`bg-white rounded-3xl p-8 border-2 transition-all ${
                  selectedPlan === key ? 'border-blue-600 shadow-2xl' : 'border-gray-200 shadow-lg'
                }`}
              >
                <h3 className="text-2xl font-bold mb-4">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-5xl font-extrabold text-blue-600">{plan.price}</span>
                  <span className="text-gray-600 ml-2">FCFA/mois</span>
                </div>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    setSelectedPlan(key);
                    navigate('/altcom', { state: { openQuoteModal: true, service: `${service.title} - ${plan.name}` } });
                  }}
                  className={`w-full py-4 rounded-xl font-bold transition-all ${
                    selectedPlan === key
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Choisir ce forfait
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Témoignages */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-16">Ce que disent nos clients</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {service.testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="bg-white p-8 rounded-2xl shadow-lg"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 italic mb-4">"{testimonial.text}"</p>
                <div>
                  <p className="font-bold">{testimonial.author}</p>
                  <p className="text-sm text-gray-600">{testimonial.company}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="bg-gradient-to-r from-blue-600 to-purple-700 py-20 text-white"
      >
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl lg:text-5xl font-extrabold mb-6">Prêt à démarrer votre projet ?</h2>
          <p className="text-xl mb-10 max-w-2xl mx-auto">
            Contactez-nous dès aujourd'hui pour une consultation gratuite et découvrez comment nous pouvons vous aider.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/altcom', { state: { openQuoteModal: true, service: service.title } })}
            className="bg-white text-blue-600 px-10 py-5 rounded-full font-bold text-xl shadow-2xl hover:shadow-3xl transition-all inline-flex items-center gap-3"
          >
            <Send className="w-6 h-6" />
            Demander un Devis Personnalisé
          </motion.button>
        </div>
      </motion.section>
    </div>
  );
};

export default AltcomServiceDetailPage;