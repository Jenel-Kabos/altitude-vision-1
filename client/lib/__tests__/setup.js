import '@testing-library/jest-dom';

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
