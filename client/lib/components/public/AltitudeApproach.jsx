import Link from 'next/link';
import EditorialMedia from './EditorialMedia';
import { editorialMedia } from '../../content/editorialMedia';
import styles from './AltitudeApproach.module.css';
import { MotionReveal, MotionStagger, MotionStaggerItem } from './PublicMotion';

// HOME-DESIGN-01 — l'écosystème Altitude Vision : trois pôles présentés par
// de vraies cartes photographiques (assets éditoriaux locaux). Le processus
// (du besoin à la réalisation) vit désormais uniquement dans AltitudeMethod,
// pour éviter la répétition entre les deux sections.
const poles = [
  {
    key: 'altimmo',
    name: 'Altimmo',
    domain: 'Immobilier & hébergement',
    description: 'Acheter, vendre, louer, gérer et séjourner.',
    cta: 'Découvrir Altimmo',
    href: '/immobilier',
    media: editorialMedia.altimmoFallback,
  },
  {
    key: 'altcom',
    name: 'Altcom',
    domain: 'Communication 360°',
    description: 'Stratégie, création, digital et production audiovisuelle.',
    cta: 'Découvrir Altcom',
    href: '/communication',
    media: editorialMedia.altcomStudio,
  },
  {
    key: 'mila',
    name: 'Mila Events',
    domain: 'Événementiel',
    description: 'Des événements pensés, organisés et vécus pleinement.',
    cta: 'Découvrir Mila Events',
    href: '/evenementiel',
    media: editorialMedia.milaEvent,
  },
];

export default function AltitudeApproach() {
  return (
    <section className={styles.section} data-testid="web07-about" aria-labelledby="web07-about-title">
      <div className={styles.container}>
        <MotionReveal className={styles.headingBlock} testId="motion-approach">
          <p className={styles.eyebrow}>Altitude Vision — Un écosystème, trois expertises</p>
          <h2 id="web07-about-title">
            Des métiers différents.<br />
            <em>Une vision commune.</em>
          </h2>
          <p className={styles.lede}>
            Altitude Vision réunit l’immobilier, la communication et l’événementiel&nbsp;: trois expertises complémentaires pour accompagner particuliers, entreprises et organisations dans leurs projets.
          </p>
        </MotionReveal>

        <MotionStagger as="ul" className={styles.poles}>
          {poles.map((pole) => (
            <MotionStaggerItem as="li" className={styles.pole} key={pole.key} testId={`web07-pole-${pole.key}`}>
              <EditorialMedia className={styles.poleImage} media={pole.media} />
              <div className={styles.poleBody}>
                <h3 className={styles.poleName}>{pole.name}</h3>
                <p className={styles.poleDomain}>{pole.domain}</p>
                <p className={styles.poleDescription}>{pole.description}</p>
                <Link className={styles.poleLink} href={pole.href}>
                  {pole.cta} <span aria-hidden="true">→</span>
                </Link>
              </div>
            </MotionStaggerItem>
          ))}
        </MotionStagger>
      </div>
    </section>
  );
}
