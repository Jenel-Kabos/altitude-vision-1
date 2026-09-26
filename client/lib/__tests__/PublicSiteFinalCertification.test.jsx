import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import HomePageNext from '../pages/HomePageNext';
import ClientLayout, { isPublicSitePath } from '../../app/ClientLayout';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null, logout: vi.fn() }) }));
vi.mock('../services/unreadCountService', () => ({ getConversationsUnreadCount: vi.fn().mockResolvedValue(0) }));
vi.mock('../components/messaging/UnreadMessagesBadge', () => ({ default: () => null }));
vi.mock('../components/notifications/NotificationBell', () => ({ default: () => null }));
vi.mock('../components/CookieBanner', () => ({ default: () => null }));
vi.mock('../components/public/PublicMotion', () => ({
  MotionReveal: ({ children, as: Tag = 'div', ...props }) => <Tag {...props}>{children}</Tag>,
  MotionStagger: ({ children, as: Tag = 'div', ...props }) => <Tag {...props}>{children}</Tag>,
  MotionStaggerItem: ({ children, as: Tag = 'div', ...props }) => <Tag {...props}>{children}</Tag>,
  MotionImageReveal: ({ children, as: Tag = 'div', ...props }) => <Tag {...props}>{children}</Tag>,
}));
vi.mock('../components/Testimonials', () => ({ default: () => <section data-testid="trust-certification">Trust</section> }));

const source = (path) => readFileSync(resolve(path), 'utf8');

describe('FINAL — certification structurelle du site public', () => {
  test('FINAL-01/07/08/10/11/12 : la séquence canonique et les contenus certifiés restent intacts', () => {
    render(<HomePageNext />);
    const text = document.body.textContent;
    const homepageSource = source('lib/pages/HomePageNext.jsx');
    expect(homepageSource.indexOf('<HeroEcosystem')).toBeLessThan(homepageSource.indexOf('<IntentRouter'));
    expect(homepageSource.indexOf('<IntentRouter')).toBeLessThan(homepageSource.indexOf('<AltimmoDiscovery'));
    expect(homepageSource.indexOf('<FacebookFeed')).toBeLessThan(homepageSource.indexOf('<CtaCommission'));
    expect(text).toContain('Nos univers en images');
    expect(text).toMatch(/jusqu’à\s*30\s*% de notre commission/i);
    expect(text).toMatch(/de la commission Altitude Vision/i);
    expect(text).toMatch(/transaction éligible et finalisée/i);
    expect(text).not.toMatch(/200\+ familles|80\+ événements|98\s*% de clients/i);
  });

  test('FINAL-02/06/09/13/14/17 : navigation, périmètre public et destinations réelles restent stables', () => {
    render(<ClientLayout><p>Accueil public</p></ClientLayout>);
    expect(screen.getByRole('link', { name: 'Accueil' })).toHaveAttribute('href', '/');
    expect(screen.getByTestId('public-footer-premium')).toBeInTheDocument();
    expect(isPublicSitePath('/')).toBe(true);
    expect(isPublicSitePath('/dashboard')).toBe(false);
    expect(source('lib/components/layout/Footer.jsx')).not.toMatch(/href=["']\/(entreprises|plateforme|a-propos)["']/);
  });

  test('FINAL-15/16/18 : dashboard, reduced motion et dépendances backend restent hors du sprint', () => {
    const layout = source('app/ClientLayout.jsx');
    const motionCss = source('lib/components/public/PublicFoundation.module.css');
    expect(layout).toContain("pathname.startsWith('/dashboard')");
    expect(motionCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(source('lib/components/CookieBanner.jsx')).not.toMatch(/axios|\/api\/|fetch\s*\(/);
  });
});
