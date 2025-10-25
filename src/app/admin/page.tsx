'use client';

import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { useAuth } from '@/lib/client/hooks/useAuth';
import type { Battle } from '@/shared/battleTypes';
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

const AdminPage: React.FC = () => {
  const { username, isLoggedIn, isLoading } = useAuth();
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

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
  }, [username, isLoggedIn, isLoading]);

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