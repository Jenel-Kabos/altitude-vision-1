import styles from './AltitudeTrust.module.css';
import { MotionReveal, MotionStagger, MotionStaggerItem } from './PublicMotion';

const principles = [
  {
    number: '01',
    label: 'Clarté',
    text: 'Un langage clair, sans jargon ni promesse vague.',
  },
  {
    number: '02',
    label: 'Rigueur',
    text: 'La même exigence appliquée du premier échange à la remise finale.',
  },
  {
    number: '03',
    label: 'Cohérence',
    text: 'Les mêmes standards, quel que soit le pôle sollicité.',
  },
];

export default function AltitudeTrust() {
  return (
    <section className={styles.section} data-testid="web11-trust" aria-labelledby="web11-trust-title">
      <div className={styles.container}>
        <MotionReveal className={styles.headingBlock} testId="motion-trust">
          <p className={styles.eyebrow}>Ce qui nous guide</p>
          <h2 id="web11-trust-title">
            Clarté dans l’échange.<br />
            <em>Exigence dans l’exécution.</em>
          </h2>
        </MotionReveal>

        <MotionStagger as="ol" className={styles.principles}>
          {principles.map((principle) => (
            <MotionStaggerItem as="li" className={`${styles.principle} ${styles[`principle${principle.number}`]}`} key={principle.number}>
              <span className={styles.principleNumber}>{principle.number}</span>
              <span className={styles.principleCopy}>
                <strong>{principle.label}</strong>
                <span>{principle.text}</span>
              </span>
            </MotionStaggerItem>
          ))}
        </MotionStagger>
      </div>
    </section>
  );
}
