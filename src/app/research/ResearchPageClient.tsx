'use client';

import React, { useState, useEffect, useRef } from 'react';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { researchService, TechTree, ResearchDef, ResearchType } from '@/lib/client/services/researchService';
import { userStatsService } from '@/lib/client/services/userStatsService';
import { globalEvents, EVENTS } from '@/lib/client/services/eventService';
import { ServerAuthState } from '@/lib/server/serverSession';
import { AllResearches, getResearchUpgradeCost, getResearchEffect } from '@/lib/server/techtree';
import './ResearchPage.css';

const researchTypeToKey: Record<ResearchType, keyof TechTree> = {
  IronHarvesting: 'ironHarvesting',
  ShipSpeed: 'shipSpeed',
  Afterburner: 'afterburner',
  // Projectile Weapons
  projectileDamage: 'projectileDamage',
  projectileReloadRate: 'projectileReloadRate',
  projectileAccuracy: 'projectileAccuracy',
  projectileWeaponTier: 'projectileWeaponTier',
  // Energy Weapons
  energyDamage: 'energyDamage',
  energyRechargeRate: 'energyRechargeRate',
  energyAccuracy: 'energyAccuracy',
  energyWeaponTier: 'energyWeaponTier',
  // Defense
  hullStrength: 'hullStrength',
  repairSpeed: 'repairSpeed',
  armorEffectiveness: 'armorEffectiveness',
  shieldEffectiveness: 'shieldEffectiveness',
  shieldRechargeRate: 'shieldRechargeRate',
  // Ship
  afterburnerSpeedIncrease: 'afterburnerSpeedIncrease',
  afterburnerDuration: 'afterburnerDuration',
  teleport: 'teleport',
  inventoryCapacity: 'inventoryCapacity',
  constructionSpeed: 'constructionSpeed',
  // Spies
  spyChance: 'spyChance',
  spySpeed: 'spySpeed',
  spySabotageDamage: 'spySabotageDamage',
  counterintelligence: 'counterintelligence',
  stealIron: 'stealIron',
} as const;

// Research hierarchy structure
interface ResearchNode {
  type: ResearchType;
  children?: ResearchNode[];
}

interface ResearchCategory {
  name: string;
  nodes: ResearchNode[];
}

const researchHierarchy: ResearchCategory[] = [
  {
    name: 'Projectile Weapons',
    nodes: [
      {
        type: 'projectileDamage' as ResearchType,
        children: [
          { type: 'projectileReloadRate' as ResearchType },
          { type: 'projectileAccuracy' as ResearchType },
          { type: 'projectileWeaponTier' as ResearchType }
        ]
      }
    ]
  },
  {
    name: 'Energy Weapons',
    nodes: [
      {
        type: 'energyDamage' as ResearchType,
        children: [
          { type: 'energyRechargeRate' as ResearchType },
          { type: 'energyAccuracy' as ResearchType },
          { type: 'energyWeaponTier' as ResearchType }
        ]
      }
    ]
  },
  {
    name: 'Defense',
    nodes: [
      {
        type: 'hullStrength' as ResearchType,
        children: [
          { type: 'repairSpeed' as ResearchType },
          { type: 'armorEffectiveness' as ResearchType },
          {
            type: 'shieldEffectiveness' as ResearchType,
            children: [
              { type: 'shieldRechargeRate' as ResearchType }
            ]
          }
        ]
      }
    ]
  },
  {
    name: 'Ship',
    nodes: [
      {
        type: 'shipSpeed' as ResearchType,
        children: [
          { type: 'afterburnerSpeedIncrease' as ResearchType },
          { type: 'afterburnerDuration' as ResearchType },
          { type: 'teleport' as ResearchType }
        ]
      },
      { type: 'inventoryCapacity' as ResearchType },
      {
        type: 'IronHarvesting' as ResearchType,
        children: [
          { type: 'constructionSpeed' as ResearchType }
        ]
      }
    ]
  },
  {
    name: 'Spies',
    nodes: [
      {
        type: 'spyChance' as ResearchType,
        children: [
          { type: 'spySpeed' as ResearchType },
          { type: 'spySabotageDamage' as ResearchType },
          { type: 'counterintelligence' as ResearchType },
          { type: 'stealIron' as ResearchType }
        ]
      }
    ]
  }
];

interface ResearchPageClientProps {
  auth: ServerAuthState;
}

// Tooltip component for showing next 20 levels
const CostTooltip: React.FC<{ research: ResearchDef; currentLevel: number }> = ({ research, currentLevel }) => {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const tooltipRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Calculate next 20 levels
  const futureData = [];
  const researchDef = AllResearches[research.type as keyof typeof AllResearches];
  
  for (let i = 1; i <= 20; i++) {
    const level = currentLevel + i;
    const cost = getResearchUpgradeCost(researchDef, level);
    const effect = getResearchEffect(researchDef, level);
    futureData.push({ level, cost, effect });
  }
  
  // Check position when tooltip is shown
  useEffect(() => {
    if (show && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const tooltipHeight = 400; // max-height of tooltip
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      
      // If not enough space above, show below
      if (spaceAbove < tooltipHeight && spaceBelow > spaceAbove) {
        setPosition('bottom');
      } else {
        setPosition('top');
      }
    }
  }, [show]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);
  
  const handleMouseEnter = () => {
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setShow(true);
  };
  
  const handleMouseLeave = () => {
    // Delay hiding the tooltip by 300ms to allow mouse to reach it
    hideTimeoutRef.current = setTimeout(() => {
      setShow(false);
    }, 300);
  };
  
  return (
    <div 
      ref={wrapperRef}
      className="tooltip-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="tooltip-trigger">ℹ️</span>
      {show && (
        <div 
          ref={tooltipRef}
          className={`tooltip-content tooltip-${position}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <table className="tooltip-table">
            <thead>
              <tr>
                <th>Level</th>
                <th>Cost</th>
                <th>Effect</th>
              </tr>
            </thead>
            <tbody>
              {futureData.map(({ level, cost, effect }) => (
                <tr key={level}>
                  <td>{level}</td>
                  <td>{Math.round(cost).toLocaleString()}</td>
                  <td>{Number.isInteger(effect) ? effect : effect.toFixed(1)} {research.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const ResearchPageClient: React.FC<ResearchPageClientProps> = () => {
  const [techTree, setTechTree] = useState<TechTree | null>(null);
  const [researches, setResearches] = useState<Record<ResearchType, ResearchDef> | null>(null);
  const [currentIron, setCurrentIron] = useState<number>(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch initial data
  const fetchData = async () => {
    try {
      setError(null);
      
      // Fetch tech tree and user stats in parallel
      const [techTreeResult, userStatsResult] = await Promise.all([
        researchService.getTechTree(),
        userStatsService.getUserStats()
      ]);

      if ('error' in techTreeResult) {
        setError(techTreeResult.error);
        return;
      }

      if ('error' in userStatsResult) {
        setError(userStatsResult.error);
        return;
      }

      setTechTree(techTreeResult.techTree);
      setResearches(techTreeResult.researches);
      setCurrentIron(userStatsResult.iron);

      // Set countdown if research is active
      if (techTreeResult.techTree.activeResearch) {
        setRemaining(Math.max(0, Math.round(techTreeResult.techTree.activeResearch.remainingDuration)));
      } else {
        setRemaining(null);
      }

    } catch (err) {
      setError('Failed to load research data');
      console.error('Error fetching research data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger research
  const handleTriggerResearch = async (type: ResearchType) => {
    if (!researches || isTriggering) return;

    const research = researches[type];
    if (!researchService.canAffordResearch(research, currentIron)) {
      setError('Insufficient iron for this research');
      return;
    }

    setIsTriggering(true);
    setError(null);

    try {
      const result = await researchService.triggerResearch(type);

      if ('error' in result) {
        setError(result.error);
        return;
      }

      // Refresh data after successful trigger
      await fetchData();
      
      // Emit event to update iron in StatusHeader
      globalEvents.emit(EVENTS.RESEARCH_TRIGGERED);

    } catch (err) {
      setError('Failed to trigger research');
      console.error('Error triggering research:', err);
    } finally {
      setIsTriggering(false);
    }
  };

  // Set up countdown timer
  useEffect(() => {
    if (remaining === null || remaining <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev === null || prev <= 1) {
          // Research completed, refresh data
          fetchData();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [remaining]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
    
    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="research-page">
          <div className="research-container">
            <h1 className="page-heading">Research</h1>
            <div className="loading-message">Loading research data...</div>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (error) {
    return (
      <AuthenticatedLayout>
        <div className="research-page">
          <div className="research-container">
            <h1 className="page-heading">Research</h1>
            <div className="error-message">
              Error: {error}
            </div>
            <button className="retry-button" onClick={fetchData}>Retry</button>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (!techTree || !researches) {
    return (
      <AuthenticatedLayout>
        <div className="research-page">
          <div className="research-container">
            <h1 className="page-heading">Research</h1>
            <div className="no-data-message">No research data available</div>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  const isAnyResearchActive = researchService.isResearchActive(techTree);

  // Helper function to render a research row
  const renderResearchRow = (researchType: ResearchType, indent: number = 0) => {
    const research = researches[researchType];
    if (!research) return null;

    const key = researchTypeToKey[research.type];
    const levelValue = techTree[key];
    // Ensure level is a number (TypeScript safety check)
    const level = typeof levelValue === 'number' ? levelValue : 0;
    const isActive = techTree.activeResearch?.type === research.type;
    const canUpgrade = !isAnyResearchActive && researchService.canAffordResearch(research, currentIron);

    return (
      <tr 
        key={research.type} 
        className={`data-row ${isActive ? 'active' : ''} ${isAnyResearchActive && !isActive ? 'disabled' : ''} indent-${indent}`}
      >
        <td className="data-cell">
          <span style={{ marginLeft: `${indent * 20}px` }}>{research.name}</span>
        </td>
        <td className="data-cell">
          {level}
        </td>
        <td className="data-cell">
          {researchService.formatEffect(research.currentEffect, research.unit)}
        </td>
        <td className="data-cell">
          {researchService.formatEffect(research.nextEffect, research.unit)}
        </td>
        <td className="data-cell">
          {researchService.formatDuration(research.nextUpgradeDuration)}
        </td>
        <td className="data-cell description-cell">
          {research.description}
        </td>
        <td className="data-cell action-cell">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isActive ? (
              <div className="research-countdown">
                {remaining !== null ? researchService.formatDuration(remaining) : 'Active'}
              </div>
            ) : isAnyResearchActive ? (
              <>
                <span className="cost-disabled">
                  {research.nextUpgradeCost.toLocaleString()}
                </span>
                <CostTooltip research={research} currentLevel={level} />
              </>
            ) : canUpgrade ? (
              <>
                <button
                  className="upgrade-button"
                  onClick={() => handleTriggerResearch(research.type)}
                  disabled={isTriggering}
                >
                  {isTriggering ? 'Processing...' : `Upgrade (${research.nextUpgradeCost.toLocaleString()})`}
                </button>
                <CostTooltip research={research} currentLevel={level} />
              </>
            ) : (
              <>
                <span className="cost-insufficient">
                  {research.nextUpgradeCost.toLocaleString()}
                </span>
                <CostTooltip research={research} currentLevel={level} />
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  // Helper function to render research nodes recursively
  const renderResearchNode = (node: ResearchNode, indent: number = 0): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    
    // Render the current node
    elements.push(renderResearchRow(node.type, indent));
    
    // Render children recursively if they exist
    if (node.children) {
      node.children.forEach(childNode => {
        elements.push(...renderResearchNode(childNode, indent + 1));
      });
    }
    
    return elements;
  };

  return (
    <AuthenticatedLayout>
      <div className="research-page">
        <div className="research-container">
          <h1 className="page-heading">Research</h1>
        
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="data-table-container">
            {researchHierarchy.map(category => (
              <div key={category.name} className="research-category">
                <h2 className="category-heading">{category.name}</h2>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Level</th>
                      <th>Current Value</th>
                      <th>Next Level Value</th>
                      <th>Upgrade Duration</th>
                      <th>Description</th>
                      <th>Upgrade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {category.nodes.flatMap(node => renderResearchNode(node, 0))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default ResearchPageClient;
