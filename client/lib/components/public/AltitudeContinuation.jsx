import Link from 'next/link';
import styles from './AltitudeContinuation.module.css';
import { MotionReveal, MotionStagger, MotionStaggerItem } from './PublicMotion';

const destinations = [
  {
    id: 'Altimmo',
    name: 'Altimmo',
    tag: 'Immobilier',
    description: 'Trouvez le bien idéal parmi notre sélection exclusive de propriétés à Brazzaville.',
    href: '/immobilier',
    accent: '#2E7BB5',
  },
  {
    id: 'MilaEvents',
    name: 'Mila Events',
    tag: 'Événementiel',
    description: 'Mariages, galas, séminaires — nous concevons des expériences sur mesure.',
    href: '/evenementiel',
    accent: '#2459A6',
  },
  {
    id: 'Altcom',
    name: 'Altcom',
    tag: 'Communication',
    description: 'Stratégie de communication, branding et visibilité digitale pour propulser votre image.',
    href: '/communication',
    accent: '#B62E36',
  },
];

export default function AltitudeContinuation() {
  return (
    <section className={styles.section} data-testid="web10-continuation" aria-labelledby="web10-continuation-title">
      <div className={styles.container}>
        <MotionReveal className={styles.headingBlock} testId="motion-continuation">
          <p className={styles.eyebrow}>À découvrir</p>
          <h2 id="web10-continuation-title">
            Chaque univers a sa propre sélection.<br />
            <em>Explorez-la en détail.</em>
          </h2>
        </MotionReveal>

        <MotionStagger as="nav" className={styles.destinations} aria-label="Explorer les univers Altitude Vision">
          {destinations.map((destination) => (
            <MotionStaggerItem as={Link} className={styles.destination} href={destination.href} key={destination.id}>
              <span className={styles.destinationDot} style={{ backgroundColor: destination.accent }} aria-hidden="true" />
              <span className={styles.destinationCopy}>
                <strong>{destination.name} <small>— {destination.tag}</small></strong>
                <span>{destination.description}</span>
              </span>
              <span className={styles.destinationArrow} aria-hidden="true">→</span>
            </MotionStaggerItem>
          ))}
        </MotionStagger>
      </div>
    </section>
  );
}
