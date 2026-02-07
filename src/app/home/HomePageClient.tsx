'use client';

import React from 'react';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { messagesService, UnreadMessage } from '@/lib/client/services/messagesService';
import { useTechCounts } from '@/lib/client/hooks/useTechCounts';
import { useDefenseValues } from '@/lib/client/hooks/useDefenseValues';
import { useBattleStatus } from '@/lib/client/hooks/useBattleStatus';
import { useXpLevel } from '@/lib/client/hooks/useXpLevel';
import { ServerAuthState } from '@/lib/server/serverSession';
import './HomePage.css';

interface HomePageClientProps {
  auth: ServerAuthState;
  initialMessages: UnreadMessage[];
}

// Message type based on prefix
type MessageType = 'neutral' | 'attack' | 'positive' | 'negative';

interface ParsedMessage {
  type: MessageType;
  content: string;
}

/**
 * Parse message to determine type and extract content
 * A: prefix = attack (red background)
 * N: prefix = negative (red background)
 * P: prefix = positive (green background)
 * No prefix = neutral (no special background)
 */
function parseMessage(message: string): ParsedMessage {
  if (message.startsWith('A: ')) {
    return { type: 'attack', content: message.substring(3) };
  }
  if (message.startsWith('N: ')) {
    return { type: 'negative', content: message.substring(3) };
  }
  if (message.startsWith('P: ')) {
    return { type: 'positive', content: message.substring(3) };
  }
  return { type: 'neutral', content: message };
}

function formatBoldText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

const HomePageClient: React.FC<HomePageClientProps> = ({ initialMessages }) => {
  // Messages are pre-loaded from server - maintain in state for dynamic updates
  // Sort messages by created_at descending (newest first)
  const [messages, setMessages] = React.useState<UnreadMessage[]>(
    [...initialMessages].sort((a, b) => b.created_at - a.created_at)
  );
  const [isMarkingAsRead, setIsMarkingAsRead] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isSummarizing, setIsSummarizing] = React.useState(false);
  
  const { techCounts, weapons, defenses, isLoading: techLoading, error: techError } = useTechCounts();
  const { defenseValues, isLoading: defenseLoading, error: defenseError } = useDefenseValues();
  const { battleStatus, isLoading: battleLoading } = useBattleStatus();
  const { xpData, isLoading: xpLoading, error: xpError } = useXpLevel(5000);

  // Handler for refreshing messages
  const handleRefreshMessages = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const result = await messagesService.getMessages();
      if (result.success) {
        // Sort messages by created_at descending (newest first)
        setMessages([...result.messages].sort((a, b) => b.created_at - a.created_at));
        console.log(`✅ Refreshed ${result.messages.length} message(s)`);
      }
    } catch (error) {
      console.error('❌ Failed to refresh messages:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

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

  // Handler for summarizing messages
  const handleSummarizeMessages = async () => {
    if (isSummarizing || messages.length === 0) return;
    
    setIsSummarizing(true);
    try {
      const response = await fetch('/api/messages/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to summarize messages');
      }

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Messages summarized`);
        console.log(result.summary);
        
        // Refresh messages to show the summary and any preserved messages
        await handleRefreshMessages();
      }
    } catch (error) {
      console.error('❌ Failed to summarize messages:', error);
    } finally {
      setIsSummarizing(false);
    }
  };

  // Always use defenseValues from the dedicated hook (works both in and out of battle)
  // The useDefenseValues hook polls /api/ship-stats which returns current User defense values
  const displayDefenseValues = defenseValues;

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
                <div className="battle-damage-stats">
                  <div className="damage-stat">
                    <span className="damage-label">Your Damage:</span>
                    <span className="damage-value">{Math.round(battleStatus.battle.myTotalDamage)}</span>
                  </div>
                  <div className="damage-stat">
                    <span className="damage-label">Opponent Damage:</span>
                    <span className="damage-value">{Math.round(battleStatus.battle.opponentTotalDamage)}</span>
                  </div>
                </div>
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
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={handleRefreshMessages}
                          disabled={isRefreshing}
                          style={{
                            padding: '4px 12px',
                            fontSize: '0.85rem',
                            backgroundColor: isRefreshing ? '#666' : '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isRefreshing ? 'not-allowed' : 'pointer',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (!isRefreshing) {
                              (e.target as HTMLButtonElement).style.backgroundColor = '#1976D2';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isRefreshing) {
                              (e.target as HTMLButtonElement).style.backgroundColor = '#2196F3';
                            }
                          }}
                        >
                          {isRefreshing ? 'Refreshing...' : '🔄 Refresh'}
                        </button>
                        {messages.length > 0 && (
                          <>
                            <button 
                              onClick={handleSummarizeMessages}
                              disabled={isSummarizing}
                              style={{
                                padding: '4px 12px',
                                fontSize: '0.85rem',
                                backgroundColor: isSummarizing ? '#666' : '#ff9800',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: isSummarizing ? 'not-allowed' : 'pointer',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                if (!isSummarizing) {
                                  (e.target as HTMLButtonElement).style.backgroundColor = '#f57c00';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSummarizing) {
                                  (e.target as HTMLButtonElement).style.backgroundColor = '#ff9800';
                                }
                              }}
                            >
                              {isSummarizing ? 'Summarizing...' : '📊 Summarize'}
                            </button>
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
                          </>
                        )}
                      </div>
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
                  messages.map(message => {
                    const parsed = parseMessage(message.message);
                    return (
                      <tr key={message.id} className={`data-row message-row-${parsed.type}`}>
                        <td className="time-cell">
                          <div className="time-line">{messagesService.formatTime(message.created_at)}</div>
                          <div className="date-line">{messagesService.formatDate(message.created_at)}</div>
                        </td>
                        <td className={`data-cell message-cell message-${parsed.type}`}>
                          {formatBoldText(parsed.content)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* XP and Level Display */}
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th colSpan={2}>Your Progress</th>
                </tr>
              </thead>
              <tbody>
                {xpLoading ? (
                  <tr>
                    <td colSpan={2} className="loading-cell">
                      Loading progress...
                    </td>
                  </tr>
                ) : xpError ? (
                  <tr>
                    <td colSpan={2} className="error-cell">
                      Error: {xpError}
                    </td>
                  </tr>
                ) : xpData ? (
                  <>
                    <tr className="data-row">
                      <td className="data-cell">Level</td>
                      <td className="data-cell">
                        <span className="stat-value">{xpData.level}</span>
                      </td>
                    </tr>
                    <tr className="data-row">
                      <td className="data-cell">Experience</td>
                      <td className="data-cell">
                        <span className="stat-value">
                          {xpData.xp.toLocaleString()} / {xpData.xpForNextLevel.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                    <tr className="data-row">
                      <td className="data-cell">Progress to Next Level</td>
                      <td className="data-cell">
                        <span className="stat-value">
                          {Math.floor((xpData.xp / xpData.xpForNextLevel) * 100)}%
                        </span>
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan={2} className="empty-cell">
                      No progress data available
                    </td>
                  </tr>
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
                      // Get cooldown from weapon tech data (from useTechCounts)
                      const cooldownPeriod = (weapon && 'cooldown' in weapon ? (weapon as { cooldown: number }).cooldown : 5);
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