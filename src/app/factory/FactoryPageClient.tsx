'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { useIron } from '@/lib/client/hooks/useIron';
import { useBuildQueue } from '@/lib/client/hooks/useBuildQueue';
import { useTechCounts } from '@/lib/client/hooks/useTechCounts';
import { 
  factoryService, 
  getTechCount
} from '@/lib/client/services/factoryService';
import { ServerAuthState } from '@/lib/server/serverSession';
import './FactoryPage.css';

interface FactoryPageClientProps {
  auth: ServerAuthState;
}

const FactoryPageClient: React.FC<FactoryPageClientProps> = ({ auth }) => {
  // Auth is guaranteed by server, so pass true to hooks
  const { ironAmount } = useIron();
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
            <h1 className="page-heading">Factory</h1>
            <div className="loading-message">Loading factory data...</div>
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
            <h1 className="page-heading">Factory</h1>
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
            <h1 className="page-heading">Factory</h1>
            <div className="no-data-message">No factory data available</div>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="factory-page">
        <div className="factory-container">
          <h1 className="page-heading">Factory</h1>

          {/* View Toggle */}
          <div className="view-toggle">
            <button
              className={`toggle-button ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
            >
              Cards
            </button>
            <button
              className={`toggle-button ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              Table
            </button>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Build Queue Section */}
          {buildQueue.length > 0 && (
            <>
              <h2 id="build-queue" className="section-header">Build Queue</h2>
              {viewMode === 'table' ? (
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Type</th>
                        <th>Time Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buildQueue.map((item, index) => (
                        <tr key={`${item.itemKey}-${index}`} className="data-row">
                          <td className="data-cell">
                            <span className="stat-value">
                              {item.itemType === 'weapon' ? weapons[item.itemKey]?.name : defenses[item.itemKey]?.name || item.itemKey}
                            </span>
                          </td>
                          <td className="data-cell">
                            {item.itemType}
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
              ) : (
                <div className="build-queue-cards">
                  {buildQueue.map((item, index) => (
                    <div key={`${item.itemKey}-${index}`} className="queue-card">
                      <div className="queue-card-item">
                        {item.itemType === 'weapon' ? weapons[item.itemKey]?.name : defenses[item.itemKey]?.name || item.itemKey}
                      </div>
                      <div className="queue-card-type">{item.itemType}</div>
                      <div className="queue-card-time">
                        {factoryService.formatCountdown(item.remainingSeconds)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Cheat Mode Button - Only for test users 'a' and 'q' */}
              {(auth.username === 'a' || auth.username === 'q') && (
                <div className="cheat-section">
                  <button
                    className="cheat-button"
                    onClick={completeBuild}
                    disabled={isCompletingBuild || buildQueue.length === 0}
                  >
                    {isCompletingBuild ? 'Completing...' : '⚡ Complete First Build (Cheat)'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Defense Items Section */}
          <h2 id="defense-systems" className="section-header">Defense Systems</h2>
          {viewMode === 'table' ? (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Current Count</th>
                    <th>Cost</th>
                    <th>Build Duration</th>
                    <th>Description</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(defenses).map(([key, defense]) => (
                    <tr key={key} className="data-row">
                      <td className="data-cell">
                        <span className="stat-value">{defense.name}</span>
                      </td>
                      <td className="data-cell">
                        <span className="stat-value">
                          {getTechCount(techCounts, key)}
                        </span>
                      </td>
                      <td className="data-cell">
                        <span className={factoryService.canAfford(defense.baseCost, ironAmount) ? 'cost-affordable' : 'cost-expensive'}>
                          {defense.baseCost.toLocaleString()} Iron
                        </span>
                      </td>
                      <td className="data-cell">
                        {factoryService.formatDuration(defense.buildDurationMinutes)}
                      </td>
                      <td className="data-cell description-cell">
                        {defense.description}
                      </td>
                      <td className="data-cell action-cell">
                        <button
                          className="build-button"
                          disabled={!factoryService.canAfford(defense.baseCost, ironAmount) || isBuilding}
                          onClick={() => buildItem(key, 'defense')}
                        >
                          {isBuilding ? 'Building...' : 'Build'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="item-cards-grid">
              {Object.entries(defenses).map(([key, defense]) => (
                <div key={key} className="item-card">                <div className="weapon-image-container">
                  <Image 
                    src={`/assets/images/factory/${getTechImageName(key)}.png`} 
                    alt={`${defense.name} icon`} 
                    width={288}
                    height={288}
                    className="weapon-image" 
                  />
                </div>                  <div className="card-header">
                    <div className="card-title">{defense.name}</div>
                  </div>
                  <div className="card-details">
                    <div className="card-detail">
                      <div className="card-detail-label">Current Count</div>
                      <div className="card-detail-value stat-value">
                        {getTechCount(techCounts, key)}
                      </div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">Cost</div>
                      <div className={`card-detail-value ${factoryService.canAfford(defense.baseCost, ironAmount) ? 'cost-affordable' : 'cost-expensive'}`}>
                        {defense.baseCost.toLocaleString()} Iron
                      </div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">Build Duration</div>
                      <div className="card-detail-value">
                        {factoryService.formatDuration(defense.buildDurationMinutes)}
                      </div>
                    </div>
                  </div>
                  <div className="card-description">
                    {defense.description}
                  </div>
                  <div className="card-actions">
                    <button
                      className="build-button"
                      disabled={!factoryService.canAfford(defense.baseCost, ironAmount) || isBuilding}
                      onClick={() => buildItem(key, 'defense')}
                    >
                      {isBuilding ? 'Building...' : 'Build'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Weapons Section */}
          <h2 id="projectile-weapons" className="section-header">Projectile Weapons</h2>
          {viewMode === 'table' ? (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Strength</th>
                    <th>Count</th>
                    <th>Damage</th>
                    <th>Accuracy</th>
                    <th>Reload</th>
                    <th>Cost</th>
                    <th>Build Time</th>
                    <th>Advantage</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(weapons).filter(([, weapon]) => weapon.subtype === 'Projectile').map(([key, weapon]) => (
                    <tr key={key} className="data-row">
                      <td className="data-cell">
                        <span className="stat-value">{weapon.name}</span>
                      </td>
                      <td className="data-cell">
                        <span className={`stat-value ${factoryService.getStrengthClass(weapon.strength)}`}>
                          {weapon.strength}
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
                          {weapon.baseCost.toLocaleString()} Iron
                        </span>
                      </td>
                      <td className="data-cell">
                        {factoryService.formatDuration(weapon.buildDurationMinutes)}
                      </td>
                      <td className="data-cell description-cell">
                        {weapon.advantage}
                        {weapon.disadvantage && (
                          <><br /><em>Weakness: {weapon.disadvantage}</em></>
                        )}
                      </td>
                      <td className="data-cell action-cell">
                        <button
                          className="build-button"
                          disabled={!factoryService.canAfford(weapon.baseCost, ironAmount) || isBuilding}
                          onClick={() => buildItem(key, 'weapon')}
                        >
                          {isBuilding ? 'Building...' : 'Build'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="item-cards-grid">
              {Object.entries(weapons).filter(([, weapon]) => weapon.subtype === 'Projectile').map(([key, weapon]) => (
                <div key={key} className="item-card">
                  <div className="weapon-image-container">
                    <Image 
                      src={`/assets/images/factory/${getTechImageName(key)}.png`} 
                      alt={`${weapon.name} icon`} 
                      width={288}
                      height={288}
                      className="weapon-image" 
                    />
                  </div>
                  <div className="card-header">
                    <div className="card-title">{weapon.name}</div>
                    <div className={`card-type subtype-badge ${factoryService.getSubtypeClass(weapon.subtype)}`}>
                      {weapon.subtype}
                    </div>
                  </div>
                  <div className="card-details">
                    <div className="card-detail">
                      <div className="card-detail-label">Strength</div>
                      <div className={`card-detail-value stat-value ${factoryService.getStrengthClass(weapon.strength)}`}>
                        {weapon.strength}
                      </div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">Count</div>
                      <div className="card-detail-value stat-value">
                        {getTechCount(techCounts, key)}
                      </div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">Damage</div>
                      <div className="card-detail-value">{weapon.baseDamage}</div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">Accuracy</div>
                      <div className="card-detail-value">{weapon.baseAccuracy}%</div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">Reload</div>
                      <div className="card-detail-value">
                        {factoryService.formatDuration(weapon.reloadTimeMinutes)}
                      </div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">Cost</div>
                      <div className={`card-detail-value ${factoryService.canAfford(weapon.baseCost, ironAmount) ? 'cost-affordable' : 'cost-expensive'}`}>
                        {weapon.baseCost.toLocaleString()} Iron
                      </div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">Build Time</div>
                      <div className="card-detail-value">
                        {factoryService.formatDuration(weapon.buildDurationMinutes)}
                      </div>
                    </div>
                  </div>
                  <div className="card-description">
                    {weapon.advantage}
                    {weapon.disadvantage && (
                      <><br /><em>Weakness: {weapon.disadvantage}</em></>
                    )}
                  </div>
                  <div className="card-actions">
                    <button
                      className="build-button"
                      disabled={!factoryService.canAfford(weapon.baseCost, ironAmount) || isBuilding}
                      onClick={() => buildItem(key, 'weapon')}
                    >
                      {isBuilding ? 'Building...' : 'Build'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h2 id="energy-weapons" className="section-header">Energy Weapons</h2>
          {viewMode === 'table' ? (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Strength</th>
                    <th>Count</th>
                    <th>Damage</th>
                    <th>Accuracy</th>
                    <th>Reload</th>
                    <th>Cost</th>
                    <th>Build Time</th>
                    <th>Advantage</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(weapons).filter(([, weapon]) => weapon.subtype === 'Energy').map(([key, weapon]) => (
                    <tr key={key} className="data-row">
                      <td className="data-cell">
                        <span className="stat-value">{weapon.name}</span>
                      </td>
                      <td className="data-cell">
                        <span className={`stat-value ${factoryService.getStrengthClass(weapon.strength)}`}>
                          {weapon.strength}
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
                          {weapon.baseCost.toLocaleString()} Iron
                        </span>
                      </td>
                      <td className="data-cell">
                        {factoryService.formatDuration(weapon.buildDurationMinutes)}
                      </td>
                      <td className="data-cell description-cell">
                        {weapon.advantage}
                        {weapon.disadvantage && (
                          <><br /><em>Weakness: {weapon.disadvantage}</em></>
                        )}
                      </td>
                      <td className="data-cell action-cell">
                        <button
                          className="build-button"
                          disabled={!factoryService.canAfford(weapon.baseCost, ironAmount) || isBuilding}
                          onClick={() => buildItem(key, 'weapon')}
                        >
                          {isBuilding ? 'Building...' : 'Build'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="item-cards-grid">
              {Object.entries(weapons).filter(([, weapon]) => weapon.subtype === 'Energy').map(([key, weapon]) => (
                <div key={key} className="item-card">
                  <div className="weapon-image-container">
                    <Image 
                      src={`/assets/images/factory/${getTechImageName(key)}.png`} 
                      alt={`${weapon.name} icon`} 
                      width={288}
                      height={288}
                      className="weapon-image" 
                    />
                  </div>
                  <div className="card-header">
                    <div className="card-title">{weapon.name}</div>
                    <div className={`card-type subtype-badge ${factoryService.getSubtypeClass(weapon.subtype)}`}>
                      {weapon.subtype}
                    </div>
                  </div>
                  <div className="card-details">
                    <div className="card-detail">
                      <div className="card-detail-label">Strength</div>
                      <div className={`card-detail-value stat-value ${factoryService.getStrengthClass(weapon.strength)}`}>
                        {weapon.strength}
                      </div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">Count</div>
                      <div className="card-detail-value stat-value">
                        {getTechCount(techCounts, key)}
                      </div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">Damage</div>
                      <div className="card-detail-value">{weapon.baseDamage}</div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">Accuracy</div>
                      <div className="card-detail-value">{weapon.baseAccuracy}%</div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">Reload</div>
                      <div className="card-detail-value">
                        {factoryService.formatDuration(weapon.reloadTimeMinutes)}
                      </div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">Cost</div>
                      <div className={`card-detail-value ${factoryService.canAfford(weapon.baseCost, ironAmount) ? 'cost-affordable' : 'cost-expensive'}`}>
                        {weapon.baseCost.toLocaleString()} Iron
                      </div>
                    </div>
                    <div className="card-detail">
                      <div className="card-detail-label">Build Time</div>
                      <div className="card-detail-value">
                        {factoryService.formatDuration(weapon.buildDurationMinutes)}
                      </div>
                    </div>
                  </div>
                  <div className="card-description">
                    {weapon.advantage}
                    {weapon.disadvantage && (
                      <><br /><em>Weakness: {weapon.disadvantage}</em></>
                    )}
                  </div>
                  <div className="card-actions">
                    <button
                      className="build-button"
                      disabled={!factoryService.canAfford(weapon.baseCost, ironAmount) || isBuilding}
                      onClick={() => buildItem(key, 'weapon')}
                    >
                      {isBuilding ? 'Building...' : 'Build'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default FactoryPageClient;