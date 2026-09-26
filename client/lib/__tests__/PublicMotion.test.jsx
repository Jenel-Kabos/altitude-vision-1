import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';

import {
  MotionImageReveal,
  MotionReveal,
  MotionStagger,
  MotionStaggerItem,
  resolveHydrationSafeReducedMotion,
  resolveMotionProps,
} from '../components/public/PublicMotion';

let reducedMotion = false;

vi.mock('framer-motion', () => {
  const make = (tag) => ({ children, initial, animate: _animate, whileInView: _whileInView, viewport: _viewport, variants: _variants, transition: _transition, ...props }) => {
    const state = initial === false ? 'static' : String(initial || 'none');
    return React.createElement(tag, { ...props, 'data-initial-state': state }, children);
  };
  return {
    motion: new Proxy({}, { get: (_target, tag) => tag === 'create' ? (Component) => Component : make(tag) }),
    useReducedMotion: () => reducedMotion,
  };
});

describe('WEB-MOTION-01 — primitives accessibles', () => {
  beforeEach(() => { reducedMotion = false; });

  test('M-11/M-12 : reduced motion rend immédiatement l’état statique', () => {
    reducedMotion = true;
    render(<MotionReveal><h2>Contenu essentiel</h2></MotionReveal>);

    expect(screen.getByRole('heading', { name: 'Contenu essentiel' })).toBeVisible();
    expect(screen.getByTestId('motion-reveal')).toHaveAttribute('data-initial-state', 'static');
  });

  test('FINAL-MOTION-01 : le premier rendu reste identique entre serveur et client reduced-motion', () => {
    expect(resolveHydrationSafeReducedMotion(true, false)).toBe(false);
    expect(resolveHydrationSafeReducedMotion(true, true)).toBe(true);
    expect(resolveHydrationSafeReducedMotion(false, true)).toBe(false);
  });

  test('M-12/M-49 : l’état initial normal reste lisible si le reveal ne déclenche jamais', () => {
    const props = resolveMotionProps({ kind: 'reveal', reduced: false, trigger: 'view' });

    expect(props.variants.rest.opacity).toBeGreaterThan(0);
    expect(props.variants.rest.y).toBeLessThanOrEqual(18);
    expect(props.viewport).toEqual({ once: true, amount: 0.2 });
  });

  test('M-13/M-25 : aucun primitive majeur n’anime en boucle ou par dimensions de layout', () => {
    ['reveal', 'image', 'stagger', 'item'].forEach((kind) => {
      const props = resolveMotionProps({ kind, reduced: false, trigger: 'view' });
      const serialized = JSON.stringify(props);
      expect(serialized).not.toMatch(/Infinity|repeat|repeatType/);
      expect(serialized).not.toMatch(/"(height|width|top|left|margin|padding)"/);
    });
  });

  test('les wrappers préservent les éléments sémantiques et le DOM logique', () => {
    render(
      <>
        <MotionReveal as="header"><h2>Heading</h2></MotionReveal>
        <MotionImageReveal as="figure"><img alt="Editorial" src="/image.webp" /></MotionImageReveal>
        <MotionStagger as="ol"><MotionStaggerItem as="li">Étape</MotionStaggerItem></MotionStagger>
      </>
    );

    expect(screen.getByRole('banner')).toContainElement(screen.getByRole('heading', { name: 'Heading' }));
    expect(screen.getByRole('figure')).toContainElement(screen.getByRole('img', { name: 'Editorial' }));
    expect(screen.getByRole('list')).toContainElement(screen.getByRole('listitem'));
  });

  test('M-01/M-02 : conserve Framer Motion 12.23.24 comme unique dépendance motion', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));
    const lock = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package-lock.json'), 'utf8'));
    const dependencyNames = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies });

    expect(packageJson.dependencies['framer-motion']).toBe('^12.23.24');
    expect(lock.packages['node_modules/framer-motion'].version).toBe('12.23.24');
    expect(dependencyNames.filter((name) => /gsap|aos|lenis|locomotive|motion/i.test(name))).toEqual(['framer-motion']);
  });
});
