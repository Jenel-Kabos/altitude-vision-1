import { render, screen } from '@testing-library/react';
import DashboardBadge from '../components/dashboard/DashboardBadge';

describe('DashboardBadge', () => {
  test('masque le badge à zéro', () => {
    const { container } = render(<DashboardBadge count={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('affiche le compteur exact jusqu’à 99', () => {
    render(<DashboardBadge count={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  test('borne les grands compteurs', () => {
    render(<DashboardBadge count={105} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });
});
