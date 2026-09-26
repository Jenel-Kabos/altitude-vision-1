'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { searchAltimmo } from '../../services/propertyService';
import EditorialMedia from './EditorialMedia';
import { editorialMedia } from '../../content/editorialMedia';
import { MotionImageReveal, MotionReveal, MotionStagger, MotionStaggerItem } from './PublicMotion';
import styles from './AltimmoDiscovery.module.css';

const routes = [
  { number: '01', label: 'Acheter', description: 'Trouver un bien à acquérir', href: '/immobilier/annonces?offerType=vente' },
  { number: '02', label: 'Louer', description: 'Choisir un lieu où vivre', href: '/immobilier/annonces?offerType=location' },
  { number: '03', label: 'Séjourner', description: 'Réserver un séjour au Congo', href: '/immobilier/sejourner' },
];

const isUsableImage = (value) => typeof value === 'string'
  && value.trim().length > 0
  && (/^https?:\/\//i.test(value.trim()) || value.trim().startsWith('/'));

const normalize = (property) => ({
  _id: property?._id,
  title: property?.title || 'Bien Altimmo',
  type: property?.type,
  city: property?.address?.city,
  price: property?.price,
  status: property?.status,
  image: isUsableImage(property?.images?.[0]) ? property.images[0].trim() : null,
});

const formatPrice = (price) => (
  typeof price === 'number' && Number.isFinite(price)
    ? `${new Intl.NumberFormat('fr-FR').format(price)} FCFA`
    : null
);

function PropertyVisual({ image, title }) {
  const [failed, setFailed] = useState(false);

  if (!image || failed) {
    return (
      <div className={styles.fallback} aria-hidden="true">
        <span>Sélection Altimmo</span>
        <span className={styles.fallbackMark}>A</span>
      </div>
    );
  }

  return <img className={styles.propertyImage} src={image} alt={title} loading="lazy" onError={() => setFailed(true)} />;
}

function PropertyContent({ property }) {
  const price = formatPrice(property.price);

  return (
    <article className={styles.propertyCard} data-testid="altimmo-property">
      <div className={styles.visual}><PropertyVisual image={property.image} title={property.title} /></div>
      <div className={styles.propertyBody}>
        <div className={styles.propertyMeta}>
          {property.type && <span>{property.type}</span>}
          {property.city && <span>{property.city}</span>}
        </div>
        <h3>{property.title}</h3>
        {(price || property.status) && (
          <p className={styles.propertyPrice}>
            {price}{price && property.status && <span aria-hidden="true"> · </span>}{property.status}
          </p>
        )}
      </div>
    </article>
  );
}

function PropertyPreview({ property }) {
  if (!property._id) return <PropertyContent property={property} />;
  return <Link className={styles.propertyLink} href={`/immobilier/property/${property._id}`}><PropertyContent property={property} /></Link>;
}

export default function AltimmoDiscovery() {
  const [state, setState] = useState('loading');
  const [items, setItems] = useState([]);
  const hasFeaturedProperties = state === 'success';

  useEffect(() => {
    let live = true;
    searchAltimmo({ limit: 3 })
      .then((response) => {
        if (!live) return;
        const nextItems = (response?.properties || []).slice(0, 3).map(normalize);
        setItems(nextItems);
        setState(nextItems.length ? 'success' : 'empty');
      })
      .catch(() => { if (live) setState('error'); });
    return () => { live = false; };
  }, []);

  return (
    <section className={styles.section} data-testid="altimmo-discovery" aria-labelledby="altimmo-discovery-title">
      <div className={styles.container}>
        <MotionReveal as="header" className={styles.intro} testId="motion-altimmo">
          <p className={styles.eyebrow}>Altimmo — Immobilier</p>
          <h2 id="altimmo-discovery-title">Le bon lieu peut changer un projet de vie.</h2>
          <p className={styles.lede}>Trouvez un bien à acheter, à louer ou pour séjourner — ou confiez-nous le vôtre.</p>
        </MotionReveal>

        <MotionStagger as="nav" className={styles.routes} aria-label="Découvrir Altimmo">
          {routes.map((route) => (
            <MotionStaggerItem as={Link} className={styles.route} key={route.href} href={route.href}>
              <span className={styles.routeNumber}>{route.number}</span>
              <span className={styles.routeCopy}><strong>{route.label}</strong><small>{route.description}</small></span>
              <span className={styles.routeArrow} aria-hidden="true">↗</span>
            </MotionStaggerItem>
          ))}
        </MotionStagger>

        <div className={styles.proofHeader}>
          <p>{hasFeaturedProperties ? 'Une sélection disponible' : 'Explorez nos opportunités immobilières'}</p>
          <span>{hasFeaturedProperties ? 'Biens récents' : 'L’univers Altimmo'}</span>
        </div>
        <div className={`${styles.results} ${state === 'success' ? styles.resultsSuccess : ''}`}>
          {state === 'loading' && <p className={styles.state} aria-live="polite"><span className={styles.loadingDot} aria-hidden="true" />Chargement des opportunités Altimmo…</p>}
          {(state === 'empty' || state === 'error') && <p className={styles.state} aria-live="polite">Découvrez les biens proposés par Altimmo ou explorez l’ensemble de nos annonces.</p>}
          {(state === 'empty' || state === 'error') && (
            <MotionImageReveal as="figure" className={styles.editorialFallback}>
              <EditorialMedia
                className={styles.editorialFallbackImage}
                media={editorialMedia.altimmoFallback}
                testId="altimmo-editorial-fallback"
              />
              <figcaption>Habiter, investir, séjourner.</figcaption>
            </MotionImageReveal>
          )}
          {state === 'success' && items.map((property, index) => <PropertyPreview property={property} key={property._id || `${property.title}-${index}`} />)}
        </div>
        <div className={styles.commercialLinks}>
          <Link className={styles.catalogLink} href="/immobilier/annonces">Voir nos annonces <span aria-hidden="true">→</span></Link>
          <Link href="/immobilier">Découvrir Altimmo <span aria-hidden="true">→</span></Link>
          <Link href="/properties/submit">Confier mon bien <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </section>
  );
}
