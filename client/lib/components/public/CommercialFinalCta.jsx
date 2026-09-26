import Link from 'next/link';
import { MotionReveal } from './PublicMotion';
import styles from './CommercialFinalCta.module.css';

export default function CommercialFinalCta() {
  return (
    <section className={styles.section} data-testid="commercial-final-cta" aria-labelledby="commercial-final-title">
      <MotionReveal className={styles.inner} testId="motion-commercial-final">
        <p>Votre projet peut commencer ici</p>
        <h2 id="commercial-final-title">Un projet en tête&nbsp;?<br /><em>Parlons-en.</em></h2>
        <span>Immobilier, communication ou événementiel&nbsp;: notre équipe vous oriente vers le bon interlocuteur.</span>
        <Link href="/contact">Parler de mon projet <b aria-hidden="true">↗</b></Link>
      </MotionReveal>
    </section>
  );
}
