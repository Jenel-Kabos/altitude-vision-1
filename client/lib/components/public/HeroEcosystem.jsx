import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { PublicContainer, PublicEyebrow, PublicSectionHeading } from './PublicPrimitives';
import EditorialMedia from './EditorialMedia';
import { MotionImageReveal, MotionStagger, MotionStaggerItem } from './PublicMotion';
import { editorialMedia } from '../../content/editorialMedia';
import styles from './PublicFoundation.module.css';

export default function HeroEcosystem() {
  return <section className={styles.hero} data-testid="hero-commercial" aria-labelledby="hero-ecosystem-title">
    <PublicContainer>
      <div className={styles.heroGrid}>
        <MotionStagger as="div" testId="motion-hero" trigger="mount">
          <MotionStaggerItem><PublicEyebrow>Altitude Vision · Brazzaville</PublicEyebrow></MotionStaggerItem>
          <MotionStaggerItem><PublicSectionHeading as="h1" onDark lead="Trois expertises. Un seul partenaire pour faire avancer vos projets.">
            <span id="hero-ecosystem-title" className={styles.heroQuestions}>
              <span>Un bien à trouver&nbsp;?</span>
              <span>Une entreprise à faire connaître&nbsp;?</span>
              <span>Un événement à organiser&nbsp;?</span>
            </span>
          </PublicSectionHeading></MotionStaggerItem>
          <MotionStaggerItem><p className={styles.heroSupporting}>Altitude Vision réunit immobilier, communication et événementiel pour accompagner vos projets de l’idée à leur réalisation.</p></MotionStaggerItem>
          <MotionStaggerItem className={styles.heroActions}>
            <Link className={`${styles.button} ${styles.buttonPrimary}`} href="#solutions">Découvrir nos solutions <ArrowUpRight size={17} aria-hidden="true" /></Link>
            <Link className={`${styles.button} ${styles.buttonSecondary}`} href="/contact">Parler de mon projet</Link>
          </MotionStaggerItem>
        </MotionStagger>
        <MotionImageReveal as="div" className={styles.heroComposition} delay={0.18} testId="hero-editorial-media" trigger="mount">
          <figure className={`${styles.heroMedia} ${styles.heroMediaMain}`}><EditorialMedia className={styles.heroImage} eager media={editorialMedia.realisationsAltimmo} /><figcaption>Altimmo <span>Immobilier</span></figcaption></figure>
          <figure className={styles.heroMedia}><EditorialMedia className={styles.heroImage} eager media={editorialMedia.realisationsAltcom} /><figcaption>Altcom <span>Communication</span></figcaption></figure>
          <figure className={styles.heroMedia}><EditorialMedia className={styles.heroImage} eager media={editorialMedia.realisationsMila} /><figcaption>Mila Events <span>Événementiel</span></figcaption></figure>
        </MotionImageReveal>
      </div>
    </PublicContainer>
  </section>;
}
