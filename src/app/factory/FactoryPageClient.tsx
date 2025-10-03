'use client';

import React from 'react';
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

  // Combine loading and error states from both hooks
  const isLoading = isBuildQueueLoading || isTechCountsLoading;
  const error = buildQueueError || techCountsError;

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

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Build Queue Section */}
          {buildQueue.length > 0 && (
            <>
              <h2 className="section-header">Build Queue</h2>
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

              {/* Cheat Mode Button */}
              <div className="cheat-section">
                <button
                  className="cheat-button"
                  onClick={completeBuild}
                  disabled={isCompletingBuild || buildQueue.length === 0}
                >
                  {isCompletingBuild ? 'Completing...' : '⚡ Complete First Build (Cheat)'}
                </button>
              </div>
            </>
          )}

          {/* Defense Items Section */}
          <h2 className="section-header">Defense Systems</h2>
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

          {/* Weapons Section */}
          <h2 className="section-header">Weapon Systems</h2>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
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
                {Object.entries(weapons).map(([key, weapon]) => (
                  <tr key={key} className="data-row">
                    <td className="data-cell">
                      <span className="stat-value">{weapon.name}</span>
                    </td>
                    <td className="data-cell">
                      <span className={`subtype-badge ${factoryService.getSubtypeClass(weapon.subtype)}`}>
                        {weapon.subtype}
                      </span>
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
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default FactoryPageClient;