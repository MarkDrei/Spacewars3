/**
 * Factory Service - Client-side service for managing factory operations
 */

export interface WeaponSpec {
  name: string;
  subtype: 'Projectile' | 'Energy';
  strength: 'Weak' | 'Medium' | 'Strong';
  reloadTimeMinutes: number;
  baseDamage: number;
  baseAccuracy: number;
  baseCost: number;
  shieldDamageRatio: number;
  armorDamageRatio: number;
  buildDurationMinutes: number;
  advantage: string;
  disadvantage: string;
}

export interface DefenseSpec {
  name: string;
  baseCost: number;
  buildDurationMinutes: number;
  description: string;
}

export interface TechCounts {
  // Weapons
  pulse_laser: number;
  auto_turret: number;
  plasma_lance: number;
  gauss_rifle: number;
  photon_torpedo: number;
  rocket_launcher: number;
  
  // Defense
  ship_hull: number;
  kinetic_armor: number;
  energy_shield: number;
  missile_jammer: number;
}

export interface BuildQueueItem {
  itemKey: string;
  itemType: 'weapon' | 'defense';
  completionTime: number; // Unix timestamp
  remainingSeconds: number;
}

export interface TechCatalogResponse {
  success: boolean;
  weapons: Record<string, WeaponSpec>;
  defenses: Record<string, DefenseSpec>;
  weaponKeys: string[];
  defenseKeys: string[];
}

export interface BuildStatusResponse {
  success: boolean;
  techCounts: TechCounts;
  buildQueue: BuildQueueItem[];
  totalDPS: number;
  totalAccuracy: number;
  totalKineticArmor: number;
  totalEnergyShield: number;
  totalMissileJammers: number;
}

export interface BuildItemResponse {
  success: boolean;
  message: string;
  estimatedCompletion: number; // Unix timestamp
  remainingIron: number;
}

export interface CompleteBuildResponse {
  success: boolean;
  message: string;
  completedItem?: {
    itemKey: string;
    itemType: 'weapon' | 'defense';
  };
}

export interface FactoryErrorResponse {
  error: string;
}

class FactoryService {
  /**
   * Get the tech catalog with all available weapons and defenses
   */
  async getTechCatalog(): Promise<TechCatalogResponse | FactoryErrorResponse> {
    try {
      console.log('🏭 Fetching tech catalog...');
      
      const response = await fetch('/api/tech-catalog', {
        method: 'GET',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Tech catalog API error:', data);
        return { error: data.error || `HTTP ${response.status}: ${response.statusText}` };
      }

      console.log('📋 Tech catalog retrieved successfully');
      return data;
      
    } catch (error) {
      console.error('❌ Network error fetching tech catalog:', error);
      return { error: 'Network error occurred while fetching tech catalog' };
    }
  }

  /**
   * Get current build status including tech counts and build queue
   */
  async getBuildStatus(): Promise<BuildStatusResponse | FactoryErrorResponse> {
    try {
      console.log('🔧 Fetching build status...');
      
      const response = await fetch('/api/build-status', {
        method: 'GET',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Build status API error:', data);
        return { error: data.error || `HTTP ${response.status}: ${response.statusText}` };
      }

      console.log('✅ Build status retrieved successfully');
      return data;
      
    } catch (error) {
      console.error('❌ Network error fetching build status:', error);
      return { error: 'Network error occurred while fetching build status' };
    }
  }

  /**
   * Start building an item
   */
  async buildItem(itemKey: string, itemType: 'weapon' | 'defense'): Promise<BuildItemResponse | FactoryErrorResponse> {
    try {
      console.log(`🔨 Building ${itemType}: ${itemKey}`);
      
      const response = await fetch('/api/build-item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ itemKey, itemType }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Build item API error:', data);
        return { error: data.error || `HTTP ${response.status}: ${response.statusText}` };
      }

      console.log(`✅ Build started successfully for ${itemType}: ${itemKey}`);
      return data;
      
    } catch (error) {
      console.error('❌ Network error building item:', error);
      return { error: 'Network error occurred while building item' };
    }
  }

  /**
   * Complete the first build in queue (cheat mode for developers)
   */
  async completeBuild(): Promise<CompleteBuildResponse | FactoryErrorResponse> {
    try {
      console.log('⚡ Cheat: Completing first build in queue...');
      
      const response = await fetch('/api/complete-build', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Complete build API error:', data);
        return { error: data.error || `HTTP ${response.status}: ${response.statusText}` };
      }

      console.log('✅ Build completed successfully:', data.completedItem);
      return data;
      
    } catch (error) {
      console.error('❌ Network error completing build:', error);
      return { error: 'Network error occurred while completing build' };
    }
  }

  /**
   * Format duration for display
   */
  formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
  }

  /**
   * Format countdown timer for display
   */
  formatCountdown(seconds: number): string {
    if (seconds <= 0) return 'Complete';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Check if user can afford an item
   */
  canAfford(cost: number, availableIron: number): boolean {
    return availableIron >= cost;
  }

  /**
   * Get strength CSS class
   */
  getStrengthClass(strength: string): string {
    switch (strength.toLowerCase()) {
      case 'weak': return 'stat-weak';
      case 'medium': return 'stat-medium';
      case 'strong': return 'stat-strong';
      default: return '';
    }
  }

  /**
   * Get subtype CSS class
   */
  getSubtypeClass(subtype: string): string {
    return subtype.toLowerCase() === 'projectile' ? 'subtype-projectile' : 'subtype-energy';
  }
}

export const factoryService = new FactoryService();