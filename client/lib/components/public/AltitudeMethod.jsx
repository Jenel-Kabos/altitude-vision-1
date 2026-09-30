import styles from './AltitudeMethod.module.css';
import { MotionReveal, MotionStagger, MotionStaggerItem } from './PublicMotion';

// HOME-DESIGN-01 — processus unique « du besoin à la réalisation ». Fusionne
// les trois principes de l'ancienne section Approche et les points de
// méthode (interlocuteur identifié, étapes lisibles, outils numériques au
// service du contact humain) pour supprimer la répétition entre sections.
// Pas de bande commerciale ici : la conclusion de la homepage reste
// CommercialFinalCta, deux sections plus bas (après la réassurance).
const steps = [
  {
    number: '01',
    label: 'Comprendre votre besoin',
    detail: 'Un interlocuteur identifié dès le premier échange, pour clarifier vos objectifs.',
  },
  {
    number: '02',
    label: 'Coordonner les expertises',
    detail: 'Les pôles concernés avancent ensemble ; nos outils numériques organisent le travail, sans remplacer le contact humain.',
  },
  {
    number: '03',
    label: 'Réaliser votre projet',
    detail: 'Des étapes lisibles jusqu’à la livraison, avec un suivi à chaque jalon.',
  },
];

export default function AltitudeMethod() {
  return (
    <section className={styles.section} data-testid="web08-credibility" aria-labelledby="web08-credibility-title">
      <div className={styles.container}>
        <MotionReveal className={styles.headingBlock} testId="motion-method">
          <p className={styles.eyebrow}>Une seule équipe, du besoin à la réalisation</p>
          <h2 id="web08-credibility-title">
            Du besoin à la réalisation,<br />
            <em>un suivi clair à chaque étape.</em>
          </h2>
        </MotionReveal>

        <MotionStagger as="ol" className={styles.steps}>
          {steps.map((step) => (
            <MotionStaggerItem as="li" className={styles.step} key={step.number}>
              <span className={styles.stepNumber} aria-hidden="true">{step.number}</span>
              <h3 className={styles.stepLabel}>{step.label}</h3>
              <p className={styles.stepDetail}>{step.detail}</p>
            </MotionStaggerItem>
          ))}
        </MotionStagger>
      </div>
    </section>
  );
}
