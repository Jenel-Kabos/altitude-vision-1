import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MessageInput from '../components/messaging/MessageInput';

describe('MessageInput read-only', () => {
  it('désactive le composeur et affiche la raison fournie par le serveur', () => {
    render(<MessageInput onSendMessage={vi.fn()} writeState={{ writable: false, code: 'CONTACT_AUTHORIZATION_REQUIRED' }} />);
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByText(/autorisation.*altitude vision/i)).toBeInTheDocument();
  });
});
