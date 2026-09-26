'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react';
import { FaFacebookF, FaInstagram, FaWhatsapp } from 'react-icons/fa';
import styles from './Footer.module.css';

const BUSINESS_UNITS = [
  { href: '/immobilier', name: 'Altimmo', discipline: 'Immobilier', tone: 'altimmo' },
  { href: '/communication', name: 'Altcom', discipline: 'Communication', tone: 'altcom' },
  { href: '/evenementiel', name: 'Mila Events', discipline: 'Événementiel', tone: 'mila' },
];

const USEFUL_LINKS = [
  { href: '/contact', label: 'Contact' },
  { href: '/actualites', label: 'Actualités' },
  { href: '/trouve-ta-commission', label: 'Ma Commission — Apporteur d’affaires' },
  { href: '/signaler-un-litige', label: 'Signaler un problème' },
];

const LEGAL_LINKS = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/politique-confidentialite', label: 'Confidentialité' },
];

const SOCIAL_LINKS = [
  { href: 'https://www.facebook.com/profile.php?id=61558493665509', label: 'Facebook', Icon: FaFacebookF },
  { href: 'https://www.instagram.com/immoaltitudevision/', label: 'Instagram', Icon: FaInstagram },
  { href: 'https://wa.me/242068002151', label: 'WhatsApp', Icon: FaWhatsapp },
];

const currentYear = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className={styles.footer} data-testid="public-footer-premium" aria-label="Pied de page Altitude Vision">
      <div className={styles.container}>
        <div className={styles.primaryGrid}>
          <section className={styles.brand} aria-labelledby="footer-brand-statement">
            <Link className={styles.logoLink} href="/" aria-label="Accueil Altitude-Vision">
              <Image
                className={styles.logo}
                src="/images/Logo_Altitude_Vision.png"
                alt="Altitude Vision — Agence de Communication & Courtage"
                width={220}
                height={220}
              />
            </Link>
            <p className={styles.kicker}>Maison de services · Brazzaville</p>
            <h2 className={styles.statement} id="footer-brand-statement">
              Trois métiers,{' '}
              <span>une même exigence.</span>
            </h2>
            <p className={styles.description}>
              Immobilier, communication et événementiel réunis dans une vision claire et un accompagnement attentif.
            </p>
          </section>

          <div className={styles.directory}>
            <nav className={styles.businessNav} aria-label="Les métiers Altitude Vision">
              <p className={styles.label}>Nos métiers</p>
              <ul className={styles.businessList}>
                {BUSINESS_UNITS.map(({ href, name, discipline, tone }) => (
                  <li key={href}>
                    <Link className={`${styles.businessLink} ${styles[tone]}`} href={href}>
                      <span>
                        <strong>{name}</strong>
                        <small>{discipline}</small>
                      </span>
                      <ArrowUpRight size={17} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className={styles.utilityGrid}>
              <nav aria-label="Navigation utile">
                <p className={styles.label}>Explorer</p>
                <ul className={styles.linkList}>
                  {USEFUL_LINKS.map(({ href, label }) => (
                    <li key={href}><Link href={href}>{label}</Link></li>
                  ))}
                </ul>
              </nav>

              <section className={styles.contact} aria-labelledby="footer-contact-title">
                <p className={styles.label} id="footer-contact-title">Nous trouver</p>
                <address>
                  <div className={styles.addressLine}>
                    <MapPin size={16} aria-hidden="true" />
                    <span>Rue Mfoa n°24, Poto-Poto<br />Derrière Canal Olympia<br />Brazzaville, Congo</span>
                  </div>
                  <a href="mailto:contact@altitudevision.agency"><Mail size={16} aria-hidden="true" />contact@altitudevision.agency</a>
                  <a href="tel:+242068002151"><Phone size={16} aria-hidden="true" />+242 06 800 21 51</a>
                </address>
              </section>
            </div>
          </div>
        </div>

        <div className={styles.closingBar}>
          <p>© {currentYear} Altitude Vision. Tous droits réservés.</p>
          <nav className={styles.legal} aria-label="Informations légales">
            {LEGAL_LINKS.map(({ href, label }) => <Link href={href} key={href}>{label}</Link>)}
          </nav>
          <div className={styles.socials} aria-label="Réseaux sociaux">
            {SOCIAL_LINKS.map(({ href, label, Icon }) => (
              <a href={href} key={label} target="_blank" rel="noopener noreferrer" aria-label={label}>
                <Icon aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
