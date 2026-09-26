'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { motionTokens, motionVariants } from './publicMotionTokens';

const durations = {
  reveal: motionTokens.duration.base,
  image: motionTokens.duration.slow,
  stagger: motionTokens.duration.base,
  item: motionTokens.duration.base,
};

export function resolveMotionProps({ kind = 'reveal', reduced = false, trigger = 'view', delay = 0 }) {
  const variants = motionVariants[kind] || motionVariants.reveal;
  if (reduced) {
    return { initial: false, animate: 'show', variants };
  }

  const transition = {
    duration: durations[kind] || motionTokens.duration.base,
    ease: kind === 'image' ? motionTokens.easing.cinematic : motionTokens.easing.editorial,
    delay,
  };
  const nextVariants = {
    ...variants,
    show: {
      ...variants.show,
      transition: kind === 'stagger'
        ? { ...variants.show.transition, delayChildren: delay }
        : transition,
    },
  };

  return trigger === 'mount'
    ? { initial: 'rest', animate: 'show', variants: nextVariants }
    : { initial: 'rest', whileInView: 'show', viewport: { once: true, amount: 0.2 }, variants: nextVariants };
}

export const resolveHydrationSafeReducedMotion = (reduced, mounted) => mounted && Boolean(reduced);

function MotionPrimitive({
  as = 'div',
  children,
  className,
  delay = 0,
  kind = 'reveal',
  testId,
  trigger = 'view',
  ...rest
}) {
  const reduced = useReducedMotion();
  const [hydratedReduced, setHydratedReduced] = useState(false);
  useEffect(() => setHydratedReduced(Boolean(reduced)), [reduced]);
  const Component = typeof as === 'string' ? motion[as] : motion.create(as);
  const observerAvailable = typeof IntersectionObserver !== 'undefined';
  const safeTrigger = trigger === 'view' && !observerAvailable ? 'mount' : trigger;
  const motionProps = resolveMotionProps({
    kind,
    reduced: hydratedReduced,
    trigger: safeTrigger,
    delay,
  });

  return (
    <Component
      className={className}
      data-motion-kind={kind}
      data-testid={testId || (kind === 'reveal' ? 'motion-reveal' : undefined)}
      {...motionProps}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function MotionReveal(props) {
  return <MotionPrimitive {...props} kind="reveal" />;
}

export function MotionImageReveal(props) {
  return <MotionPrimitive {...props} kind="image" />;
}

export function MotionStagger(props) {
  return <MotionPrimitive {...props} kind="stagger" />;
}

export function MotionStaggerItem(props) {
  return <MotionPrimitive {...props} kind="item" />;
}
