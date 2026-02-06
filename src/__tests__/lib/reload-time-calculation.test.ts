// ---
// Tests for reload time calculation with research effects
// ---

import { describe, it, expect } from 'vitest';
import { TechFactory } from '../../lib/server/techs/TechFactory';

describe('Reload Time Calculation', () => {
  describe('calculateReloadTime', () => {
    it('calculateReloadTime_projectileWeaponLevel0Research_returnsBaseReloadTime', () => {
      const techTree = { projectileReloadRate: 0, energyRechargeRate: 0 };
      const reloadTime = TechFactory.calculateReloadTime('auto_turret', techTree);
      
      // auto_turret has reloadTimeMinutes: 12, so base is 12 * 60 = 720 seconds
      // With level 0 ProjectileReloadRate (0% reduction): 720 * 1.0 = 720 seconds
      expect(reloadTime).toBe(720);
    });

    it('calculateReloadTime_energyWeaponLevel0Research_returnsBaseReloadTime', () => {
      const techTree = { projectileReloadRate: 0, energyRechargeRate: 0 };
      const reloadTime = TechFactory.calculateReloadTime('pulse_laser', techTree);
      
      // pulse_laser has reloadTimeMinutes: 12, so base is 12 * 60 = 720 seconds
      // With level 0 EnergyRechargeRate (0% reduction): 720 * 1.0 = 720 seconds
      expect(reloadTime).toBe(720);
    });

    it('calculateReloadTime_projectileWeaponLevel1Research_appliesCorrectReduction', () => {
      const techTree = { projectileReloadRate: 1, energyRechargeRate: 1 };
      const reloadTime = TechFactory.calculateReloadTime('auto_turret', techTree);
      
      // auto_turret has reloadTimeMinutes: 12, so base is 12 * 60 = 720 seconds
      // With level 1 ProjectileReloadRate (10% reduction): 720 * 0.9 = 648 seconds
      expect(reloadTime).toBe(648);
    });

    it('calculateReloadTime_energyWeaponLevel1Research_appliesCorrectReduction', () => {
      const techTree = { projectileReloadRate: 1, energyRechargeRate: 1 };
      const reloadTime = TechFactory.calculateReloadTime('pulse_laser', techTree);
      
      // pulse_laser has reloadTimeMinutes: 12, so base is 12 * 60 = 720 seconds
      // With level 1 EnergyRechargeRate (15% reduction): 720 * 0.85 = 612 seconds
      expect(reloadTime).toBe(612);
    });

    it('calculateReloadTime_projectileWeaponLevel3Research_appliesCorrectReduction', () => {
      const techTree = { projectileReloadRate: 3, energyRechargeRate: 1 };
      const reloadTime = TechFactory.calculateReloadTime('gauss_rifle', techTree);
      
      // gauss_rifle has reloadTimeMinutes: 15, so base is 15 * 60 = 900 seconds
      // With level 3 ProjectileReloadRate (30% reduction): 900 * 0.7 = 630 seconds
      expect(reloadTime).toBe(630);
    });

    it('calculateReloadTime_energyWeaponLevel5Research_appliesCorrectReduction', () => {
      const techTree = { projectileReloadRate: 1, energyRechargeRate: 5 };
      const reloadTime = TechFactory.calculateReloadTime('plasma_lance', techTree);
      
      // plasma_lance has reloadTimeMinutes: 15, so base is 15 * 60 = 900 seconds
      // With level 5 EnergyRechargeRate (75% reduction): 900 * 0.25 = 225 seconds
      expect(reloadTime).toBe(225);
    });

    it('calculateReloadTime_highResearchLevel_capsAt90Percent', () => {
      const techTree = { projectileReloadRate: 10, energyRechargeRate: 10 };
      const reloadTime = TechFactory.calculateReloadTime('auto_turret', techTree);
      
      // auto_turret has reloadTimeMinutes: 12, so base is 12 * 60 = 720 seconds
      // With level 10 ProjectileReloadRate (100% reduction, but capped at 90%): 720 * 0.1 = 72 seconds
      expect(reloadTime).toBe(72);
    });

    it('calculateReloadTime_rocketLauncher_usesCorrectSubtype', () => {
      const techTree = { projectileReloadRate: 2, energyRechargeRate: 2 };
      const reloadTime = TechFactory.calculateReloadTime('rocket_launcher', techTree);
      
      // rocket_launcher is Projectile subtype, has reloadTimeMinutes: 20, so base is 20 * 60 = 1200 seconds
      // With level 2 ProjectileReloadRate (20% reduction): 1200 * 0.8 = 960 seconds
      expect(reloadTime).toBe(960);
    });

    it('calculateReloadTime_photonTorpedo_usesCorrectSubtype', () => {
      const techTree = { projectileReloadRate: 2, energyRechargeRate: 2 };
      const reloadTime = TechFactory.calculateReloadTime('photon_torpedo', techTree);
      
      // photon_torpedo is Energy subtype, has reloadTimeMinutes: 20, so base is 20 * 60 = 1200 seconds
      // With level 2 EnergyRechargeRate (30% reduction): 1200 * 0.7 = 840 seconds
      expect(reloadTime).toBe(840);
    });

    it('calculateReloadTime_unknownWeapon_returnsNull', () => {
      const techTree = { projectileReloadRate: 1, energyRechargeRate: 1 };
      const reloadTime = TechFactory.calculateReloadTime('unknown_weapon', techTree);
      
      expect(reloadTime).toBeNull();
    });
  });
});
