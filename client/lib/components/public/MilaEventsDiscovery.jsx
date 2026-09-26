import Link from 'next/link';
import EditorialMedia from './EditorialMedia';
import { editorialMedia } from '../../content/editorialMedia';
import { MotionImageReveal, MotionReveal, MotionStagger, MotionStaggerItem } from './PublicMotion';
import styles from './MilaEventsDiscovery.module.css';

const experiences = [
  'Mariages & célébrations',
  'Événements corporate',
  'Scénographie & coordination',
];

export default function MilaEventsDiscovery() {
  return (
    <section className={styles.section} data-testid="mila-events-discovery" aria-labelledby="mila-events-discovery-title">
      <div className={styles.container}>
        <MotionReveal className={styles.headingBlock} testId="motion-mila">
          <p className={styles.eyebrow}>Mila Events — Événementiel</p>
          <h2 id="mila-events-discovery-title">
            Vos moments méritent{' '}
            <em>une mise en scène inoubliable.</em>
          </h2>
        </MotionReveal>

        <MotionImageReveal as="figure" className={styles.media} delay={0.08} testId="mila-editorial-media">
          <EditorialMedia className={styles.mediaImage} media={editorialMedia.milaScenography} />
          <figcaption>
            <span>La lumière, l’espace, le rythme.</span>
            <small>Photographie éditoriale temporaire</small>
          </figcaption>
        </MotionImageReveal>

        <div className={styles.story}>
          <p className={styles.intro}>
            Mariages, galas, conférences et célébrations&nbsp;: nous imaginons des expériences où chaque détail participe à l’émotion.
          </p>

          <MotionStagger as="ul" className={styles.experiences} aria-label="Expériences conçues par Mila Events">
            {experiences.map((experience, index) => (
              <MotionStaggerItem as="li" className={styles.experience} key={experience}>
                <span aria-hidden="true">0{index + 1}</span>
                {experience}
              </MotionStaggerItem>
            ))}
          </MotionStagger>

          <p className={styles.signature}>De l’intention à l’instant vécu.</p>

          <div className={styles.commercialLinks}>
            <Link className={styles.primaryLink} href="/evenementiel?openQuoteModal=true">Imaginer mon événement <span aria-hidden="true">↗</span></Link>
            <Link className={styles.secondaryLink} href="/evenementiel#realisations">Voir nos réalisations <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
