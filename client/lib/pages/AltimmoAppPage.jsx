'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowUpRight, BedDouble, Building2, CalendarDays, FileText,
  Heart, KeyRound, MessageCircle, ShieldCheck, Sparkles, WalletCards,
} from 'lucide-react';
import {
  MotionImageReveal, MotionReveal, MotionStagger, MotionStaggerItem,
} from '../components/public/PublicMotion';
import styles from './AltimmoAppPage.module.css';

const MOCKUPS = {
  home: '/images/altimmo-app/mockups/01-altimmo-home.png',
  map: '/images/altimmo-app/mockups/02-altimmo-map.png',
  property: '/images/altimmo-app/mockups/03-altimmo-properties.png',
  hotel: '/images/altimmo-app/mockups/04-altimmo-hotel..png',
  accommodation: '/images/altimmo-app/mockups/05-altimmo-accommodation.png',
  propertyDetail: '/images/altimmo-app/mockups/06-altimmo-property-detail.png — Détail d’un bien + contacter + planifier une visite.png',
  messaging: '/images/altimmo-app/mockups/07-altimmo-messaging.png',
  ownerProfile: '/images/altimmo-app/mockups/08-altimmo-owner-profile.png',
  ownerProperties: '/images/altimmo-app/mockups/09-altimmo-owner-properties.png.png',
  account: '/images/altimmo-app/mockups/10-altimmo-account-services.png',
};

const USES = [
  ['Acheter', 'Un bien pour habiter ou investir.'],
  ['Louer', 'Un lieu adapté à votre quotidien.'],
  ['Séjourner', 'Un hébergement pour votre passage.'],
  ['Investir', 'Une opportunité pour votre projet.'],
];

const PROPERTY_STEPS = [
  ['01', 'Découvrir', 'Parcourez les annonces disponibles.'],
  ['02', 'Examiner', 'Consultez photos, caractéristiques et localisation.'],
  ['03', 'Contacter', 'Échangez directement avec l’agence.'],
  ['04', 'Visiter', 'Planifiez une visite au moment opportun.'],
];

const ACCOUNT_SERVICES = [
  [KeyRound, 'Espace locataire'], [FileText, 'Documents'],
  [Heart, 'Favoris'], [WalletCards, 'Transactions'],
  [Building2, 'Offres & candidatures'], [BedDouble, 'Réservations & hébergements'],
  [ShieldCheck, 'Sécurité du compte'], [CalendarDays, 'Visites & notifications'],
];

function Mockup({ src, alt = '', className = '', priority = false, sizes = '(max-width: 767px) 82vw, 38vw' }) {
  return (
    <Image className={className} src={src} alt={alt} width={1024} height={1536} sizes={sizes} priority={priority} />
  );
}

function Arrow() {
  return <ArrowUpRight size={17} strokeWidth={1.7} aria-hidden="true" />;
}

export default function AltimmoAppPage() {
  return (
    <main className={styles.page}>
      <section className={`${styles.band} ${styles.hero}`} aria-labelledby="altimmo-story-hero" data-story-step="promise">
        <div className={`${styles.shell} ${styles.heroGrid}`}>
          <MotionReveal className={styles.heroCopy}>
            <p className={styles.eyebrow}>Altimmo — L’application</p>
            <h1 id="altimmo-story-hero" className={styles.heroTitle}>
              L’immobilier,<br />désormais dans<br /><em>votre poche.</em>
            </h1>
            <p className={styles.heroText}>
              Recherchez des biens, explorez les opportunités, organisez vos visites,
              gérez vos propriétés et accédez aux hébergements depuis une seule application.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primaryAction} href="/immobilier/annonces">Découvrir les biens <Arrow /></Link>
              <Link className={styles.textAction} href="#decouvrir">Explorer l’application <Arrow /></Link>
            </div>
          </MotionReveal>
          <div className={styles.heroVisual} aria-label="Trois aperçus officiels de l’application Altimmo">
            <MotionImageReveal className={`${styles.heroMockup} ${styles.heroMap}`}>
              <Mockup src={MOCKUPS.map} alt="Carte des biens disponibles à Brazzaville dans l’application Altimmo" className={styles.mockup} priority sizes="(max-width: 767px) 39vw, 23vw" />
            </MotionImageReveal>
            <MotionImageReveal className={`${styles.heroMockup} ${styles.heroHome}`}>
              <Mockup src={MOCKUPS.home} alt="Accueil Altimmo avec recherche et annonces immobilières recommandées" className={styles.mockup} priority sizes="(max-width: 767px) 58vw, 29vw" />
            </MotionImageReveal>
            <MotionImageReveal className={`${styles.heroMockup} ${styles.heroHotel}`}>
              <Mockup src={MOCKUPS.hotel} alt="Fiche Mila Hotel avec services et choix d’une chambre dans Altimmo" className={styles.mockup} priority sizes="(max-width: 767px) 39vw, 23vw" />
            </MotionImageReveal>
          </div>
        </div>
      </section>

      <section id="decouvrir" className={`${styles.band} ${styles.ivory}`} aria-labelledby="altimmo-story-discover" data-story-step="discover">
        <div className={`${styles.shell} ${styles.split}`}>
          <MotionImageReveal className={`${styles.visual} ${styles.visualDiscover}`}>
            <Mockup src={MOCKUPS.home} alt="" className={styles.mockup} sizes="(max-width: 767px) 82vw, 36vw" />
            <span className={styles.visualIndex} aria-hidden="true">01</span>
          </MotionImageReveal>
          <MotionReveal className={styles.copy}>
            <p className={styles.eyebrow}>Rechercher & découvrir</p>
            <h2 id="altimmo-story-discover" className={styles.title}>Des opportunités<br /><em>à portée de main.</em></h2>
            <p className={styles.body}>Parcourez les biens disponibles à Brazzaville et au Congo, comparez les annonces et trouvez l’opportunité adaptée à votre projet.</p>
            <MotionStagger as="ul" className={styles.useList} aria-label="Usages Altimmo">
              {USES.map(([title, description]) => (
                <MotionStaggerItem as="li" key={title}><span>{title}</span><p>{description}</p></MotionStaggerItem>
              ))}
            </MotionStagger>
          </MotionReveal>
        </div>
      </section>

      <section className={`${styles.band} ${styles.ink}`} aria-labelledby="altimmo-story-map" data-story-step="map">
        <div className={`${styles.shell} ${styles.mapLayout}`}>
          <MotionReveal className={styles.mapCopy}>
            <p className={styles.eyebrow}>Carte des biens</p>
            <h2 id="altimmo-story-map" className={styles.title}>Explorez la ville.<br /><em>Repérez les opportunités.</em></h2>
            <p className={styles.body}>La carte Altimmo permet de visualiser les biens disponibles par zone et d’explorer plus facilement le marché immobilier local.</p>
            <p className={styles.places}>Brazzaville <span>·</span> Moungali <span>·</span> Poto-Poto <span>·</span> Ouenzé</p>
          </MotionReveal>
          <MotionImageReveal className={`${styles.visual} ${styles.mapVisual}`}>
            <Mockup src={MOCKUPS.map} alt="" className={styles.mockup} sizes="(max-width: 767px) 88vw, 45vw" />
          </MotionImageReveal>
        </div>
      </section>

      <section className={`${styles.band} ${styles.ivory}`} aria-labelledby="altimmo-story-property" data-story-step="buy-rent">
        <div className={styles.shell}>
          <MotionReveal className={styles.centerHeader}>
            <p className={styles.eyebrow}>Acheter & louer</p>
            <h2 id="altimmo-story-property" className={styles.title}>Du premier regard<br /><em>à la visite.</em></h2>
          </MotionReveal>
          <div className={styles.propertyJourney}>
            <MotionImageReveal className={`${styles.visual} ${styles.propertyOne}`}>
              <Mockup src={MOCKUPS.property} alt="Fiche d’un bureau à louer avec caractéristiques et planification de visite dans Altimmo" className={styles.mockup} />
            </MotionImageReveal>
            <MotionStagger as="ol" className={styles.stepList}>
              {PROPERTY_STEPS.map(([number, title, description]) => (
                <MotionStaggerItem as="li" key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></MotionStaggerItem>
              ))}
            </MotionStagger>
            <MotionImageReveal className={`${styles.visual} ${styles.propertyTwo}`}>
              <Mockup src={MOCKUPS.propertyDetail} alt="Détail d’une villa à vendre avec localisation, contact et planification de visite dans Altimmo" className={styles.mockup} />
            </MotionImageReveal>
          </div>
        </div>
      </section>

      <section className={`${styles.band} ${styles.softInk}`} aria-labelledby="altimmo-story-hospitality" data-story-step="hospitality">
        <div className={`${styles.shell} ${styles.split} ${styles.reverse}`}>
          <div className={styles.hospitalityVisual}>
            <MotionImageReveal className={`${styles.visual} ${styles.hotelVisual}`}>
              <Mockup src={MOCKUPS.hotel} alt="" className={styles.mockup} />
            </MotionImageReveal>
            <MotionImageReveal className={`${styles.visual} ${styles.accommodationVisual}`}>
              <Mockup src={MOCKUPS.accommodation} alt="Hébergement meublé avec équipements, contact et réservation dans Altimmo" className={styles.mockup} />
            </MotionImageReveal>
          </div>
          <MotionReveal className={styles.copy}>
            <p className={styles.eyebrow}>Hôtels & hébergements</p>
            <h2 id="altimmo-story-hospitality" className={styles.title}>Séjournez{' '}<br /><em>autrement.</em></h2>
            <p className={styles.body}>Altimmo réunit aussi les établissements et hébergements disponibles : découvrez un lieu, consultez ses informations, choisissez une chambre et réservez.</p>
            <ol className={styles.inlineJourney} aria-label="Parcours de réservation"><li>Découvrir</li><li>Consulter</li><li>Choisir</li><li>Réserver</li></ol>
          </MotionReveal>
        </div>
      </section>

      <section className={`${styles.band} ${styles.ivory}`} aria-labelledby="altimmo-story-messaging" data-story-step="messaging">
        <div className={`${styles.shell} ${styles.split}`}>
          <MotionImageReveal className={`${styles.visual} ${styles.messagingVisual}`}>
            <Mockup src={MOCKUPS.messaging} alt="Messagerie Altimmo reliant une conversation à une annonce immobilière" className={styles.mockup} />
            <span className={styles.messageOrbit} aria-hidden="true"><MessageCircle size={25} /></span>
          </MotionImageReveal>
          <MotionReveal className={styles.copy}>
            <p className={styles.eyebrow}>Contact · messagerie · visites</p>
            <h2 id="altimmo-story-messaging" className={styles.title}>Un projet immobilier<br /><em>commence par un échange.</em></h2>
            <p className={styles.body}>Contactez l’agence depuis une annonce, poursuivez la conversation dans la messagerie et coordonnez votre prochaine visite au même endroit.</p>
            <ul className={styles.serviceLines}>
              <li><MessageCircle aria-hidden="true" /> Messagerie liée aux annonces</li>
              <li><CalendarDays aria-hidden="true" /> Planification et suivi des visites</li>
              <li><Building2 aria-hidden="true" /> Contact direct avec l’agence</li>
            </ul>
          </MotionReveal>
        </div>
      </section>

      <section className={`${styles.band} ${styles.ink}`} aria-labelledby="altimmo-story-owners" data-story-step="owners">
        <div className={styles.shell}>
          <div className={styles.ownerIntro}>
            <MotionReveal className={styles.copy}>
              <p className={styles.eyebrow}>Pour les propriétaires</p>
              <h2 id="altimmo-story-owners" className={styles.title}>Vos biens. Votre activité.<br /><em>Un seul espace.</em></h2>
              <p className={styles.body}>Publiez un bien, administrez vos annonces, suivez leur disponibilité, modifiez une publication et retrouvez les visites associées.</p>
            </MotionReveal>
            <ul className={styles.ownerCapabilities}>
              <li>Publier un bien</li><li>Gérer ses annonces</li><li>Suivre la disponibilité</li>
              <li>Modifier une publication</li><li>Suivre ses visites</li><li>Gérer les opérations associées</li>
            </ul>
          </div>
          <div className={styles.ownerVisuals}>
            <MotionImageReveal className={`${styles.visual} ${styles.ownerProperties}`}>
              <Mockup src={MOCKUPS.ownerProperties} alt="Gestion des biens publiés, en attente et non publiés dans l’application Altimmo" className={styles.mockup} />
            </MotionImageReveal>
            <MotionImageReveal className={`${styles.visual} ${styles.ownerProfile}`}>
              <Mockup src={MOCKUPS.ownerProfile} alt="Profil propriétaire Altimmo avec biens, visites, transactions et activité récente" className={styles.mockup} />
            </MotionImageReveal>
          </div>
          <MotionReveal as="aside" className={styles.commissionNote}>
            <Sparkles aria-hidden="true" />
            <p>Les apporteurs d’affaires éligibles peuvent recevoir jusqu’à 30 % de la commission Altitude Vision après finalisation d’une transaction admissible, selon les règles du réseau.</p>
          </MotionReveal>
        </div>
      </section>

      <section className={`${styles.band} ${styles.ivory}`} aria-labelledby="altimmo-story-account" data-story-step="account">
        <div className={`${styles.shell} ${styles.split} ${styles.accountSplit}`}>
          <MotionImageReveal className={`${styles.visual} ${styles.accountVisual}`}>
            <Mockup src={MOCKUPS.account} alt="Espace personnel Altimmo avec visites, documents, transactions et réservations" className={styles.mockup} sizes="(max-width: 767px) 86vw, 41vw" />
          </MotionImageReveal>
          <MotionReveal className={styles.copy}>
            <p className={styles.eyebrow}>Votre espace</p>
            <h2 id="altimmo-story-account" className={styles.title}>Tout votre parcours,<br /><em>au même endroit.</em></h2>
            <p className={styles.body}>Votre compte rassemble les services utiles pour retrouver vos démarches et suivre chaque étape de votre expérience Altimmo.</p>
            <MotionStagger as="ul" className={styles.accountServices}>
              {ACCOUNT_SERVICES.map(([Icon, label]) => (
                <MotionStaggerItem as="li" key={label}><Icon aria-hidden="true" /><span>{label}</span></MotionStaggerItem>
              ))}
            </MotionStagger>
          </MotionReveal>
        </div>
      </section>

      <section className={`${styles.band} ${styles.ecosystem}`} aria-labelledby="altimmo-story-ecosystem" data-story-step="ecosystem">
        <div className={styles.shell}>
          <MotionReveal className={styles.ecosystemCopy}>
            <p className={styles.eyebrow}>Une plateforme, plusieurs parcours</p>
            <h2 id="altimmo-story-ecosystem" className={styles.title}>Plus qu’une application.<br /><em>Un écosystème immobilier.</em></h2>
            <p className={styles.body}>Altimmo réunit clients, propriétaires, locataires, professionnels et partenaires autour d’une même expérience immobilière pensée pour le Congo.</p>
          </MotionReveal>
          <div className={styles.ecosystemVisuals} aria-hidden="true">
            <MotionImageReveal className={styles.ecoSide}><Mockup src={MOCKUPS.messaging} alt="" className={styles.mockup} sizes="(max-width: 767px) 34vw, 19vw" /></MotionImageReveal>
            <MotionImageReveal className={styles.ecoCenter}><Mockup src={MOCKUPS.home} alt="" className={styles.mockup} sizes="(max-width: 767px) 48vw, 25vw" /></MotionImageReveal>
            <MotionImageReveal className={styles.ecoSide}><Mockup src={MOCKUPS.ownerProfile} alt="" className={styles.mockup} sizes="(max-width: 767px) 34vw, 19vw" /></MotionImageReveal>
          </div>
        </div>
      </section>

      <section className={`${styles.band} ${styles.finalCta}`} aria-labelledby="altimmo-story-final" data-story-step="final-cta">
        <div className={`${styles.shell} ${styles.finalInner}`}>
          <MotionReveal>
            <p className={styles.eyebrow}>Le prochain chapitre</p>
            <h2 id="altimmo-story-final" className={styles.finalTitle}>Votre prochain projet<br /><em>commence ici.</em></h2>
            <p className={styles.finalText}>Découvrez les biens disponibles ou confiez-nous la publication de votre propriété.</p>
            <div className={`${styles.actions} ${styles.finalActions}`}>
              <Link className={styles.primaryAction} href="/immobilier/annonces">Voir les annonces <Arrow /></Link>
              <Link className={styles.outlineAction} href="/properties/submit">Publier un bien <Arrow /></Link>
            </div>
          </MotionReveal>
          <span className={styles.finalMark} aria-hidden="true">A</span>
        </div>
      </section>
    </main>
  );
}
