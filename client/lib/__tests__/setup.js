import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// GL-DEBT-1 (Phase 15) — sous forte contention CPU (suite parallélisée sur
// plusieurs threads), le défaut de Testing Library (1000ms pour
// waitFor/findBy*) est parfois trop court pour un rendu jsdom + import()
// dynamique de page dashboard, ce qui produit des échecs intermittents
//("Unable to find role...", "Test timed out") sans rapport avec un bug
// applicatif — les mêmes tests passent systématiquement en isolation.
// Un timeout plus généreux, ciblé sur ce mécanisme précis (pas une
// augmentation aveugle de tous les timeouts), absorbe cette contention.
configure({ asyncUtilTimeout: 5000 });

// jsdom n'a pas window.matchMedia (requis par framer-motion)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// jsdom n'a pas ResizeObserver (requis par framer-motion)
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Silence les console.warn/error des librairies en mode test
const IGNORE = ['Warning: An update to', 'Warning: ReactDOM.render'];
const origWarn  = console.warn.bind(console);
const origError = console.error.bind(console);
console.warn  = (...args) => { if (!IGNORE.some(p => String(args[0]).includes(p))) origWarn(...args); };
console.error = (...args) => { if (!IGNORE.some(p => String(args[0]).includes(p))) origError(...args); };
