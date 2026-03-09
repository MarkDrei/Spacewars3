import '@testing-library/jest-dom';

// Mock ResizeObserver which is not available in jsdom
// To re-enable circular clipping in the game, set clipToCircle = true in GameRenderer.ts
global.ResizeObserver = class ResizeObserver {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_callback: ResizeObserverCallback) {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  observe(_target: Element, _options?: ResizeObserverOptions) {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  unobserve(_target: Element) {}
  disconnect() {}
};
