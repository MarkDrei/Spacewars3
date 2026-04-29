'use client';

import React, { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { useUserStats } from '@/lib/client/hooks/useUserStats';
import { useBuildQueue } from '@/lib/client/hooks/useBuildQueue';
import { useTechCounts } from '@/lib/client/hooks/useTechCounts';
import { 
  factoryService, 
  getTechCount
} from '@/lib/client/services/factoryService';
import {
  formatIronCost,
  localizeFactoryDefense,
  localizeFactoryItemType,
  localizeFactoryStrength,
  localizeFactorySubtype,
  localizeFactoryWeapon,
} from '@/lib/client/i18n/catalogTranslations';
import { ServerAuthState } from '@/lib/server/serverSession';
import './FactoryPage.css';

interface FactoryPageClientProps {
  auth: ServerAuthState;
}

const FactoryPageClient: React.FC<FactoryPageClientProps> = ({ auth }) => {
  // Auth is guaranteed by server, so pass true to hooks
  const { ironAmount } = useUserStats();
  const t = useTranslations('factory');
  const locale = useLocale();
  const {
    buildQueue,
    isLoading: isBuildQueueLoading,
    isBuilding,
    isCompletingBuild,
    error: buildQueueError,
    buildItem,
    completeBuild,
    refetch: refetchBuildQueue
  } = useBuildQueue(); // Auth guaranteed by server
  const {
    techCounts,
    weapons,
    defenses,
    isLoading: isTechCountsLoading,
    error: techCountsError,
    refetch: refetchTechCounts
  } = useTechCounts(); // Auth guaranteed by server

  // View mode state
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Build count state: keyed by itemKey, defaults to 1
  const [buildCounts, setBuildCounts] = useState<Record<string, number>>({});
  const longPressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getBuildCount = (key: string): number => buildCounts[key] ?? 1;

  const changeBuildCount = useCallback((key: string, delta: number) => {
    setBuildCounts(prev => ({
      ...prev,
      [key]: Math.max(1, (prev[key] ?? 1) + delta),
    }));
  }, []);

  const startLongPress = useCallback((key: string, delta: number) => {
    if (longPressIntervalRef.current) return;
    longPressIntervalRef.current = setInterval(() => {
      changeBuildCount(key, delta);
    }, 150);
  }, [changeBuildCount]);

  const stopLongPress = useCallback(() => {
    if (longPressIntervalRef.current) {
      clearInterval(longPressIntervalRef.current);
      longPressIntervalRef.current = null;
    }
  }, []);

  // Cleanup long-press interval on unmount
  React.useEffect(() => {
    return () => {
      if (longPressIntervalRef.current) {
        clearInterval(longPressIntervalRef.current);
        longPressIntervalRef.current = null;
      }
    };
  }, []);

  // Combine loading and error states from both hooks
  const isLoading = isBuildQueueLoading || isTechCountsLoading;
  const error = buildQueueError || techCountsError;

  // Helper function to get tech image name
  const getTechImageName = (key: string): string => {
    const imageMap: Record<string, string> = {
      // Weapons
      pulse_laser: 'PulseLaser',
      auto_turret: 'AutoTurret',
      plasma_lance: 'PlasmaLance',
      gauss_rifle: 'GaussRifle',
      photon_torpedo: 'PhotonTorpedo',
      rocket_launcher: 'RocketLauncher',
      // Defenses
      ship_hull: 'ShipHull',
      kinetic_armor: 'Gemini_Generated_Image_cpd1s1cpd1s1cpd1', // Assuming this is kinetic armor
      energy_shield: 'EnergyShield',
      missile_jammer: 'MissileJammer',
    };
    return imageMap[key] || key;
  };

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="factory-page">
          <div className="factory-container">
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
        <div className="factory-page">
          <div className="factory-container">
            <h1 className="page-heading">{t('pageHeading')}</h1>
            <div className="error-message">
              Error: {error}
            </div>
            <button className="retry-button" onClick={() => {
              refetchBuildQueue();
              refetchTechCounts();
            }}>Retry</button>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (!techCounts) {
    return (
      <AuthenticatedLayout>
        <div className="factory-page">
          <div className="factory-container">
            <h1 className="page-heading">{t('pageHeading')}</h1>
            <div className="no-data-message">{t('noDataMessage')}</div>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  const getLocalizedWeapon = (key: string) => localizeFactoryWeapon(key, weapons[key], locale);
  const getLocalizedDefense = (key: string) => localizeFactoryDefense(key, defenses[key], locale);

  const renderBuildControls = (key: string, itemType: 'weapon' | 'defense', baseCost: number) => {
    const count = getBuildCount(key);
    // Only check affordability for one item: iron is charged per build start, not per queued item.
    // The first item is charged immediately; subsequent items are charged when each build starts.
    const canAfford = factoryService.canAfford(baseCost, ironAmount);
    return (
      <div className="build-controls">
        <button
          className="build-button"
          disabled={!canAfford || isBuilding}
          onClick={() => buildItem(key, itemType, count)}
        >
          {isBuilding ? t('buildingButton') : t('buildButton', { count })}
        </button>
        <button
          className="build-count-btn"
          disabled={isBuilding || count <= 1}
          onClick={() => changeBuildCount(key, -1)}
          onMouseDown={() => count > 2 && startLongPress(key, -1)}
          onMouseUp={stopLongPress}
          onMouseLeave={stopLongPress}
          onTouchStart={() => count > 2 && startLongPress(key, -1)}
          onTouchEnd={stopLongPress}
          aria-label="Decrease build count"
        >
          −
        </button>
        <button
          className="build-count-btn"
          disabled={isBuilding}
          onClick={() => changeBuildCount(key, 1)}
          onMouseDown={() => startLongPress(key, 1)}
          onMouseUp={stopLongPress}
          onMouseLeave={stopLongPress}
          onTouchStart={() => startLongPress(key, 1)}
          onTouchEnd={stopLongPress}
          aria-label="Increase build count"
        >
          +
        </button>
      </div>
    );
  };

  return (
    <AuthenticatedLayout>
      <div className="factory-page">
        <div className="factory-container">
          <h1 className="page-heading">{t('pageHeading')}</h1>
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

          {/* Build Queue Section */}
          <h2 id="build-queue" className="section-header">{t('buildQueueHeading')}</h2>
          {buildQueue.length === 0 ? (
            <div className="no-build-queue-message">{t('noBuildQueueMessage')}</div>
          ) : (
            <>
              <div className="data-table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('colItem')}</th>
                      <th>{t('colType')}</th>
                      <th>{t('colTimeRemaining')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildQueue.map((item, index) => (
                      <tr key={`${item.itemKey}-${index}`} className="data-row">
                        <td className="data-cell">
                          <span className="stat-value">
                            {item.itemType === 'weapon'
                              ? weapons[item.itemKey]?.name ?? item.itemKey
                              : defenses[item.itemKey]
                                ? getLocalizedDefense(item.itemKey).name
                                : item.itemKey}
                          </span>
                        </td>
                        <td className="data-cell">
                          {localizeFactoryItemType(item.itemType, locale)}
                        </td>
                        <td className="data-cell">
                          <span className="research-countdown">
                            {factoryService.formatCountdown(item.remainingSeconds)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cheat Mode Button - Only for test users 'a' and 'q' */}
              {(auth.username === 'a' || auth.username === 'q') && (
                <div className="cheat-section">
                  <button
                    className="cheat-button"
                    onClick={completeBuild}
                    disabled={isCompletingBuild || buildQueue.length === 0}
                  >
                    {isCompletingBuild ? t('completingButton') : t('completeBuildCheat')}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Defense Items Section */}
          <h2 id="defense-systems" className="section-header">{t('defenseSystemsHeading')}</h2>
          {viewMode === 'table' ? (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('colName')}</th>
                    <th>{t('colCurrentCount')}</th>
                    <th>{t('colCost')}</th>
                    <th>{t('colBuildDuration')}</th>
                    <th>{t('colDescription')}</th>
                    <th>{t('colAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(defenses).map(([key, defense]) => {
                    const localizedDefense = getLocalizedDefense(key);

                    return (
                    <tr key={key} className="data-row">
                      <td className="data-cell">
                        <span className="stat-value">{localizedDefense.name}</span>
                      </td>
                      <td className="data-cell">
                        <span className="stat-value">
                          {getTechCount(techCounts, key)}
                        </span>
                      </td>
                      <td className="data-cell">
                        <span className={factoryService.canAfford(defense.baseCost, ironAmount) ? 'cost-affordable' : 'cost-expensive'}>
                          {formatIronCost(defense.baseCost, locale)}
                        </span>
                      </td>
                      <td className="data-cell">
                        {factoryService.formatDuration(defense.buildDurationMinutes)}
                      </td>
                      <td className="data-cell description-cell">
                        {localizedDefense.description}
                      </td>
                      <td className="data-cell action-cell">
                        {renderBuildControls(key, 'defense', defense.baseCost)}
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="item-cards-grid">
              {Object.entries(defenses).map(([key, defense]) => {
                const localizedDefense = getLocalizedDefense(key);

                return (
                <div key={key} className="item-card">                <div className="weapon-image-container">
                  <Image 
                    src={`/assets/images/factory/${getTechImageName(key)}.png`} 
                    alt={`${localizedDefense.name} icon`} 
                    width={288}
                    height={288}
                    className="weapon-image" 
                  />
                </div>                  <div className="card-header">
                    <div className="card-title">{localizedDefense.name}</div>
                  </div>
                  <div className="card-details">
                    <div className="card-detail">
                      <div className="card-detail-label">{t('colCurrentCount')}</div>
                      <div className="card-detail-value stat-value">
                        {getTechCount(techCounts, key)}
                      </div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">{t('colCost')}</div>
                      <div className={`card-detail-value ${factoryService.canAfford(defense.baseCost, ironAmount) ? 'cost-affordable' : 'cost-expensive'}`}>
                        {formatIronCost(defense.baseCost, locale)}
                      </div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">{t('colBuildDuration')}</div>
                      <div className="card-detail-value">
                        {factoryService.formatDuration(defense.buildDurationMinutes)}
                      </div>
                    </div>
                  </div>
                  <div className="card-description">
                    {localizedDefense.description}
                  </div>
                  <div className="card-actions">
                    {renderBuildControls(key, 'defense', defense.baseCost)}
                  </div>
                </div>
              );})}
            </div>
          )}

          {/* Weapons Section */}
          <h2 id="projectile-weapons" className="section-header">{t('projectileWeaponsHeading')}</h2>
          {viewMode === 'table' ? (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('colName')}</th>
                    <th>{t('colStrength')}</th>
                    <th>{t('colCount')}</th>
                    <th>{t('colDamage')}</th>
                    <th>{t('colAccuracy')}</th>
                    <th>{t('colReload')}</th>
                    <th>{t('colCost')}</th>
                    <th>{t('colBuildTime')}</th>
                    <th>{t('colAdvantage')}</th>
                    <th>{t('colAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(weapons).filter(([, weapon]) => weapon.subtype === 'Projectile').map(([key, weapon]) => {
                    const localizedWeapon = getLocalizedWeapon(key);

                    return (
                    <tr key={key} className="data-row">
                      <td className="data-cell">
                        <span className="stat-value">{localizedWeapon.name}</span>
                      </td>
                      <td className="data-cell">
                        <span className={`stat-value ${factoryService.getStrengthClass(weapon.strength)}`}>
                          {localizeFactoryStrength(weapon.strength, locale)}
                        </span>
                      </td>
                      <td className="data-cell">
                        <span className="stat-value">
                          {getTechCount(techCounts, key)}
                        </span>
                      </td>
                      <td className="data-cell">
                        {weapon.baseDamage}
                      </td>
                      <td className="data-cell">
                        {weapon.baseAccuracy}%
                      </td>
                      <td className="data-cell">
                        {factoryService.formatDuration(weapon.reloadTimeMinutes)}
                      </td>
                      <td className="data-cell">
                        <span className={factoryService.canAfford(weapon.baseCost, ironAmount) ? 'cost-affordable' : 'cost-expensive'}>
                          {formatIronCost(weapon.baseCost, locale)}
                        </span>
                      </td>
                      <td className="data-cell">
                        {factoryService.formatDuration(weapon.buildDurationMinutes)}
                      </td>
                      <td className="data-cell description-cell">
                        {localizedWeapon.advantage}
                        {weapon.disadvantage && (
                          <><br /><em>{t('weaknessLabel', { weakness: localizedWeapon.disadvantage })}</em></>
                        )}
                      </td>
                      <td className="data-cell action-cell">
                        {renderBuildControls(key, 'weapon', weapon.baseCost)}
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="item-cards-grid">
              {Object.entries(weapons).filter(([, weapon]) => weapon.subtype === 'Projectile').map(([key, weapon]) => {
                const localizedWeapon = getLocalizedWeapon(key);

                return (
                <div key={key} className="item-card">
                  <div className="weapon-image-container">
                    <Image 
                      src={`/assets/images/factory/${getTechImageName(key)}.png`} 
                      alt={`${localizedWeapon.name} icon`} 
                      width={288}
                      height={288}
                      className="weapon-image" 
                    />
                  </div>
                  <div className="card-header">
                    <div className="card-title">{localizedWeapon.name}</div>
                    <div className={`card-type subtype-badge ${factoryService.getSubtypeClass(weapon.subtype)}`}>
                      {localizeFactorySubtype(weapon.subtype, locale)}
                    </div>
                  </div>
                  <div className="card-details">
                    <div className="card-detail">
                      <div className="card-detail-label">{t('colStrength')}</div>
                      <div className={`card-detail-value stat-value ${factoryService.getStrengthClass(weapon.strength)}`}>
                        {localizeFactoryStrength(weapon.strength, locale)}
                      </div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">{t('colCount')}</div>
                      <div className="card-detail-value stat-value">
                        {getTechCount(techCounts, key)}
                      </div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">{t('colDamage')}</div>
                      <div className="card-detail-value">{weapon.baseDamage}</div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">{t('colAccuracy')}</div>
                      <div className="card-detail-value">{weapon.baseAccuracy}%</div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">{t('colReload')}</div>
                      <div className="card-detail-value">
                        {factoryService.formatDuration(weapon.reloadTimeMinutes)}
                      </div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">{t('colCost')}</div>
                      <div className={`card-detail-value ${factoryService.canAfford(weapon.baseCost, ironAmount) ? 'cost-affordable' : 'cost-expensive'}`}>
                        {formatIronCost(weapon.baseCost, locale)}
                      </div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">{t('colBuildTime')}</div>
                      <div className="card-detail-value">
                        {factoryService.formatDuration(weapon.buildDurationMinutes)}
                      </div>
                    </div>
                  </div>
                  <div className="card-description">
                    {localizedWeapon.advantage}
                    {weapon.disadvantage && (
                      <><br /><em>{t('weaknessLabel', { weakness: localizedWeapon.disadvantage })}</em></>
                    )}
                  </div>
                  <div className="card-actions">
                    {renderBuildControls(key, 'weapon', weapon.baseCost)}
                  </div>
                </div>
              );})}
            </div>
          )}

          <h2 id="energy-weapons" className="section-header">{t('energyWeaponsHeading')}</h2>
          {viewMode === 'table' ? (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('colName')}</th>
                    <th>{t('colStrength')}</th>
                    <th>{t('colCount')}</th>
                    <th>{t('colDamage')}</th>
                    <th>{t('colAccuracy')}</th>
                    <th>{t('colReload')}</th>
                    <th>{t('colCost')}</th>
                    <th>{t('colBuildTime')}</th>
                    <th>{t('colAdvantage')}</th>
                    <th>{t('colAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(weapons).filter(([, weapon]) => weapon.subtype === 'Energy').map(([key, weapon]) => {
                    const localizedWeapon = getLocalizedWeapon(key);

                    return (
                    <tr key={key} className="data-row">
                      <td className="data-cell">
                        <span className="stat-value">{localizedWeapon.name}</span>
                      </td>
                      <td className="data-cell">
                        <span className={`stat-value ${factoryService.getStrengthClass(weapon.strength)}`}>
                          {localizeFactoryStrength(weapon.strength, locale)}
                        </span>
                      </td>
                      <td className="data-cell">
                        <span className="stat-value">
                          {getTechCount(techCounts, key)}
                        </span>
                      </td>
                      <td className="data-cell">
                        {weapon.baseDamage}
                      </td>
                      <td className="data-cell">
                        {weapon.baseAccuracy}%
                      </td>
                      <td className="data-cell">
                        {factoryService.formatDuration(weapon.reloadTimeMinutes)}
                      </td>
                      <td className="data-cell">
                        <span className={factoryService.canAfford(weapon.baseCost, ironAmount) ? 'cost-affordable' : 'cost-expensive'}>
                          {formatIronCost(weapon.baseCost, locale)}
                        </span>
                      </td>
                      <td className="data-cell">
                        {factoryService.formatDuration(weapon.buildDurationMinutes)}
                      </td>
                      <td className="data-cell description-cell">
                        {localizedWeapon.advantage}
                        {weapon.disadvantage && (
                          <><br /><em>{t('weaknessLabel', { weakness: localizedWeapon.disadvantage })}</em></>
                        )}
                      </td>
                      <td className="data-cell action-cell">
                        {renderBuildControls(key, 'weapon', weapon.baseCost)}
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="item-cards-grid">
              {Object.entries(weapons).filter(([, weapon]) => weapon.subtype === 'Energy').map(([key, weapon]) => {
                const localizedWeapon = getLocalizedWeapon(key);

                return (
                <div key={key} className="item-card">
                  <div className="weapon-image-container">
                    <Image 
                      src={`/assets/images/factory/${getTechImageName(key)}.png`} 
                      alt={`${localizedWeapon.name} icon`} 
                      width={288}
                      height={288}
                      className="weapon-image" 
                    />
                  </div>
                  <div className="card-header">
                    <div className="card-title">{localizedWeapon.name}</div>
                    <div className={`card-type subtype-badge ${factoryService.getSubtypeClass(weapon.subtype)}`}>
                      {localizeFactorySubtype(weapon.subtype, locale)}
                    </div>
                  </div>
                  <div className="card-details">
                    <div className="card-detail">
                      <div className="card-detail-label">{t('colStrength')}</div>
                      <div className={`card-detail-value stat-value ${factoryService.getStrengthClass(weapon.strength)}`}>
                        {localizeFactoryStrength(weapon.strength, locale)}
                      </div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">{t('colCount')}</div>
                      <div className="card-detail-value stat-value">
                        {getTechCount(techCounts, key)}
                      </div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">{t('colDamage')}</div>
                      <div className="card-detail-value">{weapon.baseDamage}</div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">{t('colAccuracy')}</div>
                      <div className="card-detail-value">{weapon.baseAccuracy}%</div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">{t('colReload')}</div>
                      <div className="card-detail-value">
                        {factoryService.formatDuration(weapon.reloadTimeMinutes)}
                      </div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">{t('colCost')}</div>
                      <div className={`card-detail-value ${factoryService.canAfford(weapon.baseCost, ironAmount) ? 'cost-affordable' : 'cost-expensive'}`}>
                        {formatIronCost(weapon.baseCost, locale)}
                      </div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">{t('colBuildTime')}</div>
                      <div className="card-detail-value">
                        {factoryService.formatDuration(weapon.buildDurationMinutes)}
                      </div>
                    </div>
                  </div>
                  <div className="card-description">
                    {localizedWeapon.advantage}
                    {weapon.disadvantage && (
                      <><br /><em>{t('weaknessLabel', { weakness: localizedWeapon.disadvantage })}</em></>
                    )}
                  </div>
                  <div className="card-actions">
                    {renderBuildControls(key, 'weapon', weapon.baseCost)}
                  </div>
                </div>
              );})}
            </div>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default FactoryPageClient;