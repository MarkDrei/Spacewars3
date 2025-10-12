'use client';

import React, { useEffect, useRef, useState } from 'react';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import './GamePage.css';
import { initGame, Game } from '@/lib/client/game/Game';
import { useWorldData } from '@/lib/client/hooks/useWorldData';
import { navigateShip } from '@/lib/client/services/navigationService';
import { getShipStats } from '@/lib/client/services/shipStatsService';
import { triggerAfterburner } from '@/lib/client/services/afterburnerService';
import { ServerAuthState } from '@/lib/server/serverSession';

interface GamePageClientProps {
  auth: ServerAuthState;
}

const GamePageClient: React.FC<GamePageClientProps> = ({ auth }) => {
  const gameInitializedRef = useRef(false);
  const gameInstanceRef = useRef<Game | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSettingMaxSpeed, setIsSettingMaxSpeed] = useState(false);
  const [debugDrawingsEnabled, setDebugDrawingsEnabled] = useState(true);
  const [angleInput, setAngleInput] = useState<string>('0');
  const [speedInput, setSpeedInput] = useState<string>('0');
  const [isSettingAngle, setIsSettingAngle] = useState(false);
  const [isSettingSpeed, setIsSettingSpeed] = useState(false);
  const [isTriggeringAfterburner, setIsTriggeringAfterburner] = useState(false);
  const [afterburnerCooldown, setAfterburnerCooldown] = useState<number>(0);
  const [canActivateAfterburner, setCanActivateAfterburner] = useState(false);
  // Auth is guaranteed by server, so pass true and use auth.shipId
  const { worldData, isLoading, error, refetch } = useWorldData(3000);

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
    // Initialize game only when we have necessary data AND canvas is rendered (not loading)
    if (!gameInitializedRef.current && auth.shipId && !isLoading) {
      // Use requestAnimationFrame to ensure DOM is fully rendered
      const initializeAfterRender = () => {
        if (canvasRef.current) {
          initializeGame();
          gameInitializedRef.current = true;
        } else {
          // Retry once if canvas not immediately available
          requestAnimationFrame(() => {
            if (canvasRef.current) {
              initializeGame();
              gameInitializedRef.current = true;
            } else {
              console.error('Game canvas not found after retry');
            }
          });
        }
      };

      requestAnimationFrame(initializeAfterRender);
    }

    // Clean up function
    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.stop?.();
        gameInstanceRef.current = null;
      }
    };
  }, [auth.shipId, isLoading]); // Depend on both shipId and loading state

  // Update game world when server data changes
  useEffect(() => {
    if (worldData && gameInstanceRef.current && auth.shipId) {
      gameInstanceRef.current.updateWorldData?.(worldData, auth.shipId);
      // Set the refetch function so the game can trigger updates
      gameInstanceRef.current.setRefetchFunction?.(refetch);
      // Set the navigation callback to update input fields when user clicks on canvas
      gameInstanceRef.current.setNavigationCallback?.(updateInputFieldsFromShip);
    }
  }, [worldData, auth.shipId, refetch]);

  // Initialize input fields with current ship state only once when game starts
  useEffect(() => {
    if (worldData && gameInstanceRef.current && auth.shipId && angleInput === '0' && speedInput === '0') {
      const ship = gameInstanceRef.current.getWorld().getShip();
      if (ship) {
        setAngleInput(ship.getAngleDegrees().toFixed(1));
        setSpeedInput(ship.getSpeed().toFixed(1));
      }
    }
  }, [worldData, auth.shipId, angleInput, speedInput]);

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
      
      // Update input fields after successful navigation
      setTimeout(updateInputFieldsFromShip, 100); // Small delay to ensure world data is updated
    } catch (error) {
      console.error('❌ [CLIENT] Failed to set max speed:', error);
    } finally {
      setIsSettingMaxSpeed(false);
    }
  };

  const updateInputFieldsFromShip = () => {
    if (gameInstanceRef.current) {
      const ship = gameInstanceRef.current.getWorld().getShip();
      if (ship) {
        setAngleInput(ship.getAngleDegrees().toFixed(1));
        setSpeedInput(ship.getSpeed().toFixed(1));
      }
    }
  };

  const handleSetAngle = async () => {
    if (isSettingAngle) return;
    
    setIsSettingAngle(true);
    try {
      const angle = parseFloat(angleInput);
      if (isNaN(angle)) {
        console.error('Invalid angle value');
        return;
      }
      
      // Normalize angle to 0-360 range
      const normalizedAngle = ((angle % 360) + 360) % 360;
      
      await navigateShip({ angle: normalizedAngle });
      
      // Refresh world data to get updated ship state
      if (refetch) {
        refetch();
      }
      
      // Update input fields after successful navigation
      setTimeout(updateInputFieldsFromShip, 100); // Small delay to ensure world data is updated
    } catch (error) {
      console.error('❌ [CLIENT] Failed to set angle:', error);
    } finally {
      setIsSettingAngle(false);
    }
  };

  const handleSetSpeed = async () => {
    if (isSettingSpeed) return;
    
    setIsSettingSpeed(true);
    try {
      const speed = parseFloat(speedInput);
      if (isNaN(speed) || speed < 0) {
        console.error('Invalid speed value');
        return;
      }
      
      await navigateShip({ speed });
      
      // Refresh world data to get updated ship state
      if (refetch) {
        refetch();
      }
      
      // Update input fields after successful navigation
      setTimeout(updateInputFieldsFromShip, 100); // Small delay to ensure world data is updated
    } catch (error) {
      console.error('❌ [CLIENT] Failed to set speed:', error);
    } finally {
      setIsSettingSpeed(false);
    }
  };

  const handleAngleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSetAngle();
    }
  };

  const handleSpeedKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSetSpeed();
    }
  };

  const handleAfterburner = async () => {
    if (isTriggeringAfterburner) return;
    
    setIsTriggeringAfterburner(true);
    try {
      const result = await triggerAfterburner();
      
      if ('error' in result) {
        console.error('Failed to trigger afterburner:', result.error);
        alert(result.error);
        return;
      }
      
      // Refresh world data to get updated ship state
      if (refetch) {
        refetch();
      }
      
      // Update afterburner cooldown state
      const cooldownMs = result.afterburner.cooldownEndMs - Date.now();
      setAfterburnerCooldown(cooldownMs);
      setCanActivateAfterburner(false);
      
      // Update input fields after successful activation
      setTimeout(updateInputFieldsFromShip, 100);
    } catch (error) {
      console.error('❌ [CLIENT] Failed to trigger afterburner:', error);
    } finally {
      setIsTriggeringAfterburner(false);
    }
  };

  // Update afterburner status periodically
  useEffect(() => {
    const updateAfterburnerStatus = async () => {
      try {
        const shipStats = await getShipStats();
        
        if ('error' in shipStats) {
          return;
        }
        
        if (shipStats.afterburner) {
          setCanActivateAfterburner(shipStats.afterburner.canActivate);
          setAfterburnerCooldown(shipStats.afterburner.cooldownRemainingMs);
        }
      } catch (error) {
        // Silently fail - this is just for UI updates
      }
    };

    // Update immediately
    updateAfterburnerStatus();

    // Update every second
    const interval = setInterval(updateAfterburnerStatus, 1000);
    
    return () => clearInterval(interval);
  }, [worldData]);

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
          <div className="navigation-controls">
            <div className="control-row">
              <label htmlFor="angle-input">Angle (degrees):</label>
              <div className="input-container">
                <input
                  id="angle-input"
                  type="number"
                  value={angleInput}
                  onChange={(e) => setAngleInput(e.target.value)}
                  onKeyPress={handleAngleKeyPress}
                  disabled={isSettingAngle}
                  className={isSettingAngle ? 'loading' : ''}
                  min="0"
                  max="360"
                  step="0.1"
                />
                {isSettingAngle && <div className="input-loading-indicator"></div>}
              </div>
              <button
                onClick={handleSetAngle}
                disabled={isSettingAngle}
                className="control-button btn-primary"
              >
                {isSettingAngle ? 'Setting...' : 'Set Angle'}
              </button>
            </div>
            
            <div className="control-row">
              <label htmlFor="speed-input">Speed:</label>
              <div className="input-container">
                <input
                  id="speed-input"
                  type="number"
                  value={speedInput}
                  onChange={(e) => setSpeedInput(e.target.value)}
                  onKeyPress={handleSpeedKeyPress}
                  disabled={isSettingSpeed}
                  className={isSettingSpeed ? 'loading' : ''}
                  min="0"
                  step="0.1"
                />
                {isSettingSpeed && <div className="input-loading-indicator"></div>}
              </div>
              <button
                onClick={handleSetSpeed}
                disabled={isSettingSpeed}
                className="control-button btn-primary"
              >
                {isSettingSpeed ? 'Setting...' : 'Set Speed'}
              </button>
              <button 
                className="max-speed-button btn-primary"
                onClick={handleMaxSpeed}
                disabled={isSettingMaxSpeed}
              >
                {isSettingMaxSpeed ? 'Setting Max Speed...' : 'Set Max Speed'}
              </button>
            </div>
            
            <div className="control-row">
              <button 
                className="afterburner-button btn-primary"
                onClick={handleAfterburner}
                disabled={isTriggeringAfterburner || !canActivateAfterburner}
                style={{
                  width: '100%',
                  backgroundColor: canActivateAfterburner ? '#ff6600' : '#666',
                  cursor: canActivateAfterburner ? 'pointer' : 'not-allowed'
                }}
              >
                {isTriggeringAfterburner 
                  ? 'Activating Afterburner...' 
                  : afterburnerCooldown > 0 
                    ? `Afterburner (Cooldown: ${Math.ceil(afterburnerCooldown / 1000)}s)`
                    : canActivateAfterburner
                      ? '🔥 Activate Afterburner'
                      : 'Afterburner (Not Researched)'}
              </button>
            </div>
          </div>
          
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

export default GamePageClient;
