import { GET } from '@/app/api/ships/route';
import { NextRequest } from 'next/server';
import { describe, it, expect, vi } from 'vitest';

describe('Ships API', () => {
  it('should return a list of ships', async () => {
    // Mock fs.readdir
    const fs = require('fs/promises');
    vi.spyOn(fs, 'readdir').mockResolvedValue([
      'ship1.png', 'ship2.png', 'ship10.png', 'ship99.png', 'other.png', 'shipText.txt'
    ]);

    const result = await GET();
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.ships).toEqual([1, 2, 10, 99]);
  });
});
