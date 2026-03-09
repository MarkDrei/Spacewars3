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
import { formatNumber } from '@/shared/numberFormat';
import { DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from '@/shared/viewportConstants';

interface GamePageClientProps {
  auth: ServerAuthState;
}

const GamePageClient: React.FC<GamePageClientProps> = ({ auth }) => {
  const router = useRouter();
  const gameInitializedRef = useRef(false);
  const gameInstanceRef = useRef<Game | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [debugDrawingsEnabled, setDebugDrawingsEnabled] = useState(true);
  const [angleInput, setAngleInput] = useState<string>('0');
  const [speedInput, setSpeedInput] = useState<string>('0');
  const [maxSpeed, setMaxSpeed] = useState<number>(100);
  const [isSettingAngle, setIsSettingAngle] = useState(false);
  const [isSettingSpeed, setIsSettingSpeed] = useState(false);
  const [teleportMaxCharges, setTeleportMaxCharges] = useState(0);
  const [teleportCharges, setTeleportCharges] = useState(0);
  const [teleportX, setTeleportX] = useState<string>('0');
  const [teleportY, setTeleportY] = useState<string>('0');
  const [isTeleporting, setIsTeleporting] = useState(false);
  const [teleportClickMode, setTeleportClickMode] = useState(false);
  const [attackClickMode, setAttackClickMode] = useState(false);
  const [teleportRechargeTimeSec, setTeleportRechargeTimeSec] = useState(0);
  const [timeMultiplier, setTimeMultiplier] = useState(1);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  // Auth is guaranteed by server, so pass true and use auth.shipId
  const { worldData, isLoading, error, refetch, lastUpdateTime } = useWorldData(3000);

  // Prevent page scrolling while on the game page
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const appEl = document.querySelector('.app') as HTMLElement | null;
    if (appEl) {
      appEl.style.height = '100vh';
      appEl.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
      if (appEl) {
        appEl.style.height = '';
        appEl.style.overflow = '';
      }
    };
  }, []);

  // Resize canvas to fill its container, accounting for devicePixelRatio for crisp rendering
  useEffect(() => {
    const container = canvasContainerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(container.clientWidth * dpr);
      canvas.height = Math.round(container.clientHeight * dpr);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Sync debugDrawingsEnabled state with game instance
  useEffect(() => {
    if (gameInstanceRef.current) {
      setDebugDrawingsEnabled(gameInstanceRef.current.getDebugDrawingsEnabled());
    }
  }, []);

  // Fetch max speed for the slider
  useEffect(() => {
    const fetchMaxSpeed = async () => {
      try {
        const stats = await getShipStats();
        if (stats && !('error' in stats)) {
          setMaxSpeed(stats.maxSpeed);
        }
      } catch (err) {
        // ignore – keep default maxSpeed
        console.warn('Failed to fetch max speed:', err);
      }
    };
    fetchMaxSpeed();
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

  // Memoize starbase entry callback - called from Game when player enters a starbase
  const handleStarbaseEntry = useCallback(() => {
    router.push('/starbase');
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

  const initializeGame = useCallback(() => {
    const gameCanvas = canvasRef.current;
    if (gameCanvas) {
      const game = initGame(gameCanvas);
      gameInstanceRef.current = game;
      if (!game) {
        console.error('Game initialization failed: initGame returned undefined');
        return;
      }
      console.log('🎮 Game initialized successfully');
      // The game will receive world data through the update effect
      // Initial mode state is synced via the dedicated useEffects below
    } else {
      console.error('Game canvas not found');
    }
  }, []); // intentionally empty: only run once on mount

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
  }, [auth.shipId, isLoading, initializeGame]); // Depend on shipId, loading state, and the stable initializeGame callback

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
      // Set the starbase entry callback to redirect to starbase page
      gameInstanceRef.current.setStarbaseEntryCallback(handleStarbaseEntry);
    }
  }, [worldData, auth.shipId, refetch, handleAttackSuccess, handleCanvasTeleport, handleStarbaseEntry]);

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

  // Sync attackClickMode with game instance
  useEffect(() => {
    if (gameInstanceRef.current) {
      gameInstanceRef.current.setAttackClickMode(attackClickMode);
    }
  }, [attackClickMode]);

  // Sync zoom with game instance
  useEffect(() => {
    if (gameInstanceRef.current) {
      gameInstanceRef.current.setZoom(zoom);
    }
  }, [zoom]);

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
        <div className="canvas-container" ref={canvasContainerRef}>
          <canvas
            ref={canvasRef}
            id="gameCanvas"
          ></canvas>

          {/* Top-left: combat + debug toggles */}
          <div className="hud-panel panel-top-left">
            <label className="debug-toggle-label">
              attack
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={attackClickMode}
                  onChange={(e) => setAttackClickMode(e.target.checked)}
                  className="toggle-input"
                />
                <span className="toggle-slider"></span>
              </div>
            </label>
            <label className="debug-toggle-label">
              debug
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

          {/* Bottom-left: navigation panel */}
          <div className="hud-panel panel-bottom-left">
            <p className="panel-heading">navigation</p>
            <div className="speed-slider-row">
              <label>speed</label>
              <input
                type="range"
                min={0}
                max={maxSpeed}
                step={0.1}
                value={parseFloat(speedInput) || 0}
                onChange={(e) => setSpeedInput(e.target.value)}
                onPointerUp={handleSetSpeed}
                disabled={isSettingSpeed}
                className="speed-slider"
              />
              <span className="speed-value">{parseFloat(speedInput).toFixed(1)}</span>
            </div>
            <div className="control-row">
              <label htmlFor="angle-input">angle °</label>
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
                {isSettingAngle ? '...' : 'set'}
              </button>
            </div>
            <div className="control-row">
              <label htmlFor="zoom-input">zoom</label>
              <input
                id="zoom-input"
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="speed-slider"
              />
              <span className="speed-value">{zoom.toFixed(2)}×</span>
            </div>
          </div>

          {/* Bottom-right: teleport panel */}
          {teleportMaxCharges > 0 && (
            <div className="hud-panel panel-bottom-right">
              <h4 className="panel-heading">teleport</h4>
              <div className="teleport-header">
                <span className="teleport-charges-badge">
                  {formatNumber(Math.floor(teleportCharges))} / {formatNumber(teleportMaxCharges)}
                </span>
                {teleportCharges < teleportMaxCharges && teleportRechargeTimeSec > 0 && (
                  <span className="teleport-timer">
                    next in: {formatTimeRemaining(
                      (Math.ceil(teleportCharges) === Math.floor(teleportCharges) ? 1 : Math.ceil(teleportCharges) - teleportCharges) * teleportRechargeTimeSec / Math.max(1, timeMultiplier)
                    )}
                  </span>
                )}
                <label className="debug-toggle-label">
                  click mode
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={teleportClickMode}
                      onChange={(e) => setTeleportClickMode(e.target.checked)}
                      disabled={Math.floor(teleportCharges) < 1}
                      className="toggle-input"
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </div>
              <div className="control-row">
                <label htmlFor="teleport-x">x</label>
                <input id="teleport-x" type="number" value={teleportX} onChange={(e) => setTeleportX(e.target.value)} min="0" max="5000" step="1" />
                <label htmlFor="teleport-y">y</label>
                <input id="teleport-y" type="number" value={teleportY} onChange={(e) => setTeleportY(e.target.value)} min="0" max="5000" step="1" />
                <button onClick={handleTeleport} disabled={isTeleporting || Math.floor(teleportCharges) < 1} className="control-button btn-primary">
                  {isTeleporting ? '...' : 'teleport'}
                </button>
              </div>
            </div>
          )}

          {/* Data age indicator */}
          {debugDrawingsEnabled && (
            <div className="hud-panel panel-top-right">
              <DataAgeIndicator lastUpdateTime={lastUpdateTime} />
            </div>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default GamePageClient;
