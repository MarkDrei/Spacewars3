import React, { useState, useEffect, useRef } from 'react';
import { researchService, TechTree, ResearchDef, ResearchType } from '../services/researchService';
import { userStatsService } from '../services/userStatsService';
import { globalEvents, EVENTS } from '../services/eventService';
import './ResearchPage.css';

const researchTypeToKey = {
  IronHarvesting: 'ironHarvesting',
  ShipVelocity: 'shipVelocity',
  Afterburner: 'afterburner',
} as const;

const ResearchPage: React.FC = () => {
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
      <div className="research-page">
        <div className="research-container">
          <h1 className="page-heading">Research</h1>
          <div className="loading-message">Loading research data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="research-page">
        <div className="research-container">
          <h1 className="page-heading">Research</h1>
          <div className="error-message">
            Error: {error}
          </div>
          <button className="retry-button" onClick={fetchData}>Retry</button>
        </div>
      </div>
    );
  }

  if (!techTree || !researches) {
    return (
      <div className="research-page">
        <div className="research-container">
          <h1 className="page-heading">Research</h1>
          <div className="no-data-message">No research data available</div>
        </div>
      </div>
    );
  }

  const isAnyResearchActive = researchService.isResearchActive(techTree);

  return (
    <div className="research-page">
      <div className="research-container">
        <h1 className="page-heading">Research</h1>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="research-table-container">
          <table className="research-table">
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
              {Object.values(researches).map(research => {
                const key = researchTypeToKey[research.type];
                const level = techTree[key];
                const isActive = techTree.activeResearch?.type === research.type;
                const canUpgrade = !isAnyResearchActive && researchService.canAffordResearch(research, currentIron);

                return (
                  <tr 
                    key={research.type} 
                    className={`research-row ${isActive ? 'active' : ''} ${isAnyResearchActive && !isActive ? 'disabled' : ''}`}
                  >
                    <td className="research-cell">
                      {research.name}
                    </td>
                    <td className="research-cell">
                      {level}
                    </td>
                    <td className="research-cell">
                      {researchService.formatEffect(research.currentEffect, research.unit)}
                    </td>
                    <td className="research-cell">
                      {researchService.formatEffect(research.nextEffect, research.unit)}
                    </td>
                    <td className="research-cell">
                      {researchService.formatDuration(research.nextUpgradeDuration)}
                    </td>
                    <td className="research-cell description-cell">
                      {research.description}
                    </td>
                    <td className="research-cell action-cell">
                      {isActive ? (
                        <div className="research-countdown">
                          {remaining !== null ? researchService.formatDuration(remaining) : 'Active'}
                        </div>
                      ) : isAnyResearchActive ? (
                        <span className="cost-disabled">
                          {research.nextUpgradeCost.toLocaleString()}
                        </span>
                      ) : canUpgrade ? (
                        <button
                          className="upgrade-button"
                          onClick={() => handleTriggerResearch(research.type)}
                          disabled={isTriggering}
                        >
                          {isTriggering ? 'Processing...' : `Upgrade (${research.nextUpgradeCost.toLocaleString()})`}
                        </button>
                      ) : (
                        <span className="cost-insufficient">
                          {research.nextUpgradeCost.toLocaleString()}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ResearchPage;
