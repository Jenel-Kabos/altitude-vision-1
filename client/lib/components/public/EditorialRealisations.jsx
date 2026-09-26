import Link from 'next/link';
import EditorialMedia from './EditorialMedia';
import { editorialMedia } from '../../content/editorialMedia';
import { MotionReveal, MotionStagger, MotionStaggerItem } from './PublicMotion';
import styles from './EditorialRealisations.module.css';

const universes = [
  {
    name: 'Altimmo',
    discipline: 'Immobilier & hébergement',
    media: editorialMedia.realisationsAltimmo,
    className: styles.altimmo,
    href: '/immobilier',
  },
  {
    name: 'Altcom',
    discipline: 'Communication & création',
    media: editorialMedia.realisationsAltcom,
    className: styles.altcom,
    href: '/communication#portfolio',
  },
  {
    name: 'Mila Events',
    discipline: 'Événementiel & expériences',
    media: editorialMedia.realisationsMila,
    className: styles.mila,
    href: '/evenementiel#realisations',
  },
];

// Lorsque les médias temporaires seront remplacés par des projets Altitude
// Vision, remettre ici uniquement : « Nos réalisations ».
const GALLERY_TITLE = 'Nos univers en images';

export default function EditorialRealisations() {
  return (
    <section className={styles.section} data-testid="realisations-editorial" aria-labelledby="realisations-title">
      <div className={styles.container}>
        <MotionReveal as="header" className={styles.headingBlock} testId="motion-realisations">
          <p className={styles.eyebrow}>Altitude Vision — En images</p>
          <h2 id="realisations-title">{GALLERY_TITLE}</h2>
          <p>
            Des lieux que l’on découvre. Des marques que l’on fait vivre.
            Des moments que l’on transforme en souvenirs.
          </p>
        </MotionReveal>

        <MotionStagger className={styles.composition}>
          {universes.map((universe) => (
            <MotionStaggerItem as="article" className={`${styles.universe} ${universe.className}`} key={universe.name}>
              <Link href={universe.href} aria-label={`Découvrir ${universe.name}`}>
                <EditorialMedia className={styles.image} media={universe.media} />
                <div className={styles.caption}>
                  <strong>{universe.name}</strong>
                  <span>{universe.discipline}</span>
                  <small>Découvrir l’univers →</small>
                </div>
              </Link>
            </MotionStaggerItem>
          ))}
        </MotionStagger>
      </div>
    </section>
  );
}
