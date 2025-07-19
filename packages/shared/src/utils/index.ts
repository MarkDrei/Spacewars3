// Utility functions shared between client and server
export function formatScore(score: number): string {
  return score.toLocaleString();
}

export function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// Angle conversion utilities
export * from './angleUtils';
