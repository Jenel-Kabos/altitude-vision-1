import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import PropertyForm from '../components/dashboard/PropertyForm';

// UX-OWNER-1 — non-régression du bug réel : le formulaire "Ajouter un bien"
// côté Owner (PropertyForm.jsx, rendu par OwnerPropertyManagement.jsx) ne
// remontait JAMAIS d'erreur de validation par champ — `errors` n'était ni
// construit ni transmis par l'appelant Owner, et les champs concernés
// portaient en plus un `required` HTML natif qui interceptait la soumission
// avant que React n'ait la moindre chance de s'exécuter (aucun message,
// aucun style cohérent avec les formulaires Admin SalePropertyForm.jsx/
// RentalPropertyForm.jsx, qui n'utilisent d'ailleurs aucun `required` natif).
// Corrigé en retirant ces `required` et en ajoutant un `validate()` réel côté
// appelant (OwnerPropertyManagement.jsx / ManagePropertiesPage.jsx pour la
// branche hébergement Admin) qui alimente ce même prop `errors`.

vi.mock('../components/dashboard/MapLeaflet', () => ({ default: () => <div>TEST DATA MAP</div> }));

const emptyFormData = () => ({
  title: '', description: '', price: '', pole: 'Altimmo',
  status: 'vente', availability: 'Disponible', type: 'Appartement',
  address: { street: '', neighborhood: '', arrondissement: '', city: 'Brazzaville' },
  surface: '', bedrooms: '', bathrooms: '', amenities: '',
  livingRooms: '', kitchens: '', constructionType: 'Non spécifié',
  cautionMultiplicateur: 2, profilsLocataireRecherches: [], documentsRequis: [],
  latitude: -4.266, longitude: 15.283, images: [],
});

// Harnais minimal reproduisant le contrat réel (formData/setFormData
// contrôlés par le parent, `existingImages` pré-rempli pour ne pas dépendre
// de la simulation d'un <input type="file"> en jsdom — hors périmètre de ce
// test, qui porte sur l'affichage des erreurs, pas sur l'upload).
const Harness = ({ errors, onSubmit }) => {
  const [formData, setFormData] = useState(emptyFormData());
  return (
    <PropertyForm
      formData={formData}
      setFormData={setFormData}
      existingImages={['http://example.com/existing.jpg']}
      setExistingImages={() => {}}
      onSubmit={onSubmit}
      loading={false}
      isEditing={false}
      errors={errors}
    />
  );
};

describe('PropertyForm — affichage des erreurs de validation par champ', () => {
  test('un `errors` rempli (comme le construit désormais OwnerPropertyManagement.jsx) affiche chaque message à côté du bon champ', () => {
    const errors = {
      title: 'Le titre est requis.',
      description: 'La description est requise.',
      price: 'Le prix doit être positif.',
      neighborhood: 'Le quartier est requis.',
      arrondissement: "L'arrondissement est requis.",
      surface: 'La surface est requise.',
    };
    render(<Harness errors={errors} onSubmit={vi.fn()} />);

    expect(screen.getByText('Le titre est requis.')).toBeInTheDocument();
    expect(screen.getByText('La description est requise.')).toBeInTheDocument();
    expect(screen.getByText('Le prix doit être positif.')).toBeInTheDocument();
    expect(screen.getByText('Le quartier est requis.')).toBeInTheDocument();
    expect(screen.getByText("L'arrondissement est requis.")).toBeInTheDocument();
    expect(screen.getByText('La surface est requise.')).toBeInTheDocument();
  });

  test('sans `errors` (état initial), aucun message d\'erreur ne s\'affiche', () => {
    render(<Harness errors={{}} onSubmit={vi.fn()} />);
    expect(screen.queryByText(/est requis|est requise|doit être positif/)).not.toBeInTheDocument();
  });

  test('les champs titre/description/prix/quartier n\'ont plus de validation HTML5 native bloquante (`required` retiré)', () => {
    render(<Harness errors={{}} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Titre du bien')).not.toBeRequired();
    expect(screen.getByLabelText('Description du bien')).not.toBeRequired();
    expect(screen.getByLabelText('Prix en FCFA')).not.toBeRequired();
    expect(screen.getByLabelText('Quartier')).not.toBeRequired();
  });

  test('la soumission du formulaire appelle bien le gestionnaire fourni (avec au moins une image existante)', () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(<Harness errors={{}} onSubmit={onSubmit} />);
    const submitBtn = screen.getByRole('button', { name: /Ajouter le bien/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
