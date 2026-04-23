'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import './GamePage.css';
import { initGame, Game } from '@/lib/client/game/Game';
import { useWorldData } from '@/lib/client/hooks/useWorldData';
import { navigateShip, NavigateResponse } from '@/lib/client/services/navigationService';
import { teleportShip } from '@/lib/client/services/teleportService';
import { getShipStats } from '@/lib/client/services/shipStatsService';
import { activateAfterburner, deactivateAfterburner, AfterburnerStatus } from '@/lib/client/services/afterburnerService';
import { userStatsService } from '@/lib/client/services/userStatsService';
import { ServerAuthState } from '@/lib/server/serverSession';
import DataAgeIndicator from '@/components/DataAgeIndicator/DataAgeIndicator';
import { formatNumber } from '@/shared/numberFormat';
import { DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from '@shared/viewportConstants';

interface GamePageClientProps {
  auth: ServerAuthState;
}

const SPEED_SLIDER_RANGE_MAX = 100;
const SPEED_SLIDER_SNAP_ZONE_PERCENT = 12;
const SPEED_SLIDER_ACTIVE_TRACK_START = SPEED_SLIDER_SNAP_ZONE_PERCENT;
const SPEED_SLIDER_ACTIVE_TRACK_END = SPEED_SLIDER_RANGE_MAX - SPEED_SLIDER_SNAP_ZONE_PERCENT;
const MOBILE_GAME_MEDIA_QUERY = '(max-width: 768px), (hover: none) and (pointer: coarse)';

const clampSpeedValue = (value: number, speedLimit: number) => {
  if (Number.isNaN(value)) {
    return 0;
  }

  const normalizedSpeedLimit = Math.max(speedLimit, 0);
  return Number(Math.min(Math.max(value, 0), normalizedSpeedLimit).toFixed(1));
};

const sliderPositionToSpeed = (position: number, speedLimit: number) => {
  const normalizedSpeedLimit = Math.max(speedLimit, 0);
  if (normalizedSpeedLimit === 0) {
    return 0;
  }

  const clampedPosition = Math.min(Math.max(position, 0), SPEED_SLIDER_RANGE_MAX);

  if (clampedPosition <= SPEED_SLIDER_ACTIVE_TRACK_START) {
    return 0;
  }

  if (clampedPosition >= SPEED_SLIDER_ACTIVE_TRACK_END) {
    return normalizedSpeedLimit;
  }

  const progress = (clampedPosition - SPEED_SLIDER_ACTIVE_TRACK_START) / (SPEED_SLIDER_ACTIVE_TRACK_END - SPEED_SLIDER_ACTIVE_TRACK_START);
  return clampSpeedValue(progress * normalizedSpeedLimit, normalizedSpeedLimit);
};

const speedToSliderPosition = (speed: number, speedLimit: number) => {
  const normalizedSpeedLimit = Math.max(speedLimit, 0);
  if (normalizedSpeedLimit === 0) {
    return 0;
  }

  const clampedSpeed = clampSpeedValue(speed, normalizedSpeedLimit);

  if (clampedSpeed <= 0) {
    return 0;
  }

  if (clampedSpeed >= normalizedSpeedLimit) {
    return SPEED_SLIDER_RANGE_MAX;
  }

  const progress = clampedSpeed / normalizedSpeedLimit;
  return Number((SPEED_SLIDER_ACTIVE_TRACK_START + progress * (SPEED_SLIDER_ACTIVE_TRACK_END - SPEED_SLIDER_ACTIVE_TRACK_START)).toFixed(1));
};

const GamePageClient: React.FC<GamePageClientProps> = ({ auth }) => {
  const router = useRouter();
  const gameInitializedRef = useRef(false);
  const gameInstanceRef = useRef<Game | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const controlBarRef = useRef<HTMLDivElement>(null);
  const iconBarRef = useRef<HTMLDivElement>(null);
  const isMobileModeRef = useRef(false);
  const mobileTapInfoModeRef = useRef(false);
  const debugDrawingsEnabledRef = useRef(false);
  const zoomRef = useRef(DEFAULT_ZOOM);
  const [debugDrawingsEnabled, setDebugDrawingsEnabled] = useState(false);
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
  const [showTeleportCoordModal, setShowTeleportCoordModal] = useState(false);
  const [attackClickMode, setAttackClickMode] = useState(false);
  const [isMobileMode, setIsMobileMode] = useState(false);
  const [mobileTapInfoMode, setMobileTapInfoMode] = useState(false);
  const [teleportRechargeTimeSec, setTeleportRechargeTimeSec] = useState(0);
  const [timeMultiplier, setTimeMultiplier] = useState(1);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [navOpen, setNavOpen] = useState(false);
  const [teleportOpen, setTeleportOpen] = useState(false);
  const [afterburnerOpen, setAfterburnerOpen] = useState(false);
  const [afterburnerStatus, setAfterburnerStatus] = useState<AfterburnerStatus | null>(null);
  const [announcement, setAnnouncement] = useState<{ text: string; key: number; variant?: 'orange' } | null>(null);
  const announcementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isUpdatingAfterburner, setIsUpdatingAfterburner] = useState(false);
  const [playerLevel, setPlayerLevel] = useState(1);
  // Auth is guaranteed by server, so pass true and use auth.shipId
  const { worldData, isLoading, error, refetch, lastUpdateTime } = useWorldData(3000);
  const currentSpeedLimit = afterburnerStatus?.isActive && afterburnerStatus.boostedSpeed > 0 ? afterburnerStatus.boostedSpeed : maxSpeed;
  const currentSpeedValue = parseFloat(speedInput) || 0;
  const speedSliderPosition = speedToSliderPosition(currentSpeedValue, currentSpeedLimit);

  // Prevent page scrolling while on the game page
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const appEl = document.querySelector('.app') as HTMLElement | null;
    if (appEl) {
      appEl.style.height = '100dvh';
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

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia(MOBILE_GAME_MEDIA_QUERY);
    const updateMobileMode = () => setIsMobileMode(mediaQuery.matches);

    updateMobileMode();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateMobileMode);
      return () => mediaQuery.removeEventListener('change', updateMobileMode);
    }

    mediaQuery.addListener(updateMobileMode);
    return () => mediaQuery.removeListener(updateMobileMode);
  }, []);

  useEffect(() => {
    if (!isMobileMode) {
      setMobileTapInfoMode(false);
    }
  }, [isMobileMode]);

  useEffect(() => {
    debugDrawingsEnabledRef.current = debugDrawingsEnabled;
  }, [debugDrawingsEnabled]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    isMobileModeRef.current = isMobileMode;
  }, [isMobileMode]);

  useEffect(() => {
    mobileTapInfoModeRef.current = mobileTapInfoMode;
  }, [mobileTapInfoMode]);

  // Load UI preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedDebugEnabled = localStorage.getItem('game-ui-debug-enabled');
      const savedZoom = localStorage.getItem('game-ui-zoom');
      if (savedDebugEnabled !== null) {
        setDebugDrawingsEnabled(JSON.parse(savedDebugEnabled));
      }
      if (savedZoom !== null) {
        setZoom(JSON.parse(savedZoom));
      }
    } catch (err) {
      console.warn('Failed to load UI preferences from localStorage:', err);
    }
  }, []);

  // Save debug flag to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('game-ui-debug-enabled', JSON.stringify(debugDrawingsEnabled));
    } catch (err) {
      console.warn('Failed to save debug preference:', err);
    }
  }, [debugDrawingsEnabled]);

  // Save zoom to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('game-ui-zoom', JSON.stringify(zoom));
    } catch (err) {
      console.warn('Failed to save zoom preference:', err);
    }
  }, [zoom]);

  // Resize canvas buffer to match physical pixel count: reads rendered CSS dimensions,
  // multiplies by devicePixelRatio to get the buffer size, and re-runs when isLoading
  // completes (ensuring the canvas is in the DOM). ResizeObserver handles subsequent
  // window/container resizes. CSS rule width:100%;height:100% keeps the canvas fluid.
  useEffect(() => {
    const container = canvasContainerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };

    requestAnimationFrame(resize);
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [isLoading]);

  // Keep the game renderer informed of the control bar height so the
  // radar can draw coordinates above the UI overlay.
  useEffect(() => {
    const controlBar = controlBarRef.current;
    if (!controlBar) return;

    const update = () => {
      if (gameInstanceRef.current) {
        const controlBarHeight = controlBar.getBoundingClientRect().height;
        const iconBarHeight = iconBarRef.current?.getBoundingClientRect().height ?? 0;
        // Icon bar is now transparent over canvas; only the opaque control panel
        // needs to be kept clear of coordinate labels.
        const panelHeight = Math.max(0, controlBarHeight - iconBarHeight);
        gameInstanceRef.current.setSafeAreaBottom(panelHeight);
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(controlBar);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  });

  // Fetch max speed for the slider and afterburner status
  useEffect(() => {
    const fetchMaxSpeed = async () => {
      try {
        const stats = await getShipStats();
        if (stats && !('error' in stats)) {
          setMaxSpeed(stats.maxSpeed);
          if (stats.afterburner) {
            setAfterburnerStatus(stats.afterburner);
          }
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

  const announce = (text: string, variant?: 'orange') => {
    if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
    setAnnouncement({ text, key: Date.now(), variant });
    announcementTimerRef.current = setTimeout(() => setAnnouncement(null), 2500);
  };

  // Memoize the redirect callback to avoid recreating it on every render
  const handleAttackSuccess = useCallback(() => {
    router.push('/');
  }, [router]);

  // Memoize harvest result callback - called from Game after a collect attempt
  const handleHarvestResult = useCallback((result: { success: boolean; ironReward?: number; objectType?: string; error?: string }) => {
    if (result.success) {
      if (result.ironReward && result.ironReward > 0) {
        const label = result.objectType ? result.objectType.replace('_', ' ') : 'object';
        if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
        setAnnouncement({ text: `+${result.ironReward} iron from ${label}`, key: Date.now() });
        announcementTimerRef.current = setTimeout(() => setAnnouncement(null), 2500);
      } else {
        if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
        setAnnouncement({ text: 'Collected!', key: Date.now() });
        announcementTimerRef.current = setTimeout(() => setAnnouncement(null), 2500);
      }
    } else {
      if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
      setAnnouncement({ text: result.error ?? 'Collection failed', key: Date.now(), variant: 'orange' });
      announcementTimerRef.current = setTimeout(() => setAnnouncement(null), 2500);
    }
  }, []);

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
      game.setDebugDrawingsEnabled(debugDrawingsEnabledRef.current);
      game.setZoom(zoomRef.current);
      game.setMobileInteractionMode(isMobileModeRef.current);
      game.setMobileInfoMode(mobileTapInfoModeRef.current);
      // The game will receive world data through the update effect
      // Initial mode state is synced via the dedicated useEffects below
    } else {
      console.error('Game canvas not found');
    }
  }, []);

  useEffect(() => {
    let initializeAfterRenderFrame: number | null = null;
    let retryInitializeFrame: number | null = null;

    // Initialize game only when we have necessary data AND canvas is rendered (not loading)
    if (!gameInitializedRef.current && auth.shipId && !isLoading) {
      // Use requestAnimationFrame to ensure DOM is fully rendered
      const initializeAfterRender = () => {
        if (canvasRef.current) {
          initializeGame();
          gameInitializedRef.current = true;
        } else {
          // Retry once if canvas not immediately available
          retryInitializeFrame = requestAnimationFrame(() => {
            if (canvasRef.current) {
              initializeGame();
              gameInitializedRef.current = true;
            } else {
              console.error('Game canvas not found after retry');
            }
          });
        }
      };

      initializeAfterRenderFrame = requestAnimationFrame(initializeAfterRender);
    }

    // Clean up function
    return () => {
      if (initializeAfterRenderFrame !== null) {
        cancelAnimationFrame(initializeAfterRenderFrame);
      }
      if (retryInitializeFrame !== null) {
        cancelAnimationFrame(retryInitializeFrame);
      }
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
      // Set the harvest result callback to display feedback on canvas
      gameInstanceRef.current.setHarvestCallback?.(handleHarvestResult);
      // Set the teleport click callback for canvas click-to-teleport mode
      gameInstanceRef.current.setTeleportClickCallback?.(handleCanvasTeleport);
      // Set the starbase entry callback to redirect to starbase page
      gameInstanceRef.current.setStarbaseEntryCallback(handleStarbaseEntry);
    }
  }, [worldData, auth.shipId, refetch, handleAttackSuccess, handleHarvestResult, handleCanvasTeleport, handleStarbaseEntry]);

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

  const updateInputFieldsFromShip = (navigation?: Pick<NavigateResponse, 'angle' | 'speed'>) => {
    if (navigation) {
      if (typeof navigation.angle === 'number') {
        setAngleInput(navigation.angle.toFixed(1));
      }
      if (typeof navigation.speed === 'number') {
        setSpeedInput(navigation.speed.toFixed(1));
      }
      return;
    }

    if (gameInstanceRef.current) {
      const ship = gameInstanceRef.current.getWorld().getShip();
      if (ship) {
        setAngleInput(ship.getAngleDegrees().toFixed(1));
        setSpeedInput(ship.getSpeed().toFixed(1));
      }
    }
  };

  const handleSpeedSliderChange = (rawValue: string) => {
    const parsedPosition = parseFloat(rawValue);
    if (Number.isNaN(parsedPosition)) {
      setSpeedInput('0.0');
      return;
    }

    const previewSpeed = sliderPositionToSpeed(parsedPosition, currentSpeedLimit);
    setSpeedInput(previewSpeed.toFixed(1));
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

  const handleSetSpeed = async (nextSpeed?: number | string) => {
    if (isSettingSpeed) return;
    
    setIsSettingSpeed(true);
    try {
      const speedSource = nextSpeed ?? speedInput;
      const parsedSpeed = typeof speedSource === 'number' ? speedSource : parseFloat(speedSource);
      if (Number.isNaN(parsedSpeed)) {
        console.error('Invalid speed value');
        return;
      }

      const speed = clampSpeedValue(parsedSpeed, currentSpeedLimit);
      
      setSpeedInput(speed.toFixed(1));

      const navigationResult = await navigateShip({ speed });
      
      // Refresh world data to get updated ship state
      if (refetch) {
        refetch();
      }
      
      updateInputFieldsFromShip({ angle: navigationResult.angle, speed: navigationResult.speed });
    } catch (error) {
      console.error('❌ [CLIENT] Failed to set speed:', error);
    } finally {
      setIsSettingSpeed(false);
    }
  };

  const commitSpeedSlider = (rawValue: string) => {
    const parsedPosition = parseFloat(rawValue);
    if (Number.isNaN(parsedPosition)) {
      return;
    }

    void handleSetSpeed(sliderPositionToSpeed(parsedPosition, currentSpeedLimit));
  };

  const handleSpeedSliderKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
      commitSpeedSlider(e.currentTarget.value);
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
      setPlayerLevel(stats.level);
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

  useEffect(() => {
    if (gameInstanceRef.current) {
      gameInstanceRef.current.setMobileInteractionMode(isMobileMode);
    }
  }, [isMobileMode]);

  useEffect(() => {
    if (gameInstanceRef.current) {
      gameInstanceRef.current.setMobileInfoMode(mobileTapInfoMode);
    }
  }, [mobileTapInfoMode]);

  useEffect(() => {
    if (gameInstanceRef.current) {
      gameInstanceRef.current.setDebugDrawingsEnabled(debugDrawingsEnabled);
    }
  }, [debugDrawingsEnabled]);

  // Sync playerLevel with game instance
  useEffect(() => {
    if (gameInstanceRef.current) {
      gameInstanceRef.current.setPlayerLevel(playerLevel);
    }
  }, [playerLevel]);

  // Sync zoom with game instance
  useEffect(() => {
    if (gameInstanceRef.current) {
      gameInstanceRef.current.setZoom(zoom);
    }
  }, [zoom]);

  // Close teleport coord modal on Escape key
  useEffect(() => {
    if (!showTeleportCoordModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowTeleportCoordModal(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showTeleportCoordModal]);

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

  const formatAfterburnerFuelPercent = (status: AfterburnerStatus) => {
    return `${Math.max(0, Math.min(100, Math.round(status.fuelPercent)))}%`;
  };

  // Periodic refresh of afterburner status from ship-stats while fuel is changing.
  useEffect(() => {
    if (!afterburnerStatus) return;

    const needsPolling = afterburnerStatus.isActive || afterburnerStatus.fuelPercent < 100;
    if (!needsPolling) return;

    // Capture the active state when this effect runs.
    // Because afterburnerStatus?.isActive is a dependency, this effect is recreated
    // whenever isActive changes — so wasActive always reflects the state at the
    // start of the current polling period, not a stale value from a prior period.
    const wasActive = afterburnerStatus?.isActive ?? false;

    const interval = setInterval(async () => {
      try {
        const stats = await getShipStats();
        if (stats && !('error' in stats) && stats.afterburner) {
          setAfterburnerStatus(stats.afterburner);
          setMaxSpeed(stats.maxSpeed);
          if (wasActive && !stats.afterburner.isActive) {
            setSpeedInput(stats.speed.toFixed(1));
          }
        }
      } catch { /* ignore polling errors */ }
    }, 1000);

    return () => clearInterval(interval);
  }, [afterburnerStatus]);

  const handleActivateAfterburner = async () => {
    if (isUpdatingAfterburner) return;
    setIsUpdatingAfterburner(true);
    try {
      const result = await activateAfterburner();
      // Immediately refresh status
      const stats = await getShipStats();
      if (stats && !('error' in stats)) {
        setMaxSpeed(stats.maxSpeed);
        if (stats.afterburner) {
          setAfterburnerStatus(stats.afterburner);
        }
        setSpeedInput(stats.speed.toFixed(1));
      }
      if (refetch) refetch();
      announce(`Afterburner engaged at ${Math.round(result.fuelPercent)}% fuel`);
    } catch (error) {
      announce(error instanceof Error ? error.message : 'Afterburner activation failed', 'orange');
      console.error('❌ [CLIENT] Afterburner activation failed:', error);
    } finally {
      setIsUpdatingAfterburner(false);
    }
  };

  const handleDeactivateAfterburner = async () => {
    if (isUpdatingAfterburner) return;
    setIsUpdatingAfterburner(true);
    try {
      const result = await deactivateAfterburner();
      const stats = await getShipStats();
      if (stats && !('error' in stats)) {
        setMaxSpeed(stats.maxSpeed);
        if (stats.afterburner) {
          setAfterburnerStatus(stats.afterburner);
        }
        setSpeedInput(stats.speed.toFixed(1));
      }
      if (refetch) refetch();
      announce(`Afterburner disengaged with ${Math.round(result.fuelPercent)}% fuel remaining`);
    } catch (error) {
      announce(error instanceof Error ? error.message : 'Afterburner deactivation failed', 'orange');
      console.error('❌ [CLIENT] Afterburner deactivation failed:', error);
    } finally {
      setIsUpdatingAfterburner(false);
    }
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
      setShowTeleportCoordModal(false);
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

          {/* Data age indicator — top overlay, outside control bar */}
          {debugDrawingsEnabled && (
            <div className="data-age-overlay">
              <DataAgeIndicator lastUpdateTime={lastUpdateTime} className="inline" />
            </div>
          )}

          {/* Announcement overlay — fades out after display */}
          {announcement && (
            <div key={announcement.key} className={`announcement-overlay${announcement.variant ? ` announcement-overlay--${announcement.variant}` : ''}`}>
              {announcement.text}
            </div>
          )}

          {/* Teleport coordinate modal */}
          {showTeleportCoordModal && (
            <>
              <div
                className="teleport-coord-backdrop"
                onClick={() => setShowTeleportCoordModal(false)}
                aria-hidden="true"
              />
              <div
                className="teleport-coord-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="teleport-coord-modal-title"
              >
                <div id="teleport-coord-modal-title" className="teleport-coord-modal-title">teleport to coordinates</div>
                <div className="teleport-coord-modal-row">
                  <label htmlFor="modal-teleport-x" className="teleport-coord-modal-label">x</label>
                  <input
                    id="modal-teleport-x"
                    type="number"
                    value={teleportX}
                    onChange={(e) => setTeleportX(e.target.value)}
                    min="0"
                    max="5000"
                    step="1"
                    className="teleport-coord-modal-input"
                  />
                </div>
                <div className="teleport-coord-modal-row">
                  <label htmlFor="modal-teleport-y" className="teleport-coord-modal-label">y</label>
                  <input
                    id="modal-teleport-y"
                    type="number"
                    value={teleportY}
                    onChange={(e) => setTeleportY(e.target.value)}
                    min="0"
                    max="5000"
                    step="1"
                    className="teleport-coord-modal-input"
                  />
                </div>
                <div className="teleport-coord-modal-actions">
                  <button
                    onClick={handleTeleport}
                    disabled={isTeleporting || Math.floor(teleportCharges) < 1}
                    className="teleport-coord-modal-btn teleport-coord-modal-btn-primary"
                  >
                    {isTeleporting ? '...' : 'teleport'}
                  </button>
                  <button
                    onClick={() => setShowTeleportCoordModal(false)}
                    className="teleport-coord-modal-btn teleport-coord-modal-btn-cancel"
                  >
                    cancel
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Bottom Control Bar (Icon Bar + Expandable Panel) */}
          <div className="control-bar" ref={controlBarRef}>
            <div className="icon-bar" ref={iconBarRef}>
              {/* Navigation button */}
              <button
                className={`icon-button ${navOpen ? 'active' : ''}`}
                onClick={() => setNavOpen(!navOpen)}
                title="Navigation (angle, speed, zoom)"
              >
                ⚙️
              </button>

              {/* Teleport button */}
              {teleportMaxCharges > 0 && (
                <button
                  className={`icon-button ${teleportOpen ? 'active' : ''}`}
                  onClick={() => setTeleportOpen(!teleportOpen)}
                  title="Teleport"
                >
                  🌀
                  {Math.floor(teleportCharges) > 0 && <span className="badge">{Math.floor(teleportCharges)}</span>}
                </button>
              )}

              {/* Afterburner button */}
              {afterburnerStatus && afterburnerStatus.durationResearchLevel >= 1 && (
                <button
                  className={`icon-button ${afterburnerOpen ? 'active' : ''} ${afterburnerStatus.canActivate ? 'ready' : afterburnerStatus.isActive ? 'active-indicator' : ''}`}
                  onClick={() => setAfterburnerOpen(!afterburnerOpen)}
                  title="Afterburner"
                >
                  🔥
                </button>
              )}

              <div className="spacer"></div>

              {isMobileMode && (
                <button
                  className={`icon-button toggle-icon ${mobileTapInfoMode ? 'active' : ''}`}
                  onClick={() => {
                    const next = !mobileTapInfoMode;
                    setMobileTapInfoMode(next);
                    announce(next ? 'Info mode: first tap shows object info' : 'Direct mode: taps act immediately');
                  }}
                  title={`Tap mode: ${mobileTapInfoMode ? 'info' : 'direct'}`}
                >
                  ℹ️
                </button>
              )}

              {/* Attack toggle */}
              <button
                className={`icon-button toggle-icon ${attackClickMode ? 'active' : ''}`}
                onClick={() => {
                  const next = !attackClickMode;
                  setAttackClickMode(next);
                  announce(next ? 'Attack mode: tap a ship to attack' : 'Attack mode off');
                }}
                title="Attack mode"
              >
                ⚔️
              </button>

              {/* Debug toggle */}
              <button
                className={`icon-button toggle-icon ${debugDrawingsEnabled ? 'active' : ''}`}
                onClick={() => {
                  const next = !debugDrawingsEnabled;
                  handleDebugToggle(next);
                  announce(next ? 'Debug drawings enabled' : 'Debug drawings off');
                }}
                title="Debug mode"
              >
                🐛
              </button>
            </div>

            {/* Multi-section control panel — sections side by side */}
            {(navOpen || (teleportOpen && teleportMaxCharges > 0) || (afterburnerOpen && afterburnerStatus && afterburnerStatus.durationResearchLevel >= 1)) && (
              <div className="control-panel">

                {/* Navigation section */}
                {navOpen && (
                  <div className="panel-section">
                    <span className="section-label">nav</span>
                    <div className="control-row">
                      <label htmlFor="speed-slider">speed</label>
                      <input
                        id="speed-slider"
                        type="range"
                        min={0}
                        max={SPEED_SLIDER_RANGE_MAX}
                        step={0.1}
                        value={speedSliderPosition}
                        onChange={(e) => handleSpeedSliderChange(e.target.value)}
                        onMouseUp={(e) => commitSpeedSlider(e.currentTarget.value)}
                        onTouchEnd={(e) => commitSpeedSlider(e.currentTarget.value)}
                        onKeyUp={handleSpeedSliderKeyUp}
                        aria-valuetext={`${currentSpeedValue.toFixed(1)} / ${currentSpeedLimit.toFixed(1)}`}
                        data-speed-limit={currentSpeedLimit.toFixed(1)}
                        disabled={isSettingSpeed}
                        className="speed-slider speed-slider--snap-zones"
                        style={{
                          '--speed-slider-snap-start': `${SPEED_SLIDER_ACTIVE_TRACK_START}%`,
                          '--speed-slider-snap-end': `${SPEED_SLIDER_ACTIVE_TRACK_END}%`,
                        } as React.CSSProperties}
                      />
                      <span className="speed-value">{currentSpeedValue.toFixed(1)}</span>
                    </div>
                    <div className="control-row">
                      <label htmlFor="angle-input">angle °</label>
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
                      <button onClick={handleSetAngle} disabled={isSettingAngle} className="control-button btn-primary">
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
                )}

                {/* Teleport section */}
                {teleportOpen && teleportMaxCharges > 0 && (
                  <div className="panel-section">
                    <span className="section-label">teleport</span>
                    <div className="status-row">
                      <span className="charges-badge">{formatNumber(teleportCharges)} / {formatNumber(teleportMaxCharges)}</span>
                      {teleportCharges < teleportMaxCharges && teleportRechargeTimeSec > 0 && (
                        <span className="timer">next: {formatTimeRemaining((Math.ceil(teleportCharges) === Math.floor(teleportCharges) ? 1 : Math.ceil(teleportCharges) - teleportCharges) * teleportRechargeTimeSec / Math.max(1, timeMultiplier))}</span>
                      )}
                    </div>
                    <div className="control-row">
                      <button
                        onClick={() => setShowTeleportCoordModal(true)}
                        disabled={Math.floor(teleportCharges) < 1}
                        className="control-button btn-primary btn-full"
                      >
                        enter coordinates
                      </button>
                    </div>
                    <label className="toggle-label">
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
                )}

                {/* Afterburner section */}
                {afterburnerOpen && afterburnerStatus && afterburnerStatus.durationResearchLevel >= 1 && (
                  <div className="panel-section">
                    <span className="section-label">afterburner</span>
                    <div className="status-row">
                      <span className="charges-badge">fuel {formatAfterburnerFuelPercent(afterburnerStatus)}</span>
                      {afterburnerStatus.isActive ? (
                        <span className="status-active">burn: {formatTimeRemaining(afterburnerStatus.boostRemainingMs / 1000)}</span>
                      ) : afterburnerStatus.canActivate ? (
                        afterburnerStatus.cooldownRemainingMs > 0 ? (
                          <span className="timer">full in {formatTimeRemaining(afterburnerStatus.cooldownRemainingMs / 1000)}</span>
                        ) : null
                      ) : (
                        <span className="status-cooldown">ready at {afterburnerStatus.activationThresholdPercent}% in {formatTimeRemaining(afterburnerStatus.timeToActivationMs / 1000)}</span>
                      )}
                    </div>
                    {afterburnerStatus.isActive ? (
                      <button
                        onClick={handleDeactivateAfterburner}
                        disabled={isUpdatingAfterburner}
                        className="control-button btn-primary btn-full afterburner-available"
                        style={{ ['--afterburner-fuel-fill' as string]: `${Math.max(0, Math.min(100, afterburnerStatus.fuelPercent))}` }}
                      >
                        <span className="afterburner-fuel-button__track" aria-hidden="true">
                          <span className="afterburner-fuel-button__fill"></span>
                        </span>
                        <span className="afterburner-fuel-button__label">{isUpdatingAfterburner ? '...' : 'disengage'}</span>
                      </button>
                    ) : afterburnerStatus.canActivate ? (
                      <button
                        onClick={handleActivateAfterburner}
                        disabled={isUpdatingAfterburner}
                        className="control-button btn-primary btn-full afterburner-available"
                        style={{ ['--afterburner-fuel-fill' as string]: `${Math.max(0, Math.min(100, afterburnerStatus.fuelPercent))}` }}
                      >
                        <span className="afterburner-fuel-button__track" aria-hidden="true">
                          <span className="afterburner-fuel-button__fill"></span>
                        </span>
                        <span className="afterburner-fuel-button__label">{isUpdatingAfterburner ? '...' : 'engage'}</span>
                      </button>
                    ) : (
                      <div className="status-row">
                        <span className="status-cooldown">recharging</span>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default GamePageClient;
