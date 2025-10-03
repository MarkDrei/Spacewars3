'use client';

import React from 'react';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { messagesService, UnreadMessage } from '@/lib/client/services/messagesService';
import { useTechCounts } from '@/lib/client/hooks/useTechCounts';
import { useDefenseValues } from '@/lib/client/hooks/useDefenseValues';
import { ServerAuthState } from '@/lib/server/serverSession';
import './HomePage.css';

interface HomePageClientProps {
  auth: ServerAuthState;
  initialMessages: UnreadMessage[];
}

const HomePageClient: React.FC<HomePageClientProps> = ({ auth, initialMessages }) => {
  // Messages are pre-loaded from server - no client-side fetching needed
  const { techCounts, weapons, defenses, isLoading: techLoading, error: techError } = useTechCounts();
  const { defenseValues, isLoading: defenseLoading, error: defenseError } = useDefenseValues();

  return (
    <AuthenticatedLayout>
      <div className="home-page">
        <div className="home-container">
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th colSpan={2}>Notifications</th>
                </tr>
              </thead>
              <tbody>
                {initialMessages.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="empty-cell">
                      No new messages
                    </td>
                  </tr>
                ) : (
                  initialMessages.map(message => (
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
                ) : defenseValues ? (
                  <>
                    {(defenseValues.hull.max > 0) && (
                      <tr className="data-row">
                        <td className="data-cell">{defenseValues.hull.name}</td>
                        <td className="data-cell defense-value-cell">{defenseValues.hull.current}</td>
                        <td className="data-cell defense-value-cell">{defenseValues.hull.max}</td>
                      </tr>
                    )}
                    {(defenseValues.armor.max > 0) && (
                      <tr className="data-row">
                        <td className="data-cell">{defenseValues.armor.name}</td>
                        <td className="data-cell defense-value-cell">{defenseValues.armor.current}</td>
                        <td className="data-cell defense-value-cell">{defenseValues.armor.max}</td>
                      </tr>
                    )}
                    {(defenseValues.shield.max > 0) && (
                      <tr className="data-row">
                        <td className="data-cell">{defenseValues.shield.name}</td>
                        <td className="data-cell defense-value-cell">{defenseValues.shield.current}</td>
                        <td className="data-cell defense-value-cell">{defenseValues.shield.max}</td>
                      </tr>
                    )}
                    {(defenseValues.hull.max === 0 && defenseValues.armor.max === 0 && defenseValues.shield.max === 0) && (
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
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default HomePageClient;