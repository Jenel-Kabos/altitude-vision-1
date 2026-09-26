import Link from 'next/link';
import styles from './AltitudeApproach.module.css';
import { MotionReveal, MotionStagger, MotionStaggerItem } from './PublicMotion';

const principles = [
  { number: '01', label: 'Comprendre le besoin' },
  { number: '02', label: 'Coordonner les expertises' },
  { number: '03', label: 'Transformer l’idée en réalisation' },
];

export default function AltitudeApproach() {
  return (
    <section className={styles.section} data-testid="web07-about" aria-labelledby="web07-about-title">
      <div className={styles.container}>
        <MotionReveal className={styles.headingBlock} testId="motion-approach">
          <p className={styles.eyebrow}>Altitude Vision — Notre approche</p>
          <h2 id="web07-about-title">
            Des métiers différents.<br />
            <em>Une vision commune.</em>
          </h2>
          <p className={styles.lede}>
            Altitude Vision réunit l’immobilier, la communication et l’événementiel autour de projets qui demandent plus qu’un seul métier. Chaque pôle garde son expertise&nbsp;; ensemble, ils avancent dans la même direction.
          </p>
        </MotionReveal>

        <div className={styles.fieldPanel}>
          <p className={styles.fieldPanelKicker}>Terrain &amp; coordination</p>
          <p className={styles.fieldPanelText}>
            Des équipes sur le terrain, des outils numériques pour coordonner&nbsp;: l’expertise humaine reste au centre, la plateforme organise le travail entre les pôles.
          </p>
        </div>

        <MotionStagger as="ol" className={styles.principles}>
          {principles.map((principle) => (
            <MotionStaggerItem as="li" className={styles.principle} key={principle.number}>
              <span className={styles.principleNumber}>{principle.number}</span>
              <span className={styles.principleLabel}>{principle.label}</span>
            </MotionStaggerItem>
          ))}
        </MotionStagger>

        <div className={styles.footerRow}>
          <p>Un seul interlocuteur, plusieurs métiers.</p>
          <Link className={styles.primaryLink} href="/contact">
            Nous contacter <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
