import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send, MessageSquare } from 'lucide-react';

// Composant pour le champ de formulaire réutilisable
const FormInput = ({ label, id, type = 'text', required = false, isTextArea = false }) => (
    <div className="mb-5">
        <label htmlFor={id} className="block text-sm font-semibold text-gray-700 mb-2">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        {isTextArea ? (
            <textarea
                id={id}
                name={id}
                rows="5"
                required={required}
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-300 resize-none"
                placeholder={`Décrivez votre projet...`}
            />
        ) : (
            <input
                type={type}
                id={id}
                name={id}
                required={required}
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-300"
                placeholder={`Votre ${label.toLowerCase().replace(' *', '')}`}
            />
        )}
    </div>
);

const AltimmoContact = () => {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
    };

    const contactInfo = [
        {
            icon: MapPin,
            title: 'Adresse de l\'Agence',
            content: '24 Rue de Mfoa, Poto-poto\nDerrière Canal Olympia\nBrazzaville-Congo',
            gradient: 'from-blue-600 to-blue-500'
        },
        {
            icon: Mail,
            title: 'Email Professionnel',
            content: 'altimmo@altitudevision.agency',
            link: 'mailto:altimmo@altitudevision.agency',
            gradient: 'from-sky-600 to-blue-500'
        },
        {
            icon: Phone,
            title: 'Numéro de Téléphone',
            content: '+242 06 800 21 51',
            link: 'tel:+242068002151',
            gradient: 'from-indigo-600 to-blue-500'
        }
    ];

    return (
        <section id="contact-altimmo" className="py-16 sm:py-20 bg-gradient-to-b from-slate-50 to-white">
            <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                    variants={containerVariants}
                >
                    {/* Header */}
                    <motion.div variants={itemVariants} className="text-center mb-12 sm:mb-14">
                        <p className="text-xs sm:text-sm font-bold text-blue-600 uppercase tracking-wider mb-2">Contactez-nous</p>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                            Prenons Contact
                        </h2>
                        <div className="h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent w-24 mx-auto rounded-full mb-4"></div>
                        <p className="text-gray-600 text-base sm:text-lg font-light max-w-2xl mx-auto">
                            Notre équipe est à votre disposition pour répondre à toutes vos questions immobilières
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
                        
                        {/* Formulaire de Contact */}
                        <motion.div variants={itemVariants}>
                            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
                                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                                    <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500">
                                        <MessageSquare className="w-5 h-5 text-white" />
                                    </div>
                                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Envoyez-nous un Message</h3>
                                </div>
                                
                                <form className="space-y-5">
                                    <FormInput label="Nom complet" id="fullName" required />
                                    <FormInput label="Adresse Email" id="email" type="email" required />
                                    <FormInput label="Téléphone" id="phone" type="tel" />
                                    <FormInput label="Votre message" id="message" required isTextArea />

                                    <motion.button
                                        type="submit"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold text-base rounded-full shadow-lg hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300"
                                    >
                                        <Send className="w-5 h-5" />
                                        Envoyer le Message
                                    </motion.button>
                                </form>
                            </div>
                        </motion.div>

                        {/* Coordonnées de l'Agence */}
                        <motion.div variants={itemVariants} className="space-y-5">
                            <div className="mb-6 lg:mb-8">
                                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Nos Coordonnées</h3>
                                <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                                    N'hésitez pas à nous appeler ou à nous rendre visite. Notre équipe est disponible pour vous accompagner.
                                </p>
                            </div>

                            <div className="space-y-4">
                                {contactInfo.map((info, index) => (
                                    <motion.div
                                        key={index}
                                        variants={itemVariants}
                                        whileHover={{ scale: 1.02 }}
                                        className="group bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-blue-200 transition-all duration-300"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className={`p-3 rounded-xl bg-gradient-to-br ${info.gradient} group-hover:scale-110 transition-transform duration-300`}>
                                                <info.icon className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">
                                                    {info.title}
                                                </p>
                                                {info.link ? (
                                                    <a 
                                                        href={info.link}
                                                        className="text-blue-600 hover:text-blue-700 transition-colors text-sm sm:text-base font-medium break-all"
                                                    >
                                                        {info.content}
                                                    </a>
                                                ) : (
                                                    <p className="text-gray-600 text-sm sm:text-base leading-relaxed whitespace-pre-line">
                                                        {info.content}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Carte d'information supplémentaire */}
                            <motion.div
                                variants={itemVariants}
                                className="bg-gradient-to-br from-blue-50 to-sky-50 p-6 rounded-2xl border border-blue-100 mt-6"
                            >
                                <h4 className="font-bold text-gray-900 mb-2 text-base sm:text-lg">Horaires d'Ouverture</h4>
                                <div className="space-y-1 text-sm text-gray-600">
                                    <p className="flex justify-between">
                                        <span className="font-medium">Lundi - Vendredi</span>
                                        <span>8h00 - 18h00</span>
                                    </p>
                                    <p className="flex justify-between">
                                        <span className="font-medium">Samedi</span>
                                        <span>9h00 - 14h00</span>
                                    </p>
                                    <p className="flex justify-between">
                                        <span className="font-medium">Dimanche</span>
                                        <span className="text-red-500 font-medium">Fermé</span>
                                    </p>
                                </div>
                            </motion.div>
                        </motion.div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default AltimmoContact;