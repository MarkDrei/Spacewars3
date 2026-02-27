'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import './GamePage.css';
import { initGame, Game } from '@/lib/client/game/Game';
import { useWorldData } from '@/lib/client/hooks/useWorldData';
import { navigateShip } from '@/lib/client/services/navigationService';
import { teleportShip } from '@/lib/client/services/teleportService';
import { getShipStats } from '@/lib/client/services/shipStatsService';
import { userStatsService } from '@/lib/client/services/userStatsService';
import { ServerAuthState } from '@/lib/server/serverSession';
import DataAgeIndicator from '@/components/DataAgeIndicator/DataAgeIndicator';

interface GamePageClientProps {
  auth: ServerAuthState;
}

const GamePageClient: React.FC<GamePageClientProps> = ({ auth }) => {
  const router = useRouter();
  const gameInitializedRef = useRef(false);
  const gameInstanceRef = useRef<Game | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSettingMaxSpeed, setIsSettingMaxSpeed] = useState(false);
  const [debugDrawingsEnabled, setDebugDrawingsEnabled] = useState(true);
  const [angleInput, setAngleInput] = useState<string>('0');
  const [speedInput, setSpeedInput] = useState<string>('0');
  const [isSettingAngle, setIsSettingAngle] = useState(false);
  const [isSettingSpeed, setIsSettingSpeed] = useState(false);
  const [teleportMaxCharges, setTeleportMaxCharges] = useState(0);
  const [teleportCharges, setTeleportCharges] = useState(0);
  const [teleportX, setTeleportX] = useState<string>('0');
  const [teleportY, setTeleportY] = useState<string>('0');
  const [isTeleporting, setIsTeleporting] = useState(false);
  const [teleportClickMode, setTeleportClickMode] = useState(false);
  const [teleportRechargeTimeSec, setTeleportRechargeTimeSec] = useState(0);
  const [timeMultiplier, setTimeMultiplier] = useState(1);
  // Auth is guaranteed by server, so pass true and use auth.shipId
  const { worldData, isLoading, error, refetch, lastUpdateTime } = useWorldData(3000);

  // Sync debugDrawingsEnabled state with game instance
  useEffect(() => {
    if (gameInstanceRef.current) {
      setDebugDrawingsEnabled(gameInstanceRef.current.getDebugDrawingsEnabled());
    }
  }, []);

  const handleDebugToggle = (enabled: boolean) => {
    setDebugDrawingsEnabled(enabled);
    if (gameInstanceRef.current) {
      gameInstanceRef.current.setDebugDrawingsEnabled(enabled);
    }
  };

  // Memoize the redirect callback to avoid recreating it on every render
  const handleAttackSuccess = useCallback(() => {
    router.push('/');
  }, [router]);

  // Memoize canvas teleport callback - called from Game when click-to-teleport mode is active
  const handleCanvasTeleport = useCallback(async (worldX: number, worldY: number) => {
    setTeleportClickMode(false);
    try {
      const result = await teleportShip({ x: worldX, y: worldY, preserveVelocity: true });
      setTeleportCharges(result.remainingCharges);
      setTeleportX(Math.round(worldX).toString());
      setTeleportY(Math.round(worldY).toString());
      if (refetch) {
        refetch();
      }
    } catch (error) {
      console.error('❌ [CLIENT] Canvas teleport failed:', error);
    }
  }, [refetch]);

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
      // Set the attack success callback to redirect to home page
      gameInstanceRef.current.setAttackSuccessCallback?.(handleAttackSuccess);
      // Set the teleport click callback for canvas click-to-teleport mode
      gameInstanceRef.current.setTeleportClickCallback?.(handleCanvasTeleport);
    }
  }, [worldData, auth.shipId, refetch, handleAttackSuccess, handleCanvasTeleport]);

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

  const handleStop = async () => {
    if (isSettingSpeed) return;
    
    setIsSettingSpeed(true);
    try {
      await navigateShip({ speed: 0 });
      
      // Refresh world data to get updated ship state
      if (refetch) {
        refetch();
      }
      
      // Update input fields after successful navigation
      setTimeout(updateInputFieldsFromShip, 100); // Small delay to ensure world data is updated
    } catch (error) {
      console.error('❌ [CLIENT] Failed to stop ship:', error);
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

  const fetchTeleportData = useCallback(async () => {
    const stats = await userStatsService.getUserStats();
    if (!('error' in stats)) {
      setTeleportCharges(stats.teleportCharges);
      setTeleportMaxCharges(stats.teleportMaxCharges);
      setTeleportRechargeTimeSec(stats.teleportRechargeTimeSec);
      setTimeMultiplier(stats.timeMultiplier);
    }
  }, []);

  // Load teleport data on mount
  useEffect(() => {
    fetchTeleportData();
  }, [fetchTeleportData]);

  // Sync teleportClickMode with game instance
  useEffect(() => {
    if (gameInstanceRef.current) {
      gameInstanceRef.current.setTeleportClickMode(teleportClickMode);
    }
  }, [teleportClickMode]);

  // Optimistic update for teleport charges
  useEffect(() => {
    if (teleportMaxCharges > 0 && teleportRechargeTimeSec > 0) {
      const interval = setInterval(() => {
        setTeleportCharges(prev => {
          if (prev >= teleportMaxCharges) return prev;
          const newCharges = prev + (timeMultiplier / teleportRechargeTimeSec);
          return Math.min(newCharges, teleportMaxCharges);
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [teleportMaxCharges, teleportRechargeTimeSec, timeMultiplier]);

  const formatTimeRemaining = (seconds: number) => {
    if (!isFinite(seconds) || seconds <= 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const handleTeleport = async () => {
    if (isTeleporting) return;

    const x = parseFloat(teleportX);
    const y = parseFloat(teleportY);

    if (isNaN(x) || isNaN(y)) {
      console.error('Invalid teleport coordinates');
      return;
    }

    setIsTeleporting(true);
    try {
      const result = await teleportShip({ x, y, preserveVelocity: false });
      setTeleportCharges(result.remainingCharges);
      if (refetch) {
        refetch();
      }
    } catch (error) {
      console.error('❌ [CLIENT] Teleport failed:', error);
    } finally {
      setIsTeleporting(false);
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
          <div className="navigation-controls">
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
              <button 
                className="stop-button btn-secondary"
                onClick={handleStop}
                disabled={isSettingSpeed}
              >
                Stop
              </button>
            </div>

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
          </div>

          {teleportMaxCharges > 0 && (
            <div className="navigation-controls teleport-controls-horizontal">
              <div className="teleport-header">
                <h3 className="teleport-title">Teleport</h3>
                <span className="teleport-charges-badge">
                  {Math.floor(teleportCharges)} / {teleportMaxCharges} Charges
                </span>
                {teleportCharges < teleportMaxCharges && teleportRechargeTimeSec > 0 && (
                  <span className="teleport-timer">
                    Next in: {formatTimeRemaining(
                      (Math.ceil(teleportCharges) === Math.floor(teleportCharges) ? 1 : Math.ceil(teleportCharges) - teleportCharges) * teleportRechargeTimeSec / Math.max(1, timeMultiplier)
                    )}
                  </span>
                )}
              </div>
              
              <div className="control-row">
                <label htmlFor="teleport-x">X:</label>
                <input id="teleport-x" type="number" value={teleportX} onChange={(e) => setTeleportX(e.target.value)} min="0" max="5000" step="1" />
                
                <label htmlFor="teleport-y">Y:</label>
                <input id="teleport-y" type="number" value={teleportY} onChange={(e) => setTeleportY(e.target.value)} min="0" max="5000" step="1" />
                
                <button onClick={handleTeleport} disabled={isTeleporting || Math.floor(teleportCharges) < 1} className="control-button btn-primary">
                  {isTeleporting ? 'Teleporting...' : 'Teleport'}
                </button>
                
                <button onClick={() => setTeleportClickMode(!teleportClickMode)} disabled={Math.floor(teleportCharges) < 1} className={`control-button ${teleportClickMode ? 'btn-active' : 'btn-secondary'}`}>
                  {teleportClickMode ? 'Click to Teleport (ON)' : 'Click to Teleport (OFF)'}
                </button>
              </div>
            </div>
          )}
          
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
          {debugDrawingsEnabled && <DataAgeIndicator lastUpdateTime={lastUpdateTime} />}
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default GamePageClient;
