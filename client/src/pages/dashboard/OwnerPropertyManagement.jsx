import React, { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "../../context/AuthContext"; // 🔑 Récupération du contexte

import {
	getMyProperties,
	createProperty,
	updateProperty,
	deleteProperty,
	getPropertyById,
} from "../../services/propertyService";
import PropertyForm from "../../components/dashboard/PropertyForm";

// ==============================================================================
// 1. Logique et États du Formulaire (Sub-composant d'ajout/édition)
// ==============================================================================

const initialFormData = () => ({
	title: "",
	description: "",
	price: "",
	pole: "Altimmo",
	status: "vente",
	availability: "Disponible",
	type: "Appartement",
	address: { street: "", district: "", city: "Brazzaville" },
	surface: "",
	bedrooms: "",
	bathrooms: "",
	amenities: "",
	latitude: -4.266,
	longitude: 15.283,
	images: [],
});

const PropertyManagementForm = ({
	propertyId,
	onSave,
	onCancel,
}) => {
	const isEditing = !!propertyId;
	const [formData, setFormData] = useState(initialFormData());
	const [existingImages, setExistingImages] = useState([]);
	const [loading, setLoading] = useState(false);

	// Charger les données pour l'édition
	useEffect(() => {
		if (isEditing) {
			const fetchProperty = async () => {
				setLoading(true);
				try {
					const property = await getPropertyById(propertyId);
					setFormData({
						...initialFormData(),
						...property,
						address: {
							district: property.address?.district || property.address_district || "",
							street: property.address?.street || property.address_street || "",
							city: property.address?.city || property.address_city || "Brazzaville",
						},
						amenities: property.amenities ? property.amenities.join(", ") : "",
						latitude: property.location?.coordinates[1] || -4.266,
						longitude: property.location?.coordinates[0] || 15.283,
						images: [],
					});
					setExistingImages(property.images || []);
				} catch (error) {
					console.error("Erreur de chargement du bien:", error);
					toast.error("Erreur lors du chargement des données du bien.");
					onCancel();
				} finally {
					setLoading(false);
				}
			};
			fetchProperty();
		} else {
			setFormData(initialFormData());
			setExistingImages([]);
		}
	}, [propertyId, isEditing, onCancel]);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);

		try {
			const data = new FormData();
			const { address, amenities, images, ...otherFields } = formData;

			// 1. Champs principaux
			Object.entries(otherFields).forEach(([k, v]) => v !== "" && data.append(k, v));

			// 2. Adresse
			data.append("address[street]", address.street);
			data.append("address[district]", address.district);
			data.append("address[city]", address.city);

			// 3. Équipements
			amenities.split(",").map(a => a.trim()).filter(Boolean).forEach(a => data.append("amenities", a));

			// 4. Géolocalisation
			data.append("location", JSON.stringify({
				type: "Point",
				coordinates: [formData.longitude, formData.latitude]
			}));

			// 5. Images (Nouveaux fichiers)
			images.forEach(file => data.append("images", file));

			let result;
			if (isEditing) {
				// 6. Si MISE A JOUR
				existingImages.forEach(url => data.append("existingImages", url));
				result = await updateProperty(propertyId, data);
				toast.success("Bien mis à jour !");
			} else {
				// 6. Si CRÉATION
				result = await createProperty(data);
				toast.success("Bien ajouté avec succès !");
			}

			onSave(result, isEditing);

		} catch (error) {
			console.error(error);
			const errorMessage = error.response?.data?.message || error.message || "Erreur lors de la sauvegarde.";
			toast.error(errorMessage);
		} finally {
			setLoading(false);
		}
	};

	if (isEditing && loading) return <p className="text-center mt-10">Chargement des données du bien...</p>;

	return (
		<div className="mb-8 border p-4 rounded bg-gray-50">
			<h3 className="text-xl font-semibold mb-4">{isEditing ? "Modifier le bien" : "Ajouter un nouveau bien"}</h3>
			<PropertyForm
				formData={formData}
				setFormData={setFormData}
				existingImages={existingImages}
				setExistingImages={setExistingImages}
				onSubmit={handleSubmit}
				loading={loading}
				isEditing={isEditing}
			/>
			<button
				onClick={onCancel}
				className="mt-4 text-gray-600 hover:underline"
			>
				← Annuler / Retour à la liste
			</button>
		</div>
	);
};

// ==============================================================================
// 2. Logique de Gestion Principale
// ==============================================================================

const OwnerPropertyManagement = () => {
	// 🔑 Récupération de l'utilisateur et de l'état de chargement du contexte
	const { user, loading: authLoading } = useAuth(); 

	const [properties, setProperties] = useState([]);
	const [loadingList, setLoadingList] = useState(false);
	const [currentView, setCurrentView] = useState("list");
	const [editingPropertyId, setEditingPropertyId] = useState(null);

	const fetchProperties = useCallback(async () => {
		// Arrêter l'appel si l'utilisateur n'est pas encore chargé/valide
		if (!user) return; 

		try {
			setLoadingList(true);
			const res = await getMyProperties();
			setProperties(res);
		} catch (error) {
			console.error("Erreur lors de la récupération de 'mes propriétés' :", error);
			// L'intercepteur gère déjà le 401. Ici, on affiche juste l'erreur
			toast.error("Erreur lors du chargement des biens.");
		} finally {
			setLoadingList(false);
		}
	}, [user]); 

	// 🔑 MODIFICATION CLÉ : Utiliser l'état de chargement du contexte
	useEffect(() => {
		// ⭐ CONDITION CRITIQUE : Ne faire le fetch que si le contexte est chargé (authLoading === false) 
		// et si un utilisateur avec un ID est présent.
		if (!authLoading && user?._id && currentView === "list") {
			fetchProperties();
		}
	// Dépendance : currentView, l'ID utilisateur (stable), et l'état de chargement du contexte.
	}, [currentView, user?._id, authLoading]); 

	const handleDelete = async (id) => {
		if (!window.confirm("Voulez-vous vraiment supprimer ce bien ?")) return;
		try {
			await deleteProperty(id);
			toast.success("Bien supprimé !");
			setProperties(properties.filter((p) => p._id !== id));
		} catch (error) {
			console.error(error);
			toast.error("Erreur lors de la suppression.");
		}
	};

	const handleEditClick = (propertyId) => {
		setEditingPropertyId(propertyId);
		setCurrentView("edit");
	};

	const handleFormSave = (savedProperty, isUpdate) => {
		if (isUpdate) {
			setProperties(properties.map(p => p._id === savedProperty._id ? savedProperty : p));
		} else {
			setProperties([savedProperty, ...properties]);
		}
		setEditingPropertyId(null);
		setCurrentView("list");
	};

	const handleFormCancel = () => {
		setEditingPropertyId(null);
		setCurrentView("list");
	};

	// 🔑 Gérer l'état de chargement initial du contexte
	if (authLoading) {
		return <p className="text-center mt-10 text-gray-700 animate-pulse">Vérification de l'authentification...</p>;
	}

	if (loadingList && currentView === "list" && properties.length === 0) {
		return <p className="text-center mt-10">Chargement de la liste...</p>;
	}

	return (
		<div className="max-w-5xl mx-auto p-6 bg-white rounded shadow-md">
			<h2 className="text-2xl font-bold mb-6">Gestion de vos Biens Immobiliers</h2>

			{(currentView === "add" || currentView === "edit") && (
				<PropertyManagementForm
					propertyId={editingPropertyId}
					onSave={handleFormSave}
					onCancel={handleFormCancel}
				/>
			)}

			{currentView === "list" && (
				<>
					<div className="mb-6">
						<button
							onClick={() => setCurrentView("add")}
							className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
						>
							➕ Ajouter un nouveau bien
						</button>
					</div>

					{properties.length === 0 && !loadingList ? (
						<p>Aucun bien disponible.</p>
					) : (
						<div className="space-y-4">
							{properties.map((property) => (
								<div key={property._id} className="border p-4 rounded shadow-sm bg-white">
									<h3 className="text-xl font-semibold text-blue-800">{property.title}</h3>
									<p className="text-sm text-gray-600 mb-2">
										Prix : **{property.price.toLocaleString()} FCFA** | Statut : {property.status}
									</p>
									<p className="text-sm">Adresse : {property.address_district}, {property.address_street}, {property.address_city}</p>
									<div className="flex gap-2 mt-3">
										<button
											onClick={() => handleEditClick(property._id)}
											className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 transition"
										>
											Modifier
										</button>
										<button
											onClick={() => handleDelete(property._id)}
											className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition"
										>
											Supprimer
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</>
			)}
		</div>
	);
};

export default OwnerPropertyManagement;