import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicAccommodationBookingForm from '../components/PublicAccommodationBookingForm';
import { createAccommodationReservation, getAccommodationAvailability } from '../services/accommodationReservationService';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../utils/toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/accommodationReservationService', () => ({ createAccommodationReservation: vi.fn(), getAccommodationAvailability: vi.fn() }));

const accommodation = { _id: 'acc-1', capacity: { maxAdults: 4, maxChildren: 2 } };

describe('PublicAccommodationBookingForm — garantie', () => {
  beforeEach(() => { vi.clearAllMocks(); getAccommodationAvailability.mockResolvedValue({ available: true, pricing: { nights: 5, nightlyRate: 50000, cleaningFee: 0, total: 250000, requiredToConfirm: 50000, currency: 'XAF' } }); });

  it('affiche uniquement les montants calculés par le serveur et la règle non remboursable', async () => {
    render(<PublicAccommodationBookingForm accommodation={accommodation} user={{ id: 'guest-1' }}/>);
    fireEvent.change(screen.getByLabelText('Arrivée'), { target: { value: '2027-09-10' } });
    fireEvent.change(screen.getByLabelText('Départ'), { target: { value: '2027-09-15' } });
    await waitFor(() => expect(screen.getByText(/À payer pour confirmer/).textContent.replace(/\D/g, '')).toBe('50000'));
    expect(screen.getByText(/Reste après garantie/).textContent.replace(/\D/g, '')).toBe('200000');
    expect(screen.getByText(/garantie non remboursable/i)).toBeInTheDocument();
  });

  it('n’envoie ni prix, ni tenant, ni statut au backend', async () => {
    createAccommodationReservation.mockResolvedValue({ _id: 'res-1' });
    render(<PublicAccommodationBookingForm accommodation={accommodation} user={{ id: 'guest-1' }}/>);
    fireEvent.change(screen.getByLabelText('Arrivée'), { target: { value: '2027-09-10' } }); fireEvent.change(screen.getByLabelText('Départ'), { target: { value: '2027-09-15' } });
    await waitFor(() => expect(screen.getByText(/À payer pour confirmer/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    await waitFor(() => expect(createAccommodationReservation).toHaveBeenCalledOnce());
    const payload = createAccommodationReservation.mock.calls[0][0];
    expect(payload).toMatchObject({ accommodation: 'acc-1', checkInDate: '2027-09-10', checkOutDate: '2027-09-15' });
    expect(payload).not.toHaveProperty('total'); expect(payload).not.toHaveProperty('tenant'); expect(payload).not.toHaveProperty('status');
  });
});
