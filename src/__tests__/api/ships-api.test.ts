import { GET } from '@/app/api/ships/route';
import { describe, it, expect, vi } from 'vitest';
import { promises as fs } from 'fs';

describe('Ships API', () => {
  it('should return a list of ships', async () => {
    // Mock fs.readdir using mockImplementation to avoid type conflicts with overloaded signatures
    vi.spyOn(fs, 'readdir').mockImplementation(() => 
      Promise.resolve(['ship1.png', 'ship2.png', 'ship10.png', 'ship99.png', 'other.png', 'shipText.txt'] as never)
    );

    const result = await GET();
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.ships).toEqual([1, 2, 10, 99]);
  });
});
