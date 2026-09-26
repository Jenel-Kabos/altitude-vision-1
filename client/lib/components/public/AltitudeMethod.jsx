import styles from './AltitudeMethod.module.css';
import { MotionReveal, MotionStagger, MotionStaggerItem } from './PublicMotion';

const points = [
  { number: '01', label: 'Un interlocuteur identifié à chaque étape' },
  { number: '02', label: 'Des étapes lisibles, du besoin à la livraison' },
  { number: '03', label: 'Des outils numériques pour coordonner, sans remplacer le contact humain' },
];

export default function AltitudeMethod() {
  return (
    <section className={styles.section} data-testid="web08-credibility" aria-labelledby="web08-credibility-title">
      <div className={styles.container}>
        <MotionReveal className={styles.headingBlock} testId="motion-method">
          <p className={styles.eyebrow}>Notre manière de faire</p>
          <h2 id="web08-credibility-title">
            Du besoin à la réalisation,<br />
            <em>un suivi clair à chaque étape.</em>
          </h2>
        </MotionReveal>

        <MotionStagger as="ol" className={styles.points}>
          {points.map((point) => (
            <MotionStaggerItem as="li" className={styles.point} key={point.number}>
              <span className={styles.pointNumber}>{point.number}</span>
              <span className={styles.pointLabel}>{point.label}</span>
            </MotionStaggerItem>
          ))}
        </MotionStagger>
      </div>
    </section>
  );
}
