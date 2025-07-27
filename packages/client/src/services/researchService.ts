interface TechTree {
  ironHarvesting: number;
  shipVelocity: number;
  afterburner: number;
  activeResearch?: {
    type: ResearchType;
    remainingDuration: number;
  };
}

interface ResearchDef {
  type: ResearchType;
  name: string;
  level: number;
  baseUpgradeCost: number;
  baseUpgradeDuration: number;
  baseValue: number;
  upgradeCostIncrease: number;
  baseValueIncrease: { type: 'constant' | 'factor'; value: number };
  description: string;
  nextUpgradeCost: number;
  nextUpgradeDuration: number;
  currentEffect: number;
  nextEffect: number;
  unit: string;
}

type ResearchType = 'IronHarvesting' | 'ShipVelocity' | 'Afterburner';

interface TechtreeResponse {
  techTree: TechTree;
  researches: Record<ResearchType, ResearchDef>;
}

interface TriggerResearchRequest {
  type: ResearchType;
}

interface TriggerResearchResponse {
  success: boolean;
  message?: string;
}

class ResearchService {
  private baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://spacewars3.onrender.com/api' 
    : '/api';

  /**
   * Get current tech tree state and research definitions
   */
  async getTechTree(): Promise<TechtreeResponse | { error: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/techtree`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { 
          error: errorData.error || `Server error: ${response.status}` 
        };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Network error during getTechTree:', error);
      return { error: 'Network error' };
    }
  }

  /**
   * Trigger a new research
   */
  async triggerResearch(type: ResearchType): Promise<TriggerResearchResponse | { error: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/trigger-research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ type })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { 
          error: errorData.error || `Server error: ${response.status}` 
        };
      }

      const data = await response.json();
      return { success: true, message: data.message };
    } catch (error) {
      console.error('Network error during triggerResearch:', error);
      return { error: 'Network error' };
    }
  }

  /**
   * Check if research is currently active
   */
  isResearchActive(techTree: TechTree): boolean {
    return !!techTree.activeResearch;
  }

  /**
   * Get remaining time for active research in seconds
   */
  getRemainingTime(techTree: TechTree): number {
    return techTree.activeResearch?.remainingDuration || 0;
  }

  /**
   * Check if user can afford a research upgrade
   */
  canAffordResearch(research: ResearchDef, currentIron: number): boolean {
    return currentIron >= research.nextUpgradeCost;
  }

  /**
   * Format time duration as hh:mm:ss or mm:ss
   */
  formatDuration(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    
    return h > 0
      ? [h, m, sec].map(v => v.toString().padStart(2, '0')).join(':')
      : [m, sec].map(v => v.toString().padStart(2, '0')).join(':');
  }

  /**
   * Format research effect values with units
   */
  formatEffect(value: number, unit: string): string {
    return Number.isInteger(value) 
      ? `${value} ${unit}` 
      : `${value.toFixed(1)} ${unit}`;
  }
}

// Export singleton instance
export const researchService = new ResearchService();

// Export types for use in components
export type {
  TechTree,
  ResearchDef,
  ResearchType,
  TechtreeResponse,
  TriggerResearchRequest,
  TriggerResearchResponse
};
