// __tests__/RentalOverviewComponents.test.jsx — Dette technique GL-B2
// (Mission 9). Tests des composants extraits de GestionLocativePage.jsx —
// aucun changement visuel attendu, juste la garantie qu'ils rendent les
// mêmes données.

import { render, screen, fireEvent } from '@testing-library/react';
import RentalStats from '../components/dashboard/RentalStats';
import TenantTable from '../components/dashboard/TenantTable';
import PaymentOverview from '../components/dashboard/PaymentOverview';
import NoticeOverview from '../components/dashboard/NoticeOverview';
import MaintenanceOverview from '../components/dashboard/MaintenanceOverview';
import DocumentOverview from '../components/dashboard/DocumentOverview';

const COLORS = { BLUE: '#2E7BB5', GREEN: '#16A34A', GOLD: '#C8960C', RED: '#D42B2B' };

describe('RentalStats — TEST DATA', () => {
  test.each([
    [1, 'Bien locatif éligible'],
    [2, 'Biens locatifs éligibles'],
  ])('décrit précisément le catalogue locatif éligible (%s)', (count, label) => {
    render(<RentalStats rentalStats={{ biensInscrits: count }} contratsActifs={0} loyersMensuel={0} onRefresh={() => {}} colors={COLORS} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText(/Bien(?:s)? inscrit/i)).not.toBeInTheDocument();
  });

  test('affiche les compteurs et le loyer mensuel, déclenche le rafraîchissement', () => {
    const onRefresh = vi.fn();
    render(<RentalStats
      rentalStats={{ total: 10, vacant: 2, published: 5, maintenance: 1, overduePayments: 3 }}
      contratsActifs={7} loyersMensuel={450000} onRefresh={onRefresh} colors={COLORS}
    />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText(/450\s?000/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(onRefresh).toHaveBeenCalled();
  });

  test('masque le bloc loyer mensuel si 0', () => {
    render(<RentalStats rentalStats={{}} contratsActifs={0} loyersMensuel={0} onRefresh={() => {}} colors={COLORS} />);
    expect(screen.queryByText('FCFA/mois')).not.toBeInTheDocument();
  });
});

describe('TenantTable — TEST DATA', () => {
  test('affiche le nombre de locataires actifs et lie vers la page dédiée', () => {
    render(<TenantTable count={12} colors={COLORS} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Locataires actifs')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/dashboard/gestion-locative/locataires');
  });
});

describe('PaymentOverview — TEST DATA', () => {
  test('affiche les montants calculés côté serveur', () => {
    render(<PaymentOverview paiementStats={{ totalAttendu: 300000, totalEncaisse: 150000, totalImpaye: 100000 }} colors={COLORS} />);
    expect(screen.getByText(/300\s?000/)).toBeInTheDocument();
    expect(screen.getByText(/150\s?000/)).toBeInTheDocument();
    expect(screen.getByText(/100\s?000/)).toBeInTheDocument();
  });

  test('affiche des tirets sans statistiques chargées', () => {
    render(<PaymentOverview paiementStats={null} colors={COLORS} />);
    expect(screen.getAllByText('—').length).toBe(3);
  });
});

describe('NoticeOverview — TEST DATA', () => {
  test('affiche le nombre de préavis actifs', () => {
    render(<NoticeOverview count={4} colors={COLORS} />);
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Préavis actifs')).toBeInTheDocument();
  });
});

describe('MaintenanceOverview — TEST DATA', () => {
  test('affiche les maintenances ouvertes et urgentes', () => {
    render(<MaintenanceOverview ouvertes={6} urgentes={2} colors={COLORS} />);
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Maintenances ouvertes')).toBeInTheDocument();
    expect(screen.getByText('Maintenances urgentes')).toBeInTheDocument();
  });
});

describe('DocumentOverview — TEST DATA', () => {
  test('affiche les documents récents avec type et date', () => {
    render(<DocumentOverview documents={[{ _id: 'D1', type: 'Facture', refNom: 'Jean Dupont', createdAt: '2026-08-01' }]} />);
    expect(screen.getByText(/Facture — Jean Dupont/)).toBeInTheDocument();
  });

  test('ne rend rien si la liste est vide', () => {
    const { container } = render(<DocumentOverview documents={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
