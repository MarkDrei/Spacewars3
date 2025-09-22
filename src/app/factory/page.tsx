'use client';

import React, { useState, useEffect, useRef } from 'react';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { useAuth } from '@/lib/client/hooks/useAuth';
import { userStatsService } from '@/lib/client/services/userStatsService';
import { 
  factoryService, 
  WeaponSpec, 
  DefenseSpec, 
  TechCounts, 
  BuildQueueItem
} from '@/lib/client/services/factoryService';
import './FactoryPage.css';

const FactoryPage: React.FC = () => {
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  const [weapons, setWeapons] = useState<Record<string, WeaponSpec>>({});
  const [defenses, setDefenses] = useState<Record<string, DefenseSpec>>({});
  const [techCounts, setTechCounts] = useState<TechCounts | null>(null);
  const [buildQueue, setBuildQueue] = useState<BuildQueueItem[]>([]);
  const [currentIron, setCurrentIron] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [isCompletingBuild, setIsCompletingBuild] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch initial data
  const fetchData = async () => {
    try {
      setError(null);
      
      // Fetch catalog, build status, and user stats in parallel (following research page pattern)
      const [catalogResult, statusResult, userStatsResult] = await Promise.all([
        factoryService.getTechCatalog(),
        factoryService.getBuildStatus(),
        userStatsService.getUserStats()
      ]);

      if ('error' in catalogResult) {
        setError(catalogResult.error);
        return;
      }

      if ('error' in statusResult) {
        setError(statusResult.error);
        return;
      }

      if ('error' in userStatsResult) {
        setError(userStatsResult.error);
        return;
      }

      setWeapons(catalogResult.weapons);
      setDefenses(catalogResult.defenses);
      setTechCounts(statusResult.techCounts);
      setBuildQueue(statusResult.buildQueue);
      setCurrentIron(userStatsResult.iron);

    } catch (err) {
      setError('Failed to load factory data');
      console.error('Error fetching factory data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle building an item
  const handleBuildItem = async (itemKey: string, itemType: 'weapon' | 'defense') => {
    if (isBuilding) return;

    setIsBuilding(true);
    setError(null);

    try {
      const result = await factoryService.buildItem(itemKey, itemType);

      if ('error' in result) {
        setError(result.error);
        return;
      }

      // Refresh data after successful build
      await fetchData();
      
    } catch (err) {
      setError('Failed to start building item');
      console.error('Error building item:', err);
    } finally {
      setIsBuilding(false);
    }
  };

  // Handle completing a build (cheat mode)
  const handleCompleteBuild = async () => {
    if (isCompletingBuild || buildQueue.length === 0) return;

    setIsCompletingBuild(true);
    setError(null);

    try {
      const result = await factoryService.completeBuild();

      if ('error' in result) {
        setError(result.error);
        return;
      }

      // Refresh data after successful completion
      await fetchData();
      
    } catch (err) {
      setError('Failed to complete build');
      console.error('Error completing build:', err);
    } finally {
      setIsCompletingBuild(false);
    }
  };

  // Update countdown timer for build queue
  useEffect(() => {
    if (buildQueue.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setBuildQueue(prevQueue => {
        const now = Math.floor(Date.now() / 1000);
        const updatedQueue = prevQueue.map(item => ({
          ...item,
          remainingSeconds: Math.max(0, item.completionTime - now)
        }));

        // Check if any builds completed
        const hasCompleted = updatedQueue.some(item => item.remainingSeconds <= 0);
        if (hasCompleted) {
          // Refresh data to get updated counts
          fetchData();
        }

        return updatedQueue;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [buildQueue.length]);

  // Initial data fetch
  useEffect(() => {
    // Don't fetch if still checking auth or not logged in
    if (authLoading || !isLoggedIn) {
      return;
    }

    fetchData();
    
    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isLoggedIn, authLoading]);

  if (authLoading) {
    return (
      <AuthenticatedLayout>
        <div className="factory-page">
          <div className="factory-container">
            <h1 className="page-heading">Factory</h1>
            <div className="loading-message">Checking authentication...</div>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (!isLoggedIn) {
    return (
      <AuthenticatedLayout>
        <div className="factory-page">
          <div className="factory-container">
            <h1 className="page-heading">Factory</h1>
            <div className="error-message">Not authenticated</div>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

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
            <button className="retry-button" onClick={fetchData}>Retry</button>
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
                  onClick={handleCompleteBuild}
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
                        {techCounts[key as keyof TechCounts] || 0}
                      </span>
                    </td>
                    <td className="data-cell">
                      <span className={factoryService.canAfford(defense.baseCost, currentIron) ? 'cost-affordable' : 'cost-expensive'}>
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
                        disabled={!factoryService.canAfford(defense.baseCost, currentIron) || isBuilding}
                        onClick={() => handleBuildItem(key, 'defense')}
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
                        {techCounts[key as keyof TechCounts] || 0}
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
                      <span className={factoryService.canAfford(weapon.baseCost, currentIron) ? 'cost-affordable' : 'cost-expensive'}>
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
                        disabled={!factoryService.canAfford(weapon.baseCost, currentIron) || isBuilding}
                        onClick={() => handleBuildItem(key, 'weapon')}
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

export default FactoryPage;