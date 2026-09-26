'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { MotionReveal, MotionStagger, MotionStaggerItem } from './public/PublicMotion';
import styles from './CtaCommission.module.css';

const PROCESS_STEPS = [
  { number: '01', title: 'Vous nous recommandez un bien', copy: 'Vous partagez avec notre équipe une opportunité de vente ou de location.' },
  { number: '02', title: 'Nous accompagnons la transaction', copy: 'Altitude Vision prend en charge la mise en relation et le suivi immobilier.' },
  { number: '03', title: 'Votre part est calculée', copy: 'Si la transaction est éligible et finalisée, votre part est calculée selon les conditions du programme.' },
];

export default function CtaCommission() {
  return (
    <section className={styles.section} data-testid="apporteur-premium" aria-labelledby="apporteur-title">
      <div className={styles.container}>
        <MotionReveal className={styles.intro} testId="motion-apporteur">
          <p className={styles.eyebrow}>Altitude Vision — Apporteur d’affaires</p>
          <h2 className={styles.title} id="apporteur-title">
            Vous connaissez un bien&nbsp;?
            <span>Faites-nous la mise en relation.</span>
          </h2>
          <p className={styles.supportingCopy}>
            Recommandez un propriétaire ou un bien à Altitude Vision. Si la mise en relation
            aboutit à une transaction éligible et finalisée, vous pouvez recevoir jusqu’à 30&nbsp;%
            de notre commission, selon les conditions du programme.
          </p>
        </MotionReveal>

        <div className={styles.offer}>
          <MotionReveal className={styles.percentage} delay={0.08}>
            <span className={styles.percentagePrefix}>Jusqu’à</span>
            <strong>30&nbsp;%</strong>
            <span className={styles.percentageContext}>de la commission Altitude Vision</span>
          </MotionReveal>

          <MotionStagger className={styles.process} delay={0.12} as="ol">
            {PROCESS_STEPS.map((step) => (
              <MotionStaggerItem className={styles.step} as="li" key={step.number}>
                <span className={styles.stepNumber} aria-hidden="true">{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </div>
              </MotionStaggerItem>
            ))}
          </MotionStagger>

          <MotionReveal delay={0.18}>
            <Link className={styles.cta} href="/trouve-ta-commission">
              Estimer ma part
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </MotionReveal>
        </div>
      </div>
    </section>
  );
}
