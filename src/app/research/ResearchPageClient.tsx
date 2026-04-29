'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { researchService, TechTree, ResearchDef, ResearchType } from '@/lib/client/services/researchService';
import { userStatsService } from '@/lib/client/services/userStatsService';
import { globalEvents, EVENTS } from '@/lib/client/services/eventService';
import { getTimeMultiplier } from '@/lib/client/timeMultiplier';
import { ServerAuthState } from '@/lib/server/serverSession';
import { AllResearches, getResearchUpgradeCost, getResearchEffect } from '@/lib/server/techs/techtree';
import { formatNumber } from '@/shared/numberFormat';
import './ResearchPage.css';
import ResearchCardOverlay from '@/components/Research/ResearchCardOverlay';
import {
  formatIronCost,
  localizeResearchCategory,
  localizeResearchDefinition,
} from '@/lib/client/i18n/catalogTranslations';

const researchTypeToKey: Record<ResearchType, keyof TechTree> = {
  IronHarvesting: 'ironHarvesting',
  shipSpeed: 'shipSpeed',
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
  afterburnerCooldown: 'afterburnerCooldown',
  teleport: 'teleport',
  teleportRechargeSpeed: 'teleportRechargeSpeed',
  ironCapacity: 'ironCapacity',
  inventorySlots: 'inventorySlots',
  bridgeSlots: 'bridgeSlots',
  constructionSpeed: 'constructionSpeed',
  artificialIntelligence: 'artificialIntelligence',
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
  id: string;
  nodes: ResearchNode[];
}

const researchHierarchy: ResearchCategory[] = [
  {
    id: 'projectile-weapons',
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
    id: 'energy-weapons',
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
    id: 'defense',
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
    id: 'ship',
    nodes: [
      {
        type: 'shipSpeed' as ResearchType,
        children: [
          { type: 'afterburnerDuration' as ResearchType },
          { type: 'afterburnerCooldown' as ResearchType },
          { type: 'afterburnerSpeedIncrease' as ResearchType },
          { type: 'teleport' as ResearchType,
            children: [
              { type: 'teleportRechargeSpeed' as ResearchType }
            ]
          }
        ]
      },
      { type: 'ironCapacity' as ResearchType },
      { type: 'inventorySlots' as ResearchType },
      { type: 'bridgeSlots' as ResearchType },
      {
        type: 'IronHarvesting' as ResearchType,
        children: [
          {
            type: 'constructionSpeed' as ResearchType,
            children: [
              { type: 'artificialIntelligence' as ResearchType }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'spies',
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
  const t = useTranslations('research');
  const locale = useLocale();
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const tooltipRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Calculate next 20 levels
  const futureData = [];
  const researchDef = AllResearches[research.type as keyof typeof AllResearches];
  const localizedResearch = localizeResearchDefinition(research, locale);
  
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
                <th>{t('colLevel')}</th>
                <th>{t('colCost')}</th>
                <th>{t('colEffect')}</th>
              </tr>
            </thead>
            <tbody>
              {futureData.map(({ level, cost, effect }) => (
                <tr key={level}>
                  <td>{level}</td>
                  <td>{formatNumber(cost, locale)}</td>
                  <td>{formatNumber(effect, locale)} {localizedResearch.unit}</td>
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
  const t = useTranslations('research');
  const locale = useLocale();
  const [techTree, setTechTree] = useState<TechTree | null>(null);
  const [researches, setResearches] = useState<Record<ResearchType, ResearchDef> | null>(null);
  const [currentIron, setCurrentIron] = useState<number>(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Helper function to get research image name
  const getResearchImageName = (type: ResearchType): string => {
    const imageMap: Record<string, string> = {
      IronHarvesting: 'IronHarvesting',
      shipSpeed: 'ShipSpeed',
      projectileDamage: 'ProjectileDamage',
      projectileReloadRate: 'ReloadRate',
      projectileAccuracy: 'ProjectileAccuracy',
      energyDamage: 'EnergyDamage',
      energyRechargeRate: 'RechargeRate',
      energyAccuracy: 'EnergyAccuracy',
      hullStrength: 'HullStrength',
      repairSpeed: 'HullRepairSpeed',
      inventoryCapacity: 'IronCapacity',
      ironCapacity: 'IronCapacity',
      inventorySlots: 'InventorySlots',
      bridgeSlots: 'BridgeSlots',
      armorEffectiveness: 'ArmorEffectiveness',
      shieldEffectiveness: 'ShieldEffectiveness',
      shieldRechargeRate: 'ShieldRechargeRate',
      afterburnerSpeedIncrease: 'AfterburnerSpeed',
      afterburnerDuration: 'AfterburnerDuration',
      afterburnerCooldown: 'AfterburnerCooldown',
      // use the more descriptive 'Teleportation' images that were recently
      // added; the old 'Teleport' filenames remain in the repo but are no
      // longer referenced by the code.
      teleport: 'Teleportation',
      teleportRechargeSpeed: 'TeleportationRechargeSpeed',
      constructionSpeed: 'ConstructionSpeed',
      // Add more as available, fallback to IronHarvesting for now
    };
    return imageMap[type] || 'IronHarvesting';
  };

  // Helper function to get all research types from hierarchy
  const getAllResearchTypes = (node: ResearchNode): ResearchType[] => {
    const types: ResearchType[] = [node.type];
    if (node.children) {
      node.children.forEach(child => {
        types.push(...getAllResearchTypes(child));
      });
    }
    return types;
  };

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
      setError(locale.startsWith('de') ? 'Nicht genug Eisen fuer diese Forschung' : 'Insufficient iron for this research');
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
      setError(locale.startsWith('de') ? 'Forschung konnte nicht gestartet werden' : 'Failed to trigger research');
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
        if (prev === null) return null;
        const next = prev - getTimeMultiplier();
        if (next <= 0) {
          // Research completed, refresh data
          fetchData();
          return null;
        }
        return next;
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
            <h1 className="page-heading">{t('pageHeading')}</h1>
            <div className="loading-message">{t('loadingMessage')}</div>
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
            <h1 className="page-heading">{t('pageHeading')}</h1>
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
            <h1 className="page-heading">{t('pageHeading')}</h1>
            <div className="no-data-message">{t('noDataMessage')}</div>
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
    const localizedResearch = localizeResearchDefinition(research, locale);

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
          <span style={{ marginLeft: `${indent * 20}px` }}>{localizedResearch.name}</span>
        </td>
        <td className="data-cell">
          {level}
        </td>
        <td className="data-cell">
          {researchService.formatEffect(research.currentEffect, localizedResearch.unit, locale)}
        </td>
        <td className="data-cell">
          {researchService.formatEffect(research.nextEffect, localizedResearch.unit, locale)}
        </td>
        <td className="data-cell">
          {researchService.formatDuration(research.nextUpgradeDuration)}
        </td>
        <td className="data-cell description-cell">
          {localizedResearch.description}
        </td>
        <td className="data-cell action-cell">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isActive ? (
              <div className="research-countdown">
                {remaining !== null ? researchService.formatDuration(remaining) : t('activeStatus')}
              </div>
            ) : isAnyResearchActive ? (
              <>
                <span className="cost-disabled">
                  {formatNumber(research.nextUpgradeCost, locale)}
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
                  {isTriggering ? t('processingButton') : t('upgradeButton', { cost: formatNumber(research.nextUpgradeCost) })}
                </button>
                <CostTooltip research={research} currentLevel={level} />
              </>
            ) : (
              <>
                <span className="cost-insufficient">
                  {formatNumber(research.nextUpgradeCost, locale)}
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
          <h1 className="page-heading">{t('pageHeading')}</h1>
        
          {/* View Toggle */}
          <div className="view-toggle">
            <button
              className={`toggle-button ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
            >
              {t('viewCards')}
            </button>
            <button
              className={`toggle-button ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              {t('viewTable')}
            </button>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {viewMode === 'table' ? (
            <div className="data-table-container">
              {researchHierarchy.map(category => (
                <div key={category.id} className="research-category">
                  <h2 id={category.id} className="category-heading">{localizeResearchCategory(category.id, locale)}</h2>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('colName')}</th>
                        <th>{t('colLevel')}</th>
                        <th>{t('colCurrentValue')}</th>
                        <th>{t('colNextLevelValue')}</th>
                        <th>{t('colUpgradeDuration')}</th>
                        <th>{t('colDescription')}</th>
                        <th>{t('colUpgrade')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {category.nodes.flatMap(node => renderResearchNode(node, 0))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {researchHierarchy.map(category => (
                <div key={category.id} className="research-category">
                  <h2 id={category.id} className="category-heading">{localizeResearchCategory(category.id, locale)}</h2>
                  <div className="item-cards-grid">
                    {category.nodes.flatMap(node => getAllResearchTypes(node)).map(type => {
                      const research = researches[type];
                      if (!research) return null;
                      const localizedResearch = localizeResearchDefinition(research, locale);
                      
                      const key = researchTypeToKey[type];
                      const levelValue = techTree[key];
                      const level = typeof levelValue === 'number' ? levelValue : 0;
                      const isActive = techTree.activeResearch?.type === research.type;
                      const canUpgrade = !isAnyResearchActive && researchService.canAffordResearch(research, currentIron);
                      
                      return (
                        <div key={type} className="item-card">
                          <div className="research-image-container">
                            <Image 
                              src={`/assets/images/research/${getResearchImageName(type)}.png`} 
                              alt={`${localizedResearch.name} icon`} 
                              width={288}
                              height={288}
                              className="research-image" 
                            />
                            {/* overlay message when this card is active or locked by another research */}
                      {(() => {
                              const overlayType = isActive
                                ? 'inProgress' as const
                                : isAnyResearchActive
                                ? 'otherInProgress' as const
                                : null;
                              return overlayType ? <ResearchCardOverlay overlayType={overlayType} /> : null;
                            })()}
                          </div>
                          <div className="card-header">
                            <div className="card-title">{localizedResearch.name}</div>
                          </div>
                          <div className="card-details">
                            <div className="card-detail">
                              <div className="card-detail-label">{t('cardLabelLevel')}</div>
                              <div className="card-detail-value">{level}</div>
                            </div>
                            <div className="card-detail">
                              <div className="card-detail-label">{t('cardLabelCurrentEffect')}</div>
                              <div className="card-detail-value">
                                {researchService.formatEffect(research.currentEffect, localizedResearch.unit, locale)}
                              </div>
                            </div>
                            <div className="card-detail">
                              <div className="card-detail-label">{t('cardLabelNextEffect')}</div>
                              <div className="card-detail-value">
                                {researchService.formatEffect(research.nextEffect, localizedResearch.unit, locale)}
                              </div>
                            </div>
                            <div className="card-detail">
                              <div className="card-detail-label">{t('cardLabelDuration')}</div>
                              <div className="card-detail-value">
                                {researchService.formatDuration(research.nextUpgradeDuration)}
                              </div>
                            </div>
                            <div className="card-detail">
                              <div className="card-detail-label">{t('cardLabelCost')}</div>
                              <div className={`card-detail-value ${researchService.canAffordResearch(research, currentIron) ? 'cost-affordable' : 'cost-expensive'}`}>
                                {formatIronCost(research.nextUpgradeCost, locale)}
                              </div>
                            </div>
                          </div>
                          <div className="card-description">
                            {localizedResearch.description}
                          </div>
                          <div className="card-actions">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isActive ? (
                                // when this specific research is active we no longer show a button;
                                // instead render the remaining countdown using the same styling we
                                // already use in the table view.  (formatDuration is stubbed during
                                // tests and will update as `remaining` state changes.)
                                <div className="research-countdown">
                                  {remaining !== null ? researchService.formatDuration(remaining) : t('activeStatus')}
                                </div>
                              ) : (
                                <>
                                  <button
                                    className="build-button"
                                    disabled={!canUpgrade}
                                    onClick={() => handleTriggerResearch(type)}
                                  >
                                  {isTriggering ? t('triggeringButton') : t('researchButton')}
                                  </button>
                                  <CostTooltip research={research} currentLevel={level} />
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fixed overlay showing active research name and remaining time */}
      {techTree?.activeResearch && researches && (
        <div className="research-progress-overlay">
          <div className="research-progress-content">
            <span className="research-progress-label">{t('inProgressLabel')}</span>
            <span className="research-progress-name">
              {researches[techTree.activeResearch.type]
                ? localizeResearchDefinition(researches[techTree.activeResearch.type], locale).name
                : techTree.activeResearch.type}
            </span>
            <span className="research-progress-separator">|</span>
            <span className="research-progress-timer">
              {remaining !== null ? researchService.formatDuration(remaining) : '...'}
            </span>
          </div>
        </div>
      )}
    </AuthenticatedLayout>
  );
};

export default ResearchPageClient;
