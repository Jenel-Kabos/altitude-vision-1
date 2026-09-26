import Link from 'next/link';
import { PublicContainer, PublicEyebrow } from './PublicPrimitives';
import { MotionReveal, MotionStagger, MotionStaggerItem } from './PublicMotion';
import styles from './PublicFoundation.module.css';

const intents = [
  ['Trouver ou confier un bien', 'Acheter, louer, séjourner ou publier avec Altimmo', [['Découvrir Altimmo', '/immobilier'], ['Confier un bien', '/properties/submit']]],
  ['Faire connaître mon entreprise', 'Communication, branding et contenus avec Altcom', [['Découvrir Altcom', '/communication']]],
  ['Préparer un événement', 'Organisation, scénographie et coordination avec Mila Events', [['Découvrir Mila Events', '/evenementiel']]],
];
export default function IntentRouter() {
  return <section id="solutions" data-testid="intent-router" className={styles.intent} aria-labelledby="intent-title"><PublicContainer>
    <MotionReveal testId="motion-intent"><PublicEyebrow>Entrer par votre besoin</PublicEyebrow><h2 id="intent-title" className={styles.intentTitle}>Que voulez-vous faire&nbsp;?</h2>
    <MotionStagger className={styles.intentList}>{intents.map(([title, copy, links], i) => <MotionStaggerItem as="article" className={styles.intentRow} key={title}>
      <span>0{i + 1}</span><div><h3>{title}</h3><p>{copy}</p></div><div>{links.map(([label, href]) => <Link key={href} href={href}>{label} ↗</Link>)}</div>
    </MotionStaggerItem>)}</MotionStagger></MotionReveal>
  </PublicContainer></section>;
}
