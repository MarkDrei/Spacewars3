import { describe, expect, test, vi } from 'vitest';
import { StarbaseRenderer } from '@/lib/client/renderers/StarbaseRenderer';

// jsdom does not have HTMLImageElement.src side effects, so we mock the Image constructor
vi.stubGlobal('Image', class {
  onload: (() => void) | null = null;
  src: string = '';
});

describe('StarbaseRenderer', () => {
  test('getObjectSize_returnsBaseSizeMultiplied5x', () => {
    const renderer = new StarbaseRenderer();
    // Access protected method via cast
    const size = (renderer as unknown as { getObjectSize(): number }).getObjectSize();
    expect(size).toBe(250); // 5 * 50
  });

  test('getFallbackColor_returnsExpectedHex', () => {
    const renderer = new StarbaseRenderer();
    const color = (renderer as unknown as { getFallbackColor(): string }).getFallbackColor();
    expect(color).toBe('#4488ff');
  });

  test('getHoverIndicatorRadius_returnsHalfObjectSize', () => {
    const renderer = new StarbaseRenderer();
    const r = (renderer as unknown as { getHoverIndicatorRadius(): number }).getHoverIndicatorRadius();
    const size = (renderer as unknown as { getObjectSize(): number }).getObjectSize();
    expect(r).toBe(size / 2); // 125
  });
});
