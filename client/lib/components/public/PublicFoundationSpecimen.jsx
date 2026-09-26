import React from 'react';
import {
  PublicButton, PublicContainer, PublicSectionHeading, PublicSite, PublicSurface,
} from './PublicPrimitives';
import styles from './PublicFoundation.module.css';

export default function PublicFoundationSpecimen() {
  return (
    <PublicSite>
      <section className={styles.specimen} data-testid="public-foundation-specimen">
        <PublicContainer>
          <div className={styles.specimenGrid}>
            <div className={styles.specimenHero}>
              <PublicSectionHeading as="h1" eyebrow="Altitude Vision" onDark
                lead="Une fondation publique sobre, lisible et pensée pour des services réels comme pour une plateforme.">
                Des services de terrain.
              </PublicSectionHeading>
              <div className={styles.specimenActions}>
                <PublicButton href="/immobilier">Explorer</PublicButton>
                <PublicButton href="/contact" variant="secondary">Nous contacter</PublicButton>
              </div>
            </div>

            <PublicSurface className={styles.specimenSurface} tabIndex={0}>
              <PublicSectionHeading eyebrow="Expression éditoriale" as="h2"
                lead="La marque mère reste dominante. Les expertises s’expriment par touches, dans leur contexte.">
                Une expression éditoriale, sans accumulation de cartes.
              </PublicSectionHeading>
              <div className={styles.specimenDivider} aria-hidden="true" />
              <div className={styles.brandAccents} aria-label="Accents des expertises">
                <span className={`${styles.brandAccent} ${styles.altimmo}`}>Altimmo</span>
                <span className={`${styles.brandAccent} ${styles.altcom}`}>Altcom</span>
                <span className={`${styles.brandAccent} ${styles.mila}`}>Mila Events</span>
              </div>
              <PublicButton href="/communication" variant="text">Découvrir les expertises</PublicButton>
            </PublicSurface>
          </div>
        </PublicContainer>
      </section>
    </PublicSite>
  );
}
