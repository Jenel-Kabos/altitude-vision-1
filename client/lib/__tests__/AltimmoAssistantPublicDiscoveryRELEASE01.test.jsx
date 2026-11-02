import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import AssistantPublicDiscovery from '../components/assistant/AssistantPublicDiscovery';
import AltimmoAssistantGate from '../components/assistant/AltimmoAssistantGate';
import { useAuth } from '../context/AuthContext';
import { getAdvisorStatus } from '../services/altimmoAdvisorService';
import { getAssistantStatus } from '../services/altimmoAssistantService';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../services/altimmoAdvisorService', () => ({ getAdvisorStatus: vi.fn() }));
vi.mock('../services/altimmoAssistantService', () => ({ getAssistantStatus: vi.fn() }));
vi.mock('../components/assistant/AltimmoAdvisorChat', () => ({ default: () => <div data-testid="advisor-chat" /> }));
vi.mock('../components/assistant/AltimmoAssistant', () => ({ default: () => <div data-testid="classic-assistant" /> }));

describe('ALTIMMO-AI-RELEASE-01 — découverte publique', () => {
  test('présente honnêtement les capacités, exemples, limites et statut', () => {
    render(<AssistantPublicDiscovery />);
    expect(screen.getByRole('heading', { name: 'Assistant immobilier IA Altimmo' })).toBeInTheDocument();
    expect(screen.getByText('Assistant IA — Bientôt disponible')).toBeInTheDocument();
    expect(screen.getByText(/Je cherche une maison à louer à Brazzaville/)).toBeInTheDocument();
    expect(screen.getByText(/ne réserve pas, ne paie pas et ne garantit pas/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voir les annonces/ })).toHaveAttribute('href', '/immobilier/annonces');
    expect(screen.queryByRole('button', { name: /Essayer maintenant/ })).not.toBeInTheDocument();
  });

  test('un visiteur anonyme voit la présentation sans appel au statut DeepSeek', () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    getAssistantStatus.mockResolvedValue(false);
    render(<AltimmoAssistantGate />);
    expect(screen.getByTestId('assistant-public-discovery')).toBeInTheDocument();
    expect(getAdvisorStatus).not.toHaveBeenCalled();
  });

  test('un testeur autorisé conserve le conseiller existant', async () => {
    useAuth.mockReturnValue({ user: { id: 'internal' }, loading: false });
    getAssistantStatus.mockResolvedValue(false);
    getAdvisorStatus.mockResolvedValue({ available: true });
    render(<AltimmoAssistantGate />);
    expect(await screen.findByTestId('advisor-chat')).toBeInTheDocument();
  });
});
