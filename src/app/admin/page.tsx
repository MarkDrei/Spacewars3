'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { useAuth } from '@/lib/client/hooks/useAuth';
import type { Battle } from '@/lib/server/battle/battleTypes';
import './AdminPage.css';

interface UserData {
  id: number;
  username: string;
  iron: number;
  pulse_laser: number;
  auto_turret: number;
  plasma_lance: number;
  gauss_rifle: number;
  photon_torpedo: number;
  rocket_launcher: number;
  ship_hull: number;
  kinetic_armor: number;
  energy_shield: number;
  missile_jammer: number;
  build_queue: string | null;
  build_start_sec: number | null;
  last_updated: number;
  // Tech tree / Research levels - all research data
  researches: Record<string, number>;
}

interface SpaceObject {
  id: number;
  x: number;
  y: number;
  type: string;
  speed: number;
  angle: number;
  last_position_update_ms: number;
}

interface AdminData {
  users: UserData[];
  spaceObjects: SpaceObject[];
  battles: Battle[];
  totalUsers: number;
  totalObjects: number;
  totalBattles: number;
  timestamp: string;
}

interface MultiplierStatus {
  multiplier: number;
  expiresAt: number | null;
  activatedAt: number | null;
  remainingSeconds: number;
}

const AdminPage: React.FC = () => {
  const { username, isLoggedIn, isLoading } = useAuth();
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Time multiplier state
  const [multiplierStatus, setMultiplierStatus] = useState<MultiplierStatus>({
    multiplier: 1,
    expiresAt: null,
    activatedAt: null,
    remainingSeconds: 0,
  });
  const [customMultiplier, setCustomMultiplier] = useState<number>(10);
  const [customDuration, setCustomDuration] = useState<number>(5);
  const [isLoadingMultiplier, setIsLoadingMultiplier] = useState(false);
  const multiplierIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch admin data
  const fetchAdminData = async () => {
    try {
      setIsLoadingData(true);
      const response = await fetch('/api/admin/database');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setAdminData(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch database data');
    } finally {
      setIsLoadingData(false);
    }
  };

  // Fetch time multiplier status
  const fetchMultiplierStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/time-multiplier');
      
      if (!response.ok) {
        console.error('Failed to fetch multiplier status:', response.statusText);
        return;
      }

      const data = await response.json();
      setMultiplierStatus(data);
    } catch (err) {
      console.error('Failed to fetch multiplier status:', err);
    }
  }, []);

  // Set time multiplier
  const setTimeMultiplier = async (multiplier: number, durationMinutes: number) => {
    try {
      setIsLoadingMultiplier(true);
      const response = await fetch('/api/admin/time-multiplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multiplier, durationMinutes }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to set multiplier');
      }

      // Fetch updated status immediately
      await fetchMultiplierStatus();
    } catch (err) {
      console.error('Failed to set multiplier:', err);
      alert(err instanceof Error ? err.message : 'Failed to set multiplier');
    } finally {
      setIsLoadingMultiplier(false);
    }
  };

  // Handle preset button clicks
  const handlePresetClick = (multiplier: number, durationMinutes: number) => {
    setTimeMultiplier(multiplier, durationMinutes);
  };

  // Handle custom form submission
  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customMultiplier >= 1 && customDuration > 0) {
      setTimeMultiplier(customMultiplier, customDuration);
    } else {
      alert('Multiplier must be >= 1 and duration must be > 0');
    }
  };

  // Handle reset to 1x
  const handleReset = () => {
    setTimeMultiplier(1, 0.01); // Set to 1x with minimal duration (auto-expires immediately)
  };

  // Format time remaining as MM:SS
  const formatTimeRemaining = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format activation time
  const formatActivationTime = (timestamp: number | null): string => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleTimeString();
  };

  useEffect(() => {
    if (isLoading) return;
    
    // Check if user is authorized (same as cheat mode)
    if (!isLoggedIn || !username || (username !== 'a' && username !== 'q')) {
      setError('Access denied. Admin access required.');
      setIsLoadingData(false);
      return;
    }

    setIsAuthorized(true);
    fetchAdminData();
    fetchMultiplierStatus();
  }, [username, isLoggedIn, isLoading, fetchMultiplierStatus]);

  // Poll multiplier status every 5 seconds when active
  useEffect(() => {
    if (!isAuthorized) return;

    // Initial fetch is done in the main useEffect
    // Start polling
    multiplierIntervalRef.current = setInterval(() => {
      fetchMultiplierStatus();
    }, 5000);

    return () => {
      if (multiplierIntervalRef.current) {
        clearInterval(multiplierIntervalRef.current);
      }
    };
  }, [isAuthorized, fetchMultiplierStatus]);

  // Local countdown timer (updates every second)
  useEffect(() => {
    if (multiplierStatus.remainingSeconds <= 0) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      return;
    }

    countdownIntervalRef.current = setInterval(() => {
      setMultiplierStatus((prev) => ({
        ...prev,
        remainingSeconds: Math.max(0, prev.remainingSeconds - 1),
      }));
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [multiplierStatus.remainingSeconds]);

  if (isLoading || isLoadingData) {
    return (
      <AuthenticatedLayout>
        <div className="admin-page">
          <div className="loading">Loading admin data...</div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (!isAuthorized) {
    return (
      <AuthenticatedLayout>
        <div className="admin-page">
          <div className="error-message">
            <h2>🚫 Access Denied</h2>
            <p>Admin access is restricted to developers only.</p>
            <p>Current user: {username || 'Unknown'}</p>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (error) {
    return (
      <AuthenticatedLayout>
        <div className="admin-page">
          <div className="error-message">
            <h2>⚠️ Error</h2>
            <p>{error}</p>
            <button onClick={fetchAdminData} className="retry-button">
              🔄 Retry
            </button>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (!adminData) {
    return (
      <AuthenticatedLayout>
        <div className="admin-page">
          <div className="loading">No data available</div>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="admin-page">
        <div className="admin-header">
          <h1>🛠️ Database Admin Panel</h1>
          <div className="admin-actions">
            <span className="last-updated">
              Last updated: {new Date(adminData.timestamp).toLocaleTimeString()}
            </span>
            <button onClick={fetchAdminData} className="refresh-button">
              🔄 Refresh Data
            </button>
          </div>
        </div>

        {/* Time Multiplier Section */}
        <div className="time-multiplier-section">
          <h2>⚡ Time Multiplier Control</h2>
          
          {/* Status Display */}
          <div className="multiplier-status">
            <div className={`multiplier-badge ${multiplierStatus.multiplier > 1 ? 'multiplier-active' : 'multiplier-inactive'}`}>
              Time Multiplier: {multiplierStatus.multiplier}x
            </div>
            
            {multiplierStatus.multiplier > 1 && multiplierStatus.remainingSeconds > 0 && (
              <>
                <div className="multiplier-countdown">
                  Expires in: {formatTimeRemaining(multiplierStatus.remainingSeconds)}
                </div>
                <div className="multiplier-activated">
                  Activated: {formatActivationTime(multiplierStatus.activatedAt)}
                </div>
              </>
            )}
          </div>

          {/* Quick Action Presets */}
          <div className="multiplier-controls">
            <button
              onClick={() => handlePresetClick(10, 5)}
              className="multiplier-preset-btn"
              disabled={isLoadingMultiplier}
            >
              10x for 5 min
            </button>
            <button
              onClick={() => handlePresetClick(10, 15)}
              className="multiplier-preset-btn"
              disabled={isLoadingMultiplier}
            >
              10x for 15 min
            </button>
            <button
              onClick={() => handlePresetClick(50, 5)}
              className="multiplier-preset-btn"
              disabled={isLoadingMultiplier}
            >
              50x for 5 min
            </button>
          </div>

          {/* Custom Form */}
          <form onSubmit={handleCustomSubmit} className="multiplier-custom-form">
            <label>
              Custom Multiplier:
              <input
                type="number"
                min="1"
                step="1"
                value={customMultiplier}
                onChange={(e) => setCustomMultiplier(Number(e.target.value))}
                disabled={isLoadingMultiplier}
              />
            </label>
            <label>
              Duration (minutes):
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={customDuration}
                onChange={(e) => setCustomDuration(Number(e.target.value))}
                disabled={isLoadingMultiplier}
              />
            </label>
            <button type="submit" className="multiplier-preset-btn" disabled={isLoadingMultiplier}>
              Activate Custom
            </button>
          </form>

          {/* Reset Button */}
          {multiplierStatus.multiplier > 1 && (
            <button
              onClick={handleReset}
              className="multiplier-reset-btn"
              disabled={isLoadingMultiplier}
            >
              🔄 Reset to 1x
            </button>
          )}
        </div>

        <div className="admin-stats">
          <div className="stat-card">
            <h3>👥 Total Users</h3>
            <div className="stat-value">{adminData.totalUsers}</div>
          </div>
          <div className="stat-card">
            <h3>🌌 Space Objects</h3>
            <div className="stat-value">{adminData.totalObjects}</div>
          </div>
          <div className="stat-card">
            <h3>⚔️ Total Battles</h3>
            <div className="stat-value">{adminData.totalBattles}</div>
          </div>
          <div className="stat-card">
            <h3>🆔 Current User</h3>
            <div className="stat-value">{username}</div>
          </div>
        </div>

        {/* Users Table */}
        <div className="data-section">
          <h2>👥 Users Table</h2>
          <div className="data-table-container">
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Iron</th>
                  <th>Weapons</th>
                  <th>Defenses</th>
                  <th>Research</th>
                  <th>Build Queue</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {adminData.users.map((userData) => (
                  <tr key={userData.id} className="data-row">
                    <td className="data-cell">{userData.id}</td>
                    <td className="data-cell">
                      <span className={`username ${userData.username === username ? 'current-user' : ''}`}>
                        {userData.username}
                        {userData.username === username && ' (YOU)'}
                      </span>
                    </td>
                    <td className="data-cell">{userData.iron.toLocaleString()}</td>
                    <td className="data-cell">
                      <div className="tech-counts">
                        <span>Pulse: {userData.pulse_laser}</span>
                        <span>Auto: {userData.auto_turret}</span>
                        <span>Plasma: {userData.plasma_lance}</span>
                        <span>Gauss: {userData.gauss_rifle}</span>
                        <span>Photon: {userData.photon_torpedo}</span>
                        <span>Rocket: {userData.rocket_launcher}</span>
                      </div>
                    </td>
                    <td className="data-cell">
                      <div className="tech-counts">
                        <span>Hull: {userData.ship_hull}</span>
                        <span>Kinetic: {userData.kinetic_armor}</span>
                        <span>Energy: {userData.energy_shield}</span>
                        <span>Missile: {userData.missile_jammer}</span>
                      </div>
                    </td>
                    <td className="data-cell">
                      <div className="tech-counts">
                        {Object.entries(userData.researches).length > 0 ? (
                          Object.entries(userData.researches)
                            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                            .map(([key, value]) => (
                              <span key={key} title={key}>
                                {key.replace(/([A-Z])/g, ' $1').trim()}: {value}
                              </span>
                            ))
                        ) : (
                          <span className="empty">No research data</span>
                        )}
                      </div>
                    </td>
                    <td className="data-cell">
                      {userData.build_queue ? (
                        <div className="build-queue">
                          <div className="queue-count">
                            {JSON.parse(userData.build_queue).length} items
                          </div>
                          {userData.build_start_sec && (
                            <div className="build-time">
                              Started: {new Date(userData.build_start_sec * 1000).toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="empty">Empty</span>
                      )}
                    </td>
                    <td className="data-cell">
                      {new Date(userData.last_updated * 1000).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Space Objects Table */}
        <div className="data-section">
          <h2>🌌 Space Objects Table</h2>
          <div className="data-table-container">
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Position</th>
                  <th>Type</th>
                  <th>Speed</th>
                  <th>Angle</th>
                  <th>Last Update</th>
                </tr>
              </thead>
              <tbody>
                {adminData.spaceObjects.map((obj) => (
                  <tr key={obj.id} className="data-row">
                    <td className="data-cell">{obj.id}</td>
                    <td className="data-cell">
                      ({obj.x.toFixed(1)}, {obj.y.toFixed(1)})
                    </td>
                    <td className="data-cell">
                      <span className={`object-type ${obj.type}`}>
                        {obj.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="data-cell">{obj.speed.toFixed(2)}</td>
                    <td className="data-cell">{obj.angle.toFixed(1)}°</td>
                    <td className="data-cell">
                      {new Date(obj.last_position_update_ms).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Battles Table */}
        <div className="data-section">
          <h2>⚔️ Battles Table</h2>
          <div className="data-table-container">
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Attacker</th>
                  <th>Attackee</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Status</th>
                  <th>Winner</th>
                  <th>Loser</th>
                  <th>Attacker Damage</th>
                  <th>Attackee Damage</th>
                  <th>Events</th>
                </tr>
              </thead>
              <tbody>
                {adminData.battles.map((battle) => (
                  <tr key={battle.id} className="data-row">
                    <td className="data-cell">{battle.id}</td>
                    <td className="data-cell">
                      <span className="user-id">User #{battle.attackerId}</span>
                    </td>
                    <td className="data-cell">
                      <span className="user-id">User #{battle.attackeeId}</span>
                    </td>
                    <td className="data-cell">
                      {/* battleStartTime is Unix timestamp (seconds), needs * 1000 */}
                      {new Date(battle.battleStartTime * 1000).toLocaleString()}
                    </td>
                    <td className="data-cell">
                      {/* battleEndTime is already in milliseconds (Date.now()) */}
                      {battle.battleEndTime ? (
                        new Date(battle.battleEndTime).toLocaleString()
                      ) : (
                        <span className="ongoing">-</span>
                      )}
                    </td>
                    <td className="data-cell">
                      {battle.battleEndTime ? (
                        <span className="status-ended">Ended</span>
                      ) : (
                        <span className="status-ongoing">Ongoing</span>
                      )}
                    </td>
                    <td className="data-cell">
                      {battle.winnerId ? (
                        <span className="user-id">User #{battle.winnerId}</span>
                      ) : (
                        <span className="empty">-</span>
                      )}
                    </td>
                    <td className="data-cell">
                      {battle.loserId ? (
                        <span className="user-id">User #{battle.loserId}</span>
                      ) : (
                        <span className="empty">-</span>
                      )}
                    </td>
                    <td className="data-cell">
                      <span className="damage-value">{battle.attackerTotalDamage.toFixed(1)}</span>
                    </td>
                    <td className="data-cell">
                      <span className="damage-value">{battle.attackeeTotalDamage.toFixed(1)}</span>
                    </td>
                    <td className="data-cell">
                      <span className="event-count">{battle.battleLog.length}</span>
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

export default AdminPage;