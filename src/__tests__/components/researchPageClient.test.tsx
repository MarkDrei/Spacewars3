import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, beforeEach, vi, expect } from 'vitest';
// AuthenticatedLayout uses next/router which isn't available in unit tests;
// replace it with a simple passthrough so we can render the page in isolation.
vi.mock('@/components/Layout/AuthenticatedLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

import ResearchPageClient from '@/app/research/ResearchPageClient';
import { researchService, TechTree, ResearchDef } from '@/lib/client/services/researchService';
import { ResearchType } from '@/shared/src/types/gameTypes';
import { userStatsService } from '@/lib/client/services/userStatsService';

// mock the services that ResearchPageClient relies on
vi.mock('@/lib/client/services/researchService', () => ({
  researchService: {
    getTechTree: vi.fn(),
    triggerResearch: vi.fn(),
    canAffordResearch: vi.fn(),
    isResearchActive: vi.fn(),
    formatDuration: vi.fn(),
    formatEffect: vi.fn(),
  }
}));

vi.mock('@/lib/client/services/userStatsService', () => ({
  userStatsService: {
    getUserStats: vi.fn()
  }
}));

// a very small subset of the TechTree type for convenience
const makeFakeTechTree = (overrides: Partial<TechTree> = {}) => ({
  ironHarvesting: 0,
  shipSpeed: 1,
  afterburner: 0,
  projectileDamage: 0,
  projectileReloadRate: 0,
  projectileAccuracy: 0,
  projectileWeaponTier: 0,
  energyDamage: 0,
  energyRechargeRate: 0,
  energyAccuracy: 0,
  energyWeaponTier: 0,
  hullStrength: 0,
  repairSpeed: 0,
  armorEffectiveness: 0,
  shieldEffectiveness: 0,
  shieldRechargeRate: 0,
  afterburnerSpeedIncrease: 0,
  afterburnerDuration: 0,
  teleport: 0,
  teleportRechargeSpeed: 1,
  ironCapacity: 0,
  inventorySlots: 0,
  bridgeSlots: 0,
  constructionSpeed: 0,
  spyChance: 0,
  spySpeed: 0,
  spySabotageDamage: 0,
  counterintelligence: 0,
  stealIron: 0,
  ...overrides,
});

const makeFakeResearch = (type: ResearchType): ResearchDef => ({
  type,
  name: type,
  level: 1,
  baseUpgradeCost: 0,
  baseUpgradeDuration: 0,
  baseValue: 0,
  upgradeCostIncrease: 0,
  baseValueIncrease: { type: 'constant', value: 0 },
  description: '',
  nextUpgradeCost: 100,
  nextUpgradeDuration: 60,
  currentEffect: 1,
  nextEffect: 2,
  unit: ''
});

describe('ResearchPageClient card view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // default formatting behaviour
    vi.mocked(researchService.formatDuration).mockImplementation((s: number) => `${s}`);
  });

  it('displays countdown badge instead of button when a research is active', async () => {
    const techTree = makeFakeTechTree({
      activeResearch: { type: ResearchType.ShipSpeed, remainingDuration: 123 }
    });

    const researches = {
      [ResearchType.ShipSpeed]: makeFakeResearch(ResearchType.ShipSpeed),
      [ResearchType.IronHarvesting]: makeFakeResearch(ResearchType.IronHarvesting)
    } as unknown as Record<ResearchType, ResearchDef>;

    vi.mocked(researchService.getTechTree).mockResolvedValue({ techTree, researches });
    vi.mocked(userStatsService.getUserStats).mockResolvedValue({
      iron: 0,
      last_updated: 0,
      ironPerSecond: 0,
      maxIronCapacity: 0,
      xp: 0,
      level: 0,
      xpForNextLevel: 0,
      timeMultiplier: 1
    });

    vi.mocked(researchService.isResearchActive).mockReturnValue(true);

    // let formatDuration return a human-readable string for our number
    vi.mocked(researchService.formatDuration).mockReturnValue('00:02:03');

    render(<ResearchPageClient auth={{ userId: 1, username: 'test' }} />);

    // wait for the card to appear
    await waitFor(() => {
      expect(screen.getByText('shipSpeed')).toBeInTheDocument();
    });

    // countdown should be visible inside the countdown container; other
    // occurrences of the same string (e.g. duration fields) are ignored.
    const countdown = screen.getByText('00:02:03', { selector: '.research-countdown' });
    expect(countdown).toBeInTheDocument();

    // check overlay texts: active card gets "In Progress", other card gets
    // "Other Research" when any research is active
    const inProgressOverlay = screen.getByText('✅ In Progress');
    expect(inProgressOverlay).toBeInTheDocument();
    const otherOverlay = screen.getByText('Other Research In Progress');
    expect(otherOverlay).toBeInTheDocument();

    // make sure the card containing the countdown does not also render a button
    const activeCard = countdown.closest('.item-card');
    expect(activeCard).not.toBeNull();
    if (activeCard) {
      const { queryByRole } = within(activeCard as HTMLElement);
      expect(queryByRole('button', { name: /research/i })).toBeNull();
    }
  });
});
