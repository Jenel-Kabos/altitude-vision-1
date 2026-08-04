import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddManagedPropertyModal } from '../pages/dashboard/GestionLocativePage';
import * as service from '../services/gestionLocativeService';

vi.mock('../services/gestionLocativeService', async () => ({
  ...(await vi.importActual('../services/gestionLocativeService')),
  getRentalOnboardingOptions: vi.fn(), onboardRentalProperty: vi.fn(),
}));

describe('Ajouter un bien à la gestion locative',()=>{
  beforeEach(()=>{ vi.clearAllMocks(); service.getRentalOnboardingOptions.mockResolvedValue({properties:[{_id:'p1',title:'Bien privé',address:{city:'Brazzaville'},price:100000}],owners:[{_id:'o1',name:'Propriétaire Test'}]}); });
  test('affiche les deux parcours et protège le double clic',async()=>{ service.onboardRentalProperty.mockResolvedValue({property:{_id:'p1'},rental:{_id:'r1'}}); const onSuccess=vi.fn(); render(<AddManagedPropertyModal onClose={()=>{}} onSuccess={onSuccess} toast={()=>{}}/>); await screen.findByText(/Bien privé/); fireEvent.change(screen.getByRole('combobox'),{target:{value:'p1'}}); const submit=screen.getByRole('button',{name:'Ajouter le bien'}); fireEvent.click(submit); fireEvent.click(submit); await waitFor(()=>expect(service.onboardRentalProperty).toHaveBeenCalledTimes(1)); expect(onSuccess).toHaveBeenCalled(); });
  test('valide les champs du nouveau bien',async()=>{ render(<AddManagedPropertyModal onClose={()=>{}} onSuccess={()=>{}} toast={()=>{}}/>); await screen.findByText(/Bien privé/); fireEvent.click(screen.getByRole('button',{name:/Créer un nouveau bien géré/})); fireEvent.click(screen.getByRole('button',{name:'Ajouter le bien'})); expect(service.onboardRentalProperty).not.toHaveBeenCalled(); });
});
