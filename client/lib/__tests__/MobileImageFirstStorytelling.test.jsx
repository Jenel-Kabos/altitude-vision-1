import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import HeroEcosystem from '../components/public/HeroEcosystem';
import AltimmoDiscovery from '../components/public/AltimmoDiscovery';
import MilaEventsDiscovery from '../components/public/MilaEventsDiscovery';
import AltcomDiscovery from '../components/public/AltcomDiscovery';
import { searchAltimmo } from '../services/propertyService';

vi.mock('../services/propertyService', () => ({ searchAltimmo: vi.fn() }));

const expectBefore = (first, second) => {
  expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
};

describe('MOBILE IMAGE-FIRST STORYTELLING — ordre sémantique', () => {
  beforeEach(() => {
    searchAltimmo.mockResolvedValue({
      properties: [{
        _id: 'image-first-property',
        title: 'Bien image first',
        type: 'Villa',
        address: { city: 'Brazzaville' },
        images: ['/images/image-first-property.webp'],
      }],
    });
  });

  test.each([
    {
      name: 'Altitude Vision',
      renderSection: () => render(<HeroEcosystem />),
      testId: 'hero-commercial',
      eyebrow: /Altitude Vision · Brazzaville/i,
      heading: /Un bien à trouver/i,
      cta: /Découvrir nos solutions/i,
      mediaTestId: 'hero-editorial-media',
    },
    {
      name: 'Mila Events',
      renderSection: () => render(<MilaEventsDiscovery />),
      testId: 'mila-events-discovery',
      eyebrow: /Mila Events — Événementiel/i,
      heading: /Vos moments méritent/i,
      cta: /Imaginer mon événement/i,
      mediaTestId: 'mila-editorial-media',
    },
    {
      name: 'Altcom',
      renderSection: () => render(<AltcomDiscovery />),
      testId: 'altcom-discovery',
      eyebrow: /Altcom — Communication/i,
      heading: /Votre entreprise mérite/i,
      cta: /Voir nos réalisations/i,
      mediaTestId: 'altcom-editorial-media',
    },
  ])('$name place le média entre l’identité et le grand titre', ({ renderSection, testId, eyebrow, heading, cta, mediaTestId }) => {
    renderSection();
    const section = screen.getByTestId(testId);
    const identity = within(section).getByText(eyebrow);
    const media = within(section).getByTestId(mediaTestId);
    const title = within(section).getByRole('heading', { name: heading });
    const action = within(section).getByRole('link', { name: cta });

    expectBefore(identity, media);
    expectBefore(media, title);
    expectBefore(title, action);
  });

  test('Altimmo place la sélection immobilière entre son identité et son grand titre', async () => {
    render(<AltimmoDiscovery />);
    const section = screen.getByTestId('altimmo-discovery');

    await waitFor(() => expect(within(section).getByRole('img', { name: 'Bien image first' })).toBeInTheDocument());

    const identity = within(section).getByText(/Altimmo — Immobilier/i);
    const media = within(section).getByRole('img', { name: 'Bien image first' }).closest('[data-story-media]');
    const title = within(section).getByRole('heading', { name: /Le bon lieu peut changer/i });
    const action = within(section).getByRole('link', { name: /Voir nos annonces/i });

    expect(media).toBeInTheDocument();
    expectBefore(identity, media);
    expectBefore(media, title);
    expectBefore(title, action);
  });
});
