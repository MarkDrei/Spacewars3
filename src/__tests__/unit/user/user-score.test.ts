import { describe, it, expect } from 'vitest';
import { User, SaveUserCallback } from '@/lib/server/user/user';
import { createInitialTechTree } from '@/lib/server/techs/techtree';
import { TechCounts } from '@/lib/server/techs/TechFactory';

const dummySave: SaveUserCallback = async () => { /* no-op for testing */ };
const defaultTechCounts: TechCounts = {
  pulse_laser: 5,
  auto_turret: 5,
  plasma_lance: 0,
  gauss_rifle: 0,
  photon_torpedo: 0,
  rocket_launcher: 0,
  ship_hull: 5,
  kinetic_armor: 5,
  energy_shield: 5,
  missile_jammer: 0
};

function makeUser(score: number = 0, xp: number = 0): User {
  const user = new User(
    1,
    'testuser',
    'hash',
    0,
    xp,
    Math.floor(Date.now() / 1000),
    createInitialTechTree(),
    dummySave,
    defaultTechCounts,
    250,
    250,
    250,
    Math.floor(Date.now() / 1000),
    false,
    null,
    [],
    null,
    0,
    0
  );
  user.score = score;
  return user;
}

describe('User.addScore()', () => {
  it('addScore_positiveAmount_incrementsScore', () => {
    const user = makeUser(100);
    user.addScore(50);
    expect(user.score).toBe(150);
  });

  it('addScore_zeroAmount_doesNotChangeScore', () => {
    const user = makeUser(100);
    user.addScore(0);
    expect(user.score).toBe(100);
  });

  it('addScore_negativeAmount_doesNotChangeScore', () => {
    const user = makeUser(100);
    user.addScore(-50);
    expect(user.score).toBe(100);
  });

  it('addScore_firstScore_startsFromZero', () => {
    const user = makeUser(0);
    user.addScore(200);
    expect(user.score).toBe(200);
  });

  it('addScore_doesNotAffectXp', () => {
    const user = makeUser(0, 500);
    user.addScore(100);
    expect(user.xp).toBe(500); // XP unchanged
    expect(user.score).toBe(100);
  });

  it('addScore_multipleAdds_accumulatesCorrectly', () => {
    const user = makeUser(0);
    user.addScore(10);
    user.addScore(20);
    user.addScore(30);
    expect(user.score).toBe(60);
  });

  it('addScore_largeAmount_worksCorrectly', () => {
    const user = makeUser(0);
    user.addScore(999999);
    expect(user.score).toBe(999999);
  });
});

describe('User score default value', () => {
  it('newUser_scoreDefaultsToZero', () => {
    const user = makeUser();
    expect(user.score).toBe(0);
  });
});
