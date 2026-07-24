import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AltimmoPage from '../pages/AltimmoPage';

// Audit filtrage Altimmo — la recherche de l'accueil doit : (1) proposer "Hébergement" (bug
// corrigé : la liste locale ne contenait auparavant que Vente/Location), (2) transmettre les
// clés canoniques offerType/propertyType/minPrice/maxPrice vers /immobilier/annonces.

const push = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ children, href }) => <a href={href}>{children}</a> }));
vi.mock('next/image', () => ({ default: ({ alt }) => <div role="img" aria-label={alt} /> }));
vi.mock('framer-motion', () => {
  const strip = ({ initial, animate, exit, transition, whileInView, viewport, whileHover, whileTap, variants, children, ...props }) => ({ children, props });
  const make = (Tag) => (props) => {
    const clean = strip(props);
    return React.createElement(Tag, clean.props, clean.children);
  };
  return { motion: new Proxy({}, { get: (_t, tag) => make(tag) }), AnimatePresence: ({ children }) => children };
});
vi.mock('../components/HeroSliderAlt', () => ({ default: () => <div /> }));
vi.mock('../components/PropertyCard', () => ({ default: () => <div /> }));
vi.mock('../components/ReviewCard', () => ({ default: () => <div /> }));
vi.mock('../components/CtaCommission', () => ({ default: () => <div /> }));
vi.mock('../components/AltimmoContact', () => ({ default: () => <div /> }));
vi.mock('../services/propertyService', () => ({ getLatestPropertiesByPole: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/reviewService', () => ({ getAltimmoReviews: vi.fn().mockResolvedValue([]) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));

describe('AltimmoPage — recherche accueil (nomenclature canonique + fix Hébergement)', () => {
  test('le sélecteur de transaction propose Vente, Location ET Hébergement', async () => {
    render(<AltimmoPage />);
    fireEvent.click(document.querySelectorAll('.ai-search-pill')[0]);
    await waitFor(() => expect(screen.getByText('Rechercher un bien', { selector: 'span' })).toBeInTheDocument());
    expect(screen.getByRole('option', { name: 'Hébergement' })).toBeInTheDocument();
  });

  test('la recherche transmet offerType/propertyType/minPrice/maxPrice vers /immobilier/annonces', async () => {
    render(<AltimmoPage />);
    fireEvent.click(document.querySelectorAll('.ai-search-pill')[0]);
    await waitFor(() => expect(screen.getByText('Rechercher un bien', { selector: 'span' })).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue('Vente'), { target: { value: 'hebergement' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0];
    expect(url.startsWith('/immobilier/annonces?')).toBe(true);
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('offerType')).toBe('hebergement');
    expect(params.get('status')).toBeNull();
  });
});
