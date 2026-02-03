import React from 'react';
import { motion } from 'framer-motion';
import { Send, ArrowRight } from 'lucide-react'; 
import { useNavigate } from 'react-router-dom'; 

/**
 * Composant de carte pour afficher un service Altcom - Version Modernisée
 * Gestion optimisée des marges, espacements et typographie
 * @param {object} service - L'objet service contenant _id, title, description, icon, color
 * @param {function} onQuoteRequest - Fonction pour ouvrir la modale de devis
 */
const ServiceCard = ({ service, onQuoteRequest }) => {
	const navigate = useNavigate();
	
	const baseColorClass = service.color || "text-gray-500";
	const bgColorClass = baseColorClass.replace('text-', 'bg-').replace('-500', '-100');
	const IconComponent = service.icon; 

	const handleDetailsClick = (e) => {
		e.preventDefault();
		navigate(`/altcom/service/${service._id}`);
	};

	return (
		<motion.div
			initial={{ scale: 1 }}
			whileHover={{ scale: 1.02, y: -4 }}
			transition={{ type: "spring", stiffness: 400, damping: 25 }}
			className="group bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-blue-200 flex flex-col h-full"
		>
			{/* Gradient décoratif en haut */}
			<div className="h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 group-hover:h-2 transition-all duration-300" />
			
			{/* Contenu de la carte */}
			<div className="flex flex-col items-center text-center p-6 sm:p-8 flex-1">
				
				{/* Bloc Icône avec animation */}
				<motion.div 
					whileHover={{ rotate: 5, scale: 1.1 }}
					transition={{ type: "spring", stiffness: 300 }}
					className={`p-4 sm:p-5 rounded-2xl mb-5 ${bgColorClass} group-hover:shadow-lg transition-shadow duration-300`}
				>
					{IconComponent && (
						<IconComponent className={`w-8 h-8 sm:w-10 sm:h-10 ${baseColorClass}`} />
					)}
				</motion.div>
				
				{/* Titre */}
				<h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 leading-tight group-hover:text-blue-600 transition-colors duration-300">
					{service.title}
				</h3>
				
				{/* Description */}
				<p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-6 flex-1 line-clamp-3">
					{service.description}
				</p>
				
				{/* Boutons d'action */}
				<div className="w-full space-y-3 mt-auto">
					{/* Bouton Devis Principal */}
					<motion.button 
						whileHover={{ scale: 1.03 }}
						whileTap={{ scale: 0.98 }}
						onClick={() => onQuoteRequest(service.title)}
						className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold py-3 sm:py-3.5 px-5 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-blue-500/30 text-sm sm:text-base flex items-center justify-center gap-2 group/btn"
					>
						<Send className="w-4 h-4 sm:w-5 sm:h-5 group-hover/btn:translate-x-0.5 transition-transform" />
						Demander un Devis
					</motion.button>
					
					{/* Lien Détails Secondaire */}
					<a 
						href={`/altcom/service/${service._id}`} 
						onClick={handleDetailsClick}
						className="inline-flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-xs sm:text-sm transition-all duration-200 group/link"
					>
						<span>Détails du Service</span>
						<ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover/link:translate-x-1 transition-transform" />
					</a>
				</div>
			</div>
		</motion.div>
	);
};

export default ServiceCard;