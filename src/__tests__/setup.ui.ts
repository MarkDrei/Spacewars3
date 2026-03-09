import '@testing-library/jest-dom';

// ResizeObserver is not available in jsdom — provide a no-op mock
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
