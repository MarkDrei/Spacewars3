'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { messagesService, UnreadMessage } from '@/lib/client/services/messagesService';
import { useTechCounts } from '@/lib/client/hooks/useTechCounts';
import { useDefenseValues } from '@/lib/client/hooks/useDefenseValues';
import { useBattleStatus } from '@/lib/client/hooks/useBattleStatus';
import { useUserStats } from '@/lib/client/hooks/useUserStats';
import { ServerAuthState } from '@/lib/server/serverSession';
import { formatNumber } from '@/shared/numberFormat';
import './HomePage.css';
import { OrbitalCommandHub } from './OrbitalCommandHub';

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
  // First split by newlines and map to fragments with <br />
  const lines = text.split('\n');
  return lines.map((line, lineIndex) => {
    // Then process bold text for each line
    const parts = line.split(/(\*\*.*?\*\*)/g);
    const formattedLine = parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return <React.Fragment key={index}>{part}</React.Fragment>;
    });

    return (
      <React.Fragment key={lineIndex}>
        {formattedLine}
        {lineIndex < lines.length - 1 && <br />}
      </React.Fragment>
    );
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
  const [isMessagesExpanded, setIsMessagesExpanded] = React.useState(false);
  const t = useTranslations('home');

  const { techCounts, weapons, defenses, isLoading: techLoading, error: techError } = useTechCounts();
  const { defenseValues, isLoading: defenseLoading, error: defenseError, shipPictureId } = useDefenseValues();
  const { battleStatus } = useBattleStatus();
  const { xp, level, xpForNextLevel, score, isLoading: xpLoading, bonuses } = useUserStats(5000);

  // Handler for refreshing messages
  const handleRefreshMessages = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      const result = await messagesService.getMessages();
      if (result.success) {
        // Sort messages by created_at descending (newest first)
        setMessages([...result.messages].sort((a, b) => b.created_at - a.created_at));
        setIsMessagesExpanded(false); // Reset to collapsed view
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
        setIsMessagesExpanded(false); // Reset to collapsed view
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


  return (
    <AuthenticatedLayout>
      <div className="home-page">
        <div className="home-container">
          {/* Ship Status / Battle Hub */}
          <OrbitalCommandHub
            defenseValues={displayDefenseValues}
            battleStatus={battleStatus}
            techCounts={techCounts}
            weapons={weapons}
            shipPictureId={shipPictureId}
          />

          {/* Notifications */}
          <div id="notifications" className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th colSpan={2}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{t('notificationsHeading')}</span>
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
                          {isRefreshing ? t('refreshingButton') : t('refreshButton')}
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
                              {isSummarizing ? t('summarizingButton') : t('summarizeButton')}
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
                              {isMarkingAsRead ? t('markingButton') : t('markAllAsReadButton')}
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
                      {t('noNewMessages')}
                    </td>
                  </tr>
                ) : (
                  <>
                    {(isMessagesExpanded ? messages : messages.slice(0, 10)).map(message => {
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
                    })}
                    {messages.length > 10 && (
                      <tr>
                        <td colSpan={2} style={{ textAlign: 'center', padding: '8px', cursor: 'pointer', userSelect: 'none' }}>
                          <button
                            onClick={() => setIsMessagesExpanded(!isMessagesExpanded)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#2196F3',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              padding: '4px 8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              margin: '0 auto',
                              transition: 'color 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              (e.target as HTMLButtonElement).style.color = '#1976D2';
                            }}
                            onMouseLeave={(e) => {
                              (e.target as HTMLButtonElement).style.color = '#2196F3';
                            }}
                          >
                            <span style={{
                              transform: isMessagesExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s',
                              display: 'inline-block'
                            }}>
                              ▼
                            </span>
                            {isMessagesExpanded ? t('showFewer', { count: messages.length - 10 }) : t('showMore', { count: messages.length - 10 })}
                          </button>
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* XP and Level Progress */}
          <div id="progress" className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th colSpan={2}>{t('yourProgressHeading')}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="data-row">
                  <td className="data-cell">{t('score')}</td>
                  <td className="data-cell value-cell">{xpLoading ? '...' : formatNumber(score)}</td>
                </tr>
                <tr className="data-row">
                  <td className="data-cell">{t('level')}</td>
                  <td className="data-cell value-cell">{xpLoading ? '...' : level}</td>
                </tr>
                <tr className="data-row">
                  <td className="data-cell">{t('experience')}</td>
                  <td className="data-cell value-cell">
                    {xpLoading ? '...' : `${formatNumber(xp)} / ${formatNumber(xpForNextLevel)}`}
                  </td>
                </tr>
                <tr className="data-row">
                  <td className="data-cell">{t('levelBonus')}</td>
                  <td className="data-cell value-cell">
                    {xpLoading ? '...' : `+${formatNumber((bonuses.levelMultiplier - 1) * 100)}%`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Active Bonuses */}
          <div id="bonuses" className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th colSpan={2}>{t('activeBonusesHeading')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={2} className="category-header">{t('ironEconomyCategory')}</td>
                </tr>
                <tr className="data-row">
                  <td className="data-cell">{t('ironRechargeRate')}</td>
                  <td className="data-cell value-cell">
                    {xpLoading ? '...' : `${formatNumber(bonuses.ironRechargeRate)} /s`}
                  </td>
                </tr>
                <tr className="data-row">
                  <td className="data-cell">{t('ironStorage')}</td>
                  <td className="data-cell value-cell">
                    {xpLoading ? '...' : formatNumber(bonuses.ironStorageCapacity)}
                  </td>
                </tr>
                <tr className="data-row">
                  <td className="data-cell">{t('maxShipSpeedTheoretical')}</td>
                  <td className="data-cell value-cell">
                    {xpLoading ? '...' : formatNumber(bonuses.maxShipSpeed)}
                  </td>
                </tr>
                <tr className="data-row">
                  <td className="data-cell">{t('maxShipSpeedCurrent')}</td>
                  <td className="data-cell value-cell">
                    {xpLoading ? '...' : formatNumber(bonuses.currentMaxShipSpeed)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="category-header">{t('defenseRegenCategory')}</td>
                </tr>
                <tr className="data-row">
                  <td className="data-cell">{t('repairHullArmor')}</td>
                  <td className="data-cell value-cell">{xpLoading ? '...' : formatNumber(bonuses.repairRate)}</td>
                </tr>
                <tr className="data-row">
                  <td className="data-cell">{t('shieldRecharge')}</td>
                  <td className="data-cell value-cell">{xpLoading ? '...' : formatNumber(bonuses.shieldRechargeRate)}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="category-header">{t('projectileWeaponsCategory')}</td>
                </tr>
                <tr className="data-row">
                  <td className="data-cell">{t('damage')}</td>
                  <td className="data-cell value-cell">{xpLoading ? '...' : `+${formatNumber((bonuses.projectileWeaponDamageFactor - 1) * 100)}%`}</td>
                </tr>
                <tr className="data-row">
                  <td className="data-cell">{t('reloadSpeed')}</td>
                  <td className="data-cell value-cell">{xpLoading ? '...' : `+${formatNumber((bonuses.projectileWeaponReloadFactor - 1) * 100)}%`}</td>
                </tr>
                <tr className="data-row">
                  <td className="data-cell">{t('accuracy')}</td>
                  <td className="data-cell value-cell">{xpLoading ? '...' : `+${formatNumber((bonuses.projectileWeaponAccuracyFactor - 1) * 100)}%`}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="category-header">{t('energyWeaponsCategory')}</td>
                </tr>
                <tr className="data-row">
                  <td className="data-cell">{t('damage')}</td>
                  <td className="data-cell value-cell">{xpLoading ? '...' : `+${formatNumber((bonuses.energyWeaponDamageFactor - 1) * 100)}%`}</td>
                </tr>
                <tr className="data-row">
                  <td className="data-cell">{t('reloadSpeed')}</td>
                  <td className="data-cell value-cell">{xpLoading ? '...' : `+${formatNumber((bonuses.energyWeaponReloadFactor - 1) * 100)}%`}</td>
                </tr>
                <tr className="data-row">
                  <td className="data-cell">{t('accuracy')}</td>
                  <td className="data-cell value-cell">{xpLoading ? '...' : `+${formatNumber((bonuses.energyWeaponAccuracyFactor - 1) * 100)}%`}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="category-header">{t('productionSpeedCategory')}</td>
                </tr>
                <tr className="data-row">
                  <td className="data-cell">{t('constructionSpeed')}</td>
                  <td className="data-cell value-cell">{xpLoading ? '...' : `+${formatNumber((bonuses.constructionSpeedFactor - 1) * 100)}%`}</td>
                </tr>
                <tr className="data-row">
                  <td className="data-cell">{t('researchSpeed')}</td>
                  <td className="data-cell value-cell">{xpLoading ? '...' : `+${formatNumber((bonuses.researchSpeedFactor - 1) * 100)}%`}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Defense Values Table */}
          <div id="defense" className="data-table-container defense-values-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th colSpan={3}>{t('defenseValuesHeading')}</th>
                </tr>
              </thead>
              <tbody>
                {defenseLoading ? (
                  <tr>
                    <td colSpan={3} className="loading-cell">
                      {t('loadingDefenseValues')}
                    </td>
                  </tr>
                ) : defenseError ? (
                  <tr>
                    <td colSpan={3} className="error-cell">
                      {t('errorDefenseValues', { error: defenseError })}
                    </td>
                  </tr>
                ) : displayDefenseValues ? (
                  <>
                    {(displayDefenseValues.hull.max > 0) && (
                      <tr className="data-row">
                        <td className="data-cell">{displayDefenseValues.hull.name}</td>
                        <td className="data-cell value-cell" style={{ color: getDefenseColor(displayDefenseValues.hull.current, displayDefenseValues.hull.max) }}>
                          {formatNumber(displayDefenseValues.hull.current)}
                        </td>
                        <td className="data-cell value-cell">{formatNumber(displayDefenseValues.hull.max)}</td>
                      </tr>
                    )}
                    {(displayDefenseValues.armor.max > 0) && (
                      <tr className="data-row">
                        <td className="data-cell">{displayDefenseValues.armor.name}</td>
                        <td className="data-cell value-cell" style={{ color: getDefenseColor(displayDefenseValues.armor.current, displayDefenseValues.armor.max) }}>
                          {formatNumber(displayDefenseValues.armor.current)}
                        </td>
                        <td className="data-cell value-cell">{formatNumber(displayDefenseValues.armor.max)}</td>
                      </tr>
                    )}
                    {(displayDefenseValues.shield.max > 0) && (
                      <tr className="data-row">
                        <td className="data-cell">{displayDefenseValues.shield.name}</td>
                        <td className="data-cell value-cell" style={{ color: getDefenseColor(displayDefenseValues.shield.current, displayDefenseValues.shield.max) }}>
                          {formatNumber(displayDefenseValues.shield.current)}
                        </td>
                        <td className="data-cell value-cell">{formatNumber(displayDefenseValues.shield.max)}</td>
                      </tr>
                    )}
                    {(displayDefenseValues.hull.max === 0 && displayDefenseValues.armor.max === 0 && displayDefenseValues.shield.max === 0) && (
                      <tr>
                        <td colSpan={3} className="empty-cell">
                          {t('noDefenseSystems')}
                        </td>
                      </tr>
                    )}
                  </>
                ) : (
                  <tr>
                    <td colSpan={3} className="empty-cell">
                      {t('noDefenseData')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Tech Counts Table */}
          <div id="tech-inventory" className="data-table-container tech-counts-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th colSpan={2}>{t('techInventoryHeading')}</th>
                </tr>
              </thead>
              <tbody>
                {techLoading ? (
                  <tr>
                    <td colSpan={2} className="loading-cell">
                      {t('loadingTechCounts')}
                    </td>
                  </tr>
                ) : techError ? (
                  <tr>
                    <td colSpan={2} className="error-cell">
                      {t('errorTechCounts', { error: techError })}
                    </td>
                  </tr>
                ) : techCounts ? (
                  <>
                    {/* Defense Section */}
                    {(techCounts.ship_hull > 0 || techCounts.kinetic_armor > 0 || techCounts.energy_shield > 0 || techCounts.missile_jammer > 0) && (
                      <>
                        <tr>
                          <td colSpan={2} className="category-header">{t('defenseCategory')}</td>
                        </tr>
                        {techCounts.ship_hull > 0 && (
                          <tr className="data-row">
                            <td className="data-cell">{defenses.ship_hull?.name || 'Ship Hull'}</td>
                            <td className="data-cell value-cell">{techCounts.ship_hull}</td>
                          </tr>
                        )}
                        {techCounts.kinetic_armor > 0 && (
                          <tr className="data-row">
                            <td className="data-cell">{defenses.kinetic_armor?.name || 'Kinetic Armor'}</td>
                            <td className="data-cell value-cell">{techCounts.kinetic_armor}</td>
                          </tr>
                        )}
                        {techCounts.energy_shield > 0 && (
                          <tr className="data-row">
                            <td className="data-cell">{defenses.energy_shield?.name || 'Energy Shield'}</td>
                            <td className="data-cell value-cell">{techCounts.energy_shield}</td>
                          </tr>
                        )}
                        {techCounts.missile_jammer > 0 && (
                          <tr className="data-row">
                            <td className="data-cell">{defenses.missile_jammer?.name || 'Missile Jammer'}</td>
                            <td className="data-cell value-cell">{techCounts.missile_jammer}</td>
                          </tr>
                        )}
                      </>
                    )}

                    {/* Weapons Section */}
                    {(techCounts.pulse_laser > 0 || techCounts.auto_turret > 0 || techCounts.plasma_lance > 0 || techCounts.gauss_rifle > 0 || techCounts.photon_torpedo > 0 || techCounts.rocket_launcher > 0) && (
                      <>
                        <tr>
                          <td colSpan={2} className="category-header">{t('weaponsCategory')}</td>
                        </tr>
                        {techCounts.pulse_laser > 0 && (
                          <tr className="data-row">
                            <td className="data-cell">{weapons.pulse_laser?.name || 'Pulse Laser'}</td>
                            <td className="data-cell value-cell">{techCounts.pulse_laser}</td>
                          </tr>
                        )}
                        {techCounts.auto_turret > 0 && (
                          <tr className="data-row">
                            <td className="data-cell">{weapons.auto_turret?.name || 'Auto Turret'}</td>
                            <td className="data-cell value-cell">{techCounts.auto_turret}</td>
                          </tr>
                        )}
                        {techCounts.plasma_lance > 0 && (
                          <tr className="data-row">
                            <td className="data-cell">{weapons.plasma_lance?.name || 'Plasma Lance'}</td>
                            <td className="data-cell value-cell">{techCounts.plasma_lance}</td>
                          </tr>
                        )}
                        {techCounts.gauss_rifle > 0 && (
                          <tr className="data-row">
                            <td className="data-cell">{weapons.gauss_rifle?.name || 'Gauss Rifle'}</td>
                            <td className="data-cell value-cell">{techCounts.gauss_rifle}</td>
                          </tr>
                        )}
                        {techCounts.photon_torpedo > 0 && (
                          <tr className="data-row">
                            <td className="data-cell">{weapons.photon_torpedo?.name || 'Photon Torpedo'}</td>
                            <td className="data-cell value-cell">{techCounts.photon_torpedo}</td>
                          </tr>
                        )}
                        {techCounts.rocket_launcher > 0 && (
                          <tr className="data-row">
                            <td className="data-cell">{weapons.rocket_launcher?.name || 'Rocket Launcher'}</td>
                            <td className="data-cell value-cell">{techCounts.rocket_launcher}</td>
                          </tr>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <tr>
                    <td colSpan={2} className="empty-cell">
                      {t('noTechData')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default HomePageClient;
