import Link from 'next/link';
import EditorialMedia from './EditorialMedia';
import { editorialMedia } from '../../content/editorialMedia';
import { MotionImageReveal, MotionReveal, MotionStagger, MotionStaggerItem } from './PublicMotion';
import styles from './AltcomDiscovery.module.css';

const expertiseLinks = [
  {
    number: '01',
    label: 'Communication 360°',
    detail: 'Stratégie, conseil et déploiement',
    href: '/communication/conseil-strategie',
  },
  {
    number: '02',
    label: 'Branding & design',
    detail: 'Identité, direction artistique et supports',
    href: '/communication/branding-design',
  },
  {
    number: '03',
    label: 'Studio & contenus',
    detail: 'Photo, vidéo et couverture médiatique',
    href: '/communication/couverture-mediatique',
  },
];

export default function AltcomDiscovery() {
  return (
    <section className={styles.section} data-testid="altcom-discovery" aria-labelledby="altcom-discovery-title">
      <div className={styles.container}>
        <MotionReveal className={styles.headingBlock} testId="motion-altcom">
          <p className={styles.eyebrow}>Altcom — Communication</p>
          <h2 id="altcom-discovery-title">
            Votre entreprise mérite une communication<br />
            <em>à la hauteur de ses ambitions.</em>
          </h2>
          <p className={styles.intro}>
            Stratégie, image, contenu et communication digitale&nbsp;: Altcom transforme vos idées en une expression claire et cohérente.
          </p>
        </MotionReveal>

        <MotionImageReveal as="figure" className={styles.manifesto} testId="altcom-editorial-media">
          <EditorialMedia className={styles.manifestoImage} media={editorialMedia.altcomStudio} />
          <figcaption>
            <span className={styles.manifestoIndex}>A / C</span>
            <p>Penser juste.<br />Créer distinct.<br />Communiquer mieux.</p>
            <span className={styles.manifestoWord}>altcom</span>
          </figcaption>
        </MotionImageReveal>

        <MotionStagger as="nav" className={styles.expertises} aria-label="Expertises Altcom">
          {expertiseLinks.map((expertise) => (
            <MotionStaggerItem as={Link} className={styles.expertiseLink} href={expertise.href} key={expertise.href}>
              <span className={styles.expertiseNumber}>{expertise.number}</span>
              <span className={styles.expertiseCopy}>
                <strong>{expertise.label}</strong>
                <small>{expertise.detail}</small>
              </span>
              <span className={styles.expertiseArrow} aria-hidden="true">↗</span>
            </MotionStaggerItem>
          ))}
        </MotionStagger>

        <div className={styles.footerRow}>
          <p>De la première idée à sa mise en lumière.</p>
          <div className={styles.commercialLinks}>
            <Link className={styles.primaryLink} href="/communication#portfolio">Voir nos réalisations <span aria-hidden="true">→</span></Link>
            <Link className={styles.secondaryLink} href="/communication?openQuoteModal=true">Demander un devis <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
