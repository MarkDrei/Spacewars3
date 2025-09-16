'use client';

import React, { useEffect, useRef, useState } from 'react';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import './GamePage.css';
import { initGame, Game } from '@/lib/client/game/Game';
import { useAuth } from '@/lib/client/hooks/useAuth';
import { useWorldData } from '@/lib/client/hooks/useWorldData';
import { navigateShip } from '@/lib/client/services/navigationService';
import { getShipStats } from '@/lib/client/services/shipStatsService';

const GamePage: React.FC = () => {
  const gameInitializedRef = useRef(false);
  const gameInstanceRef = useRef<Game | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSettingMaxSpeed, setIsSettingMaxSpeed] = useState(false);
  const [debugDrawingsEnabled, setDebugDrawingsEnabled] = useState(true);
  const { isLoggedIn, shipId } = useAuth();
  const { worldData, isLoading, error, refetch } = useWorldData(isLoggedIn, 3000);

  // Sync debugDrawingsEnabled state with game instance
  useEffect(() => {
    if (gameInstanceRef.current) {
      setDebugDrawingsEnabled(gameInstanceRef.current.getDebugDrawingsEnabled());
    }
  }, [gameInstanceRef.current]);

  const handleDebugToggle = (enabled: boolean) => {
    setDebugDrawingsEnabled(enabled);
    if (gameInstanceRef.current) {
      gameInstanceRef.current.setDebugDrawingsEnabled(enabled);
    }
  };

  useEffect(() => {
    // Only initialize game when we have ship ID for the first time
    if (!gameInitializedRef.current && shipId) {
      initializeGame();
      gameInitializedRef.current = true;
    }

    // Clean up function - only unmount when component actually unmounts
    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.stop?.();
        gameInstanceRef.current = null;
      }
    };
  }, [shipId]); // Only depend on shipId, not worldData

  // Update game world when server data changes
  useEffect(() => {
    if (worldData && gameInstanceRef.current && shipId) {
      gameInstanceRef.current.updateWorldData?.(worldData, shipId);
      // Set the refetch function so the game can trigger updates
      gameInstanceRef.current.setRefetchFunction?.(refetch);
    }
  }, [worldData, shipId, refetch]);

  const initializeGame = () => {
    const gameCanvas = canvasRef.current;
    if (gameCanvas) {
      gameInstanceRef.current = initGame(gameCanvas);
      console.log('🎮 Game initialized successfully');
      // The game will receive world data through the update effect
    } else {
      console.error('Game canvas not found');
    }
  };

  const handleMaxSpeed = async () => {
    if (isSettingMaxSpeed) return; // Prevent double-clicks
    
    setIsSettingMaxSpeed(true);
    try {
      // Get current ship stats to determine max speed
      const shipStats = await getShipStats();
      
      if ('error' in shipStats) {
        console.error('Failed to get ship stats:', shipStats.error);
        return;
      }
      
      // Set ship to max speed (keep current angle)
      await navigateShip({ speed: shipStats.maxSpeed });
      
      // Refresh world data to get updated ship state
      if (refetch) {
        refetch();
      }
    } catch (error) {
      console.error('❌ [CLIENT] Failed to set max speed:', error);
    } finally {
      setIsSettingMaxSpeed(false);
    }
  };

  // Show loading or error states
  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="game-page">
          <div className="loading">Loading world data...</div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (error) {
    return (
      <AuthenticatedLayout>
        <div className="game-page">
          <div className="error">Error loading world data: {error}</div>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="game-page">
        <div className="canvas-container">
          <canvas 
            ref={canvasRef}
            id="gameCanvas" 
            width="800" 
            height="800"
          ></canvas>
        </div>
        <div className="game-controls">
          <button 
            className="max-speed-button"
            onClick={handleMaxSpeed}
            disabled={isSettingMaxSpeed}
          >
            {isSettingMaxSpeed ? 'Setting Max Speed...' : 'Set Max Speed'}
          </button>
          
          <div className="debug-toggle-container">
            <label className="debug-toggle-label">
              Enable debug drawings
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={debugDrawingsEnabled}
                  onChange={(e) => handleDebugToggle(e.target.checked)}
                  className="toggle-input"
                />
                <span className="toggle-slider"></span>
              </div>
            </label>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default GamePage;
