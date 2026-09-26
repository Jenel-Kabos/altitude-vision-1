'use client';

import Link from 'next/link';
import { MotionImageReveal, MotionReveal, MotionStagger, MotionStaggerItem } from './PublicMotion';
import styles from './AltimmoAppShowcase.module.css';

const capabilities = [
  {
    number: '01',
    title: 'Découvrir',
    copy: 'Des biens sélectionnés pour acheter, louer ou séjourner.',
  },
  {
    number: '02',
    title: 'Localiser',
    copy: 'Explorez les opportunités immobilières directement sur la carte.',
  },
  {
    number: '03',
    title: 'Gérer / Réserver',
    copy: 'Retrouvez les détails d’un bien ou réservez une expérience d’hébergement.',
  },
];

const devices = [
  {
    className: 'primaryDevice',
    src: '/images/altimmo-app/altimmo-home.webp',
    alt: 'Écran d’accueil Altimmo avec la recherche et les biens recommandés',
    caption: 'Accueil / Annonces',
    width: 540,
    height: 1048,
  },
  {
    className: 'mapDevice',
    src: '/images/altimmo-app/altimmo-map.webp',
    alt: 'Carte Altimmo des biens à Brazzaville avec le quartier Moungali sélectionné',
    caption: 'Carte des biens',
    width: 540,
    height: 906,
  },
  {
    className: 'hotelDevice',
    src: '/images/altimmo-app/altimmo-mila-hotel.webp',
    alt: 'Fiche Mila Hotel dans l’application Altimmo avec le choix d’une chambre',
    caption: 'Mila Hotel',
    width: 540,
    height: 1048,
  },
];

export default function AltimmoAppShowcase() {
  return (
    <section className={styles.section} data-testid="altimmo-app-showcase" aria-labelledby="altimmo-app-title">
      <div className={styles.container}>
        <div className={styles.editorial}>
          <MotionReveal as="header" className={styles.headingBlock} testId="motion-altimmo-app-heading">
            <div className={styles.brandLine}>
              <img
                className={styles.appIcon}
                src="/images/altimmo-app/altimmo-app-icon.webp"
                alt=""
                aria-hidden="true"
                width="320"
                height="320"
              />
              <p className={styles.eyebrow}>Altimmo — L’application</p>
            </div>
            <h2 id="altimmo-app-title">L’immobilier,<br />{' '}désormais dans votre poche.</h2>
            <p className={styles.lede}>
              Recherchez un bien, situez les opportunités et accédez aux expériences
              Altimmo depuis une application pensée pour l’immobilier au quotidien.
            </p>
          </MotionReveal>

          <MotionStagger as="ol" className={styles.capabilities} aria-label="Fonctionnalités de l’application Altimmo">
            {capabilities.map((capability) => (
              <MotionStaggerItem as="li" className={styles.capability} key={capability.number}>
                <span className={styles.number}>{capability.number}</span>
                <div>
                  <h3>{capability.title}</h3>
                  <p>{capability.copy}</p>
                </div>
              </MotionStaggerItem>
            ))}
          </MotionStagger>

          <MotionReveal className={styles.actions}>
            <Link className={styles.primaryCta} href="/altimmo/application">
              Découvrir l’application <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.secondaryCta} href="/immobilier/annonces">
              Voir les annonces <span aria-hidden="true">→</span>
            </Link>
          </MotionReveal>
        </div>

        <div className={styles.devices} aria-label="Aperçus réels de l’application Altimmo">
          {devices.map((device, index) => (
            <MotionImageReveal
              as="figure"
              className={`${styles.device} ${styles[device.className]}`}
              delay={index * 0.08}
              key={device.src}
            >
              <div className={styles.deviceFrame}>
                <img
                  src={device.src}
                  alt={device.alt}
                  width={device.width}
                  height={device.height}
                  loading="lazy"
                />
              </div>
              <figcaption>{device.caption}</figcaption>
            </MotionImageReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
