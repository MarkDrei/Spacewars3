'use client';

import React from 'react';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { messagesService, UnreadMessage } from '@/lib/client/services/messagesService';
import { useTechCounts } from '@/lib/client/hooks/useTechCounts';
import { useDefenseValues } from '@/lib/client/hooks/useDefenseValues';
import { useBattleStatus } from '@/lib/client/hooks/useBattleStatus';
import { ServerAuthState } from '@/lib/server/serverSession';
import './HomePage.css';

interface HomePageClientProps {
  auth: ServerAuthState;
  initialMessages: UnreadMessage[];
}

const HomePageClient: React.FC<HomePageClientProps> = ({ auth, initialMessages }) => {
  // Messages are pre-loaded from server - maintain in state for dynamic updates
  const [messages, setMessages] = React.useState<UnreadMessage[]>(initialMessages);
  const [isMarkingAsRead, setIsMarkingAsRead] = React.useState(false);
  
  const { techCounts, weapons, defenses, isLoading: techLoading, error: techError } = useTechCounts();
  const { defenseValues, isLoading: defenseLoading, error: defenseError } = useDefenseValues();
  const { battleStatus, isLoading: battleLoading, error: battleError } = useBattleStatus();

  // Handler for marking all messages as read
  const handleMarkAllAsRead = async () => {
    if (isMarkingAsRead || messages.length === 0) return;
    
    setIsMarkingAsRead(true);
    try {
      const result = await messagesService.markAllAsRead();
      if (result.success) {
        // Clear messages from display
        setMessages([]);
        console.log(`✅ Marked ${result.markedCount} message(s) as read`);
      }
    } catch (error) {
      console.error('❌ Failed to mark messages as read:', error);
    } finally {
      setIsMarkingAsRead(false);
    }
  };

  // Use battle stats for defense values if in battle, otherwise use regular defense values
  const displayDefenseValues = battleStatus?.inBattle && battleStatus.battle?.myStats 
    ? {
        hull: { 
          name: 'Hull', 
          current: Math.round(battleStatus.battle.myStats.hull.current), 
          max: battleStatus.battle.myStats.hull.max 
        },
        armor: { 
          name: 'Armor', 
          current: Math.round(battleStatus.battle.myStats.armor.current), 
          max: battleStatus.battle.myStats.armor.max 
        },
        shield: { 
          name: 'Shield', 
          current: Math.round(battleStatus.battle.myStats.shield.current), 
          max: battleStatus.battle.myStats.shield.max 
        }
      }
    : defenseValues;

  // Calculate color based on percentage (0% = red, 50% = yellow, 100% = green)
  const getDefenseColor = (current: number, max: number): string => {
    if (max === 0) return '#4caf50'; // Green if no max (shouldn't happen)
    
    const percentage = current / max;
    
    if (percentage <= 0.5) {
      // Red (0%) to Yellow (50%)
      // Red: #f44336, Yellow: #ffeb3b
      const ratio = percentage * 2; // 0 to 1
      const r = 244;
      const g = Math.round(67 + (235 - 67) * ratio);
      const b = Math.round(54 + (59 - 54) * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Yellow (50%) to Green (100%)
      // Yellow: #ffeb3b, Green: #4caf50
      const ratio = (percentage - 0.5) * 2; // 0 to 1
      const r = Math.round(255 - (255 - 76) * ratio);
      const g = Math.round(235 + (175 - 235) * ratio);
      const b = Math.round(59 + (80 - 59) * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    }
  };

  // Format weapon cooldown time remaining
  const formatCooldown = (cooldownTimestamp: number): string => {
    const now = Math.floor(Date.now() / 1000);
    const secondsRemaining = Math.max(0, cooldownTimestamp - now);
    
    if (secondsRemaining === 0) return 'Ready';
    if (secondsRemaining < 60) return `${secondsRemaining}s`;
    
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;
    return `${minutes}m ${seconds}s`;
  };

  return (
    <AuthenticatedLayout>
      <div className="home-page">
        <div className="home-container">
          {/* Battle Status Banner */}
          {!battleLoading && battleStatus?.inBattle && battleStatus.battle && (
            <div className="battle-banner">
              <div className="battle-banner-header">
                ⚔️ BATTLE IN PROGRESS
              </div>
              <div className="battle-banner-content">
                <p>
                  {battleStatus.battle.isAttacker ? 'You attacked' : 'You are under attack from'} opponent #{battleStatus.battle.opponentId}
                </p>
                {battleStatus.battle.weaponCooldowns && Object.keys(battleStatus.battle.weaponCooldowns).length > 0 && (
                  <div className="weapon-cooldowns">
                    <div className="cooldown-header">Weapon Cooldowns:</div>
                    <div className="cooldown-list">
                      {Object.entries(battleStatus.battle.weaponCooldowns).map(([weapon, timestamp]) => (
                        <div key={weapon} className="cooldown-item">
                          <span className="weapon-name">{weapon.replace(/_/g, ' ')}</span>
                          <span className="cooldown-time">{formatCooldown(timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th colSpan={2}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Notifications</span>
                      {messages.length > 0 && (
                        <button 
                          onClick={handleMarkAllAsRead}
                          disabled={isMarkingAsRead}
                          style={{
                            padding: '4px 12px',
                            fontSize: '0.85rem',
                            backgroundColor: isMarkingAsRead ? '#666' : '#4caf50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isMarkingAsRead ? 'not-allowed' : 'pointer',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (!isMarkingAsRead) {
                              (e.target as HTMLButtonElement).style.backgroundColor = '#45a049';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isMarkingAsRead) {
                              (e.target as HTMLButtonElement).style.backgroundColor = '#4caf50';
                            }
                          }}
                        >
                          {isMarkingAsRead ? 'Marking...' : 'Mark All as Read'}
                        </button>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {messages.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="empty-cell">
                      No new messages
                    </td>
                  </tr>
                ) : (
                  messages.map(message => (
                    <tr key={message.id} className="data-row">
                      <td className="time-cell">
                        <div className="time-line">{messagesService.formatTime(message.created_at)}</div>
                        <div className="date-line">{messagesService.formatDate(message.created_at)}</div>
                      </td>
                      <td className="data-cell message-cell">
                        {message.message}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Defense Values Table */}
          <div className="data-table-container defense-values-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th colSpan={3}>Defense Values</th>
                </tr>
              </thead>
              <tbody>
                {defenseLoading ? (
                  <tr>
                    <td colSpan={3} className="loading-cell">
                      Loading defense values...
                    </td>
                  </tr>
                ) : defenseError ? (
                  <tr>
                    <td colSpan={3} className="error-cell">
                      Error: {defenseError}
                    </td>
                  </tr>
                ) : displayDefenseValues ? (
                  <>
                    {(displayDefenseValues.hull.max > 0) && (
                      <tr className="data-row">
                        <td className="data-cell">{displayDefenseValues.hull.name}</td>
                        <td className="data-cell defense-value-cell" style={{ color: getDefenseColor(displayDefenseValues.hull.current, displayDefenseValues.hull.max) }}>
                          {displayDefenseValues.hull.current}
                        </td>
                        <td className="data-cell defense-value-cell">{displayDefenseValues.hull.max}</td>
                      </tr>
                    )}
                    {(displayDefenseValues.armor.max > 0) && (
                      <tr className="data-row">
                        <td className="data-cell">{displayDefenseValues.armor.name}</td>
                        <td className="data-cell defense-value-cell" style={{ color: getDefenseColor(displayDefenseValues.armor.current, displayDefenseValues.armor.max) }}>
                          {displayDefenseValues.armor.current}
                        </td>
                        <td className="data-cell defense-value-cell">{displayDefenseValues.armor.max}</td>
                      </tr>
                    )}
                    {(displayDefenseValues.shield.max > 0) && (
                      <tr className="data-row">
                        <td className="data-cell">{displayDefenseValues.shield.name}</td>
                        <td className="data-cell defense-value-cell" style={{ color: getDefenseColor(displayDefenseValues.shield.current, displayDefenseValues.shield.max) }}>
                          {displayDefenseValues.shield.current}
                        </td>
                        <td className="data-cell defense-value-cell">{displayDefenseValues.shield.max}</td>
                      </tr>
                    )}
                    {(displayDefenseValues.hull.max === 0 && displayDefenseValues.armor.max === 0 && displayDefenseValues.shield.max === 0) && (
                      <tr>
                        <td colSpan={3} className="empty-cell">
                          No defense systems built yet
                        </td>
                      </tr>
                    )}
                  </>
                ) : (
                  <tr>
                    <td colSpan={3} className="empty-cell">
                      No defense data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Tech Counts Table */}
          <div className="data-table-container tech-counts-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th colSpan={2}>Tech Inventory</th>
                </tr>
              </thead>
              <tbody>
                {techLoading ? (
                  <tr>
                    <td colSpan={2} className="loading-cell">
                      Loading tech counts...
                    </td>
                  </tr>
                ) : techError ? (
                  <tr>
                    <td colSpan={2} className="error-cell">
                      Error: {techError}
                    </td>
                  </tr>
                ) : techCounts ? (
                  <>
                    {/* Defense Section */}
                    {(techCounts.ship_hull > 0 || techCounts.kinetic_armor > 0 || techCounts.energy_shield > 0 || techCounts.missile_jammer > 0) && (
                      <>
                        <tr>
                          <td colSpan={2} className="category-header">Defense</td>
                        </tr>
                        {techCounts.ship_hull > 0 && (
                          <tr className="data-row">
                            <td className="data-cell">{defenses.ship_hull?.name || 'Ship Hull'}</td>
                            <td className="data-cell tech-count-cell">{techCounts.ship_hull}</td>
                          </tr>
                        )}
                        {techCounts.kinetic_armor > 0 && (
                          <tr className="data-row">
                            <td className="data-cell">{defenses.kinetic_armor?.name || 'Kinetic Armor'}</td>
                            <td className="data-cell tech-count-cell">{techCounts.kinetic_armor}</td>
                          </tr>
                        )}
                        {techCounts.energy_shield > 0 && (
                          <tr className="data-row">
                            <td className="data-cell">{defenses.energy_shield?.name || 'Energy Shield'}</td>
                            <td className="data-cell tech-count-cell">{techCounts.energy_shield}</td>
                          </tr>
                        )}
                        {techCounts.missile_jammer > 0 && (
                          <tr className="data-row">
                            <td className="data-cell">{defenses.missile_jammer?.name || 'Missile Jammer'}</td>
                            <td className="data-cell tech-count-cell">{techCounts.missile_jammer}</td>
                          </tr>
                        )}
                      </>
                    )}

                    {/* Weapons Section */}
                    {(techCounts.pulse_laser > 0 || techCounts.auto_turret > 0 || techCounts.plasma_lance > 0 || techCounts.gauss_rifle > 0 || techCounts.photon_torpedo > 0 || techCounts.rocket_launcher > 0) && (
                      <>
                        <tr>
                          <td colSpan={2} className="category-header">Weapons</td>
                        </tr>
                        {techCounts.pulse_laser > 0 && (
                          <tr className="data-row">
                            <td className="data-cell">{weapons.pulse_laser?.name || 'Pulse Laser'}</td>
                            <td className="data-cell tech-count-cell">{techCounts.pulse_laser}</td>
                          </tr>
                        )}
                        {techCounts.auto_turret > 0 && (
                          <tr className="data-row">
                            <td className="data-cell">{weapons.auto_turret?.name || 'Auto Turret'}</td>
                            <td className="data-cell tech-count-cell">{techCounts.auto_turret}</td>
                          </tr>
                        )}
                        {techCounts.plasma_lance > 0 && (
                          <tr className="data-row">
                            <td className="data-cell">{weapons.plasma_lance?.name || 'Plasma Lance'}</td>
                            <td className="data-cell tech-count-cell">{techCounts.plasma_lance}</td>
                          </tr>
                        )}
                        {techCounts.gauss_rifle > 0 && (
                          <tr className="data-row">
                            <td className="data-cell">{weapons.gauss_rifle?.name || 'Gauss Rifle'}</td>
                            <td className="data-cell tech-count-cell">{techCounts.gauss_rifle}</td>
                          </tr>
                        )}
                        {techCounts.photon_torpedo > 0 && (
                          <tr className="data-row">
                            <td className="data-cell">{weapons.photon_torpedo?.name || 'Photon Torpedo'}</td>
                            <td className="data-cell tech-count-cell">{techCounts.photon_torpedo}</td>
                          </tr>
                        )}
                        {techCounts.rocket_launcher > 0 && (
                          <tr className="data-row">
                            <td className="data-cell">{weapons.rocket_launcher?.name || 'Rocket Launcher'}</td>
                            <td className="data-cell tech-count-cell">{techCounts.rocket_launcher}</td>
                          </tr>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <tr>
                    <td colSpan={2} className="empty-cell">
                      No tech data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Weapon Cooldowns Table - Only shown if in battle */}
          {battleStatus?.inBattle && battleStatus.battle && (
            <div className="data-table-container weapon-cooldowns-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th colSpan={3}>⚔️ Battle Active - Weapon Cooldowns</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(battleStatus.battle.weaponCooldowns).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="empty-cell">
                        No weapons in this battle
                      </td>
                    </tr>
                  ) : (
                    Object.entries(battleStatus.battle.weaponCooldowns).map(([weaponType, lastFired]) => {
                      const weapon = weapons[weaponType as keyof typeof weapons];
                      const now = Math.floor(Date.now() / 1000);
                      // Get cooldown from weapon stats in battle or use default 5s
                      const weaponStats = battleStatus.battle?.myStats?.weapons?.[weaponType];
                      const cooldownPeriod = weaponStats?.cooldown || (weapon && 'cooldown' in weapon ? (weapon as { cooldown: number }).cooldown : 5);
                      const timeSinceFired = now - (lastFired || 0);
                      const isReady = timeSinceFired >= cooldownPeriod;
                      const timeRemaining = Math.max(0, cooldownPeriod - timeSinceFired);
                      
                      return (
                        <tr key={weaponType} className="data-row">
                          <td className="data-cell">{weapon?.name || weaponType}</td>
                          <td className="data-cell cooldown-status-cell">
                            {isReady ? (
                              <span style={{ color: '#4caf50' }}>✓ Ready</span>
                            ) : (
                              <span style={{ color: '#ff9800' }}>{timeRemaining}s</span>
                            )}
                          </td>
                          <td className="data-cell cooldown-info-cell">
                            {cooldownPeriod}s cooldown
                          </td>
                        </tr>
                      );
                    })
                  )}
                  <tr>
                    <td colSpan={3} className="battle-info-cell">
                      Battle #{battleStatus.battle.id} | {battleStatus.battle.isAttacker ? 'Attacking' : 'Defending'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default HomePageClient;