'use client';

import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { useAuth } from '@/lib/client/hooks/useAuth';
import { messagesService, UnreadMessage } from '@/lib/client/services/messagesService';
import { useTechCounts } from '@/lib/client/hooks/useTechCounts';
import './HomePage.css';

const HomePage: React.FC = () => {
  const [messages, setMessages] = useState<UnreadMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  const { techCounts, weapons, defenses, isLoading: techLoading, error: techError } = useTechCounts(isLoggedIn);

  // Fetch messages on component mount, but only after authentication is confirmed
  useEffect(() => {
    // Don't fetch if still checking auth or not logged in
    if (authLoading || !isLoggedIn) {
      return;
    }

    const fetchMessages = async () => {
      try {
        setError(null);
        setIsLoading(true);
        
        console.log('🏠 Home page loading, user authenticated, fetching messages...');
        const result = await messagesService.getMessages();
        
        console.log('📋 Messages service result:', result);
        
        if ('error' in result) {
          console.error('❌ Messages service returned error:', result.error);
          setError(result.error);
          setMessages([]);
        } else {
          console.log(`✅ Loaded ${result.messages.length} message(s) on home page`);
          setMessages(result.messages);
        }
        
      } catch (err) {
        console.error('❌ Error fetching messages:', err);
        setError('Failed to load messages');
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [isLoggedIn, authLoading]);

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
                {authLoading ? (
                  <tr>
                    <td colSpan={2} className="loading-cell">
                      Checking authentication...
                    </td>
                  </tr>
                ) : !isLoggedIn ? (
                  <tr>
                    <td colSpan={2} className="error-cell">
                      Not authenticated
                    </td>
                  </tr>
                ) : isLoading ? (
                  <tr>
                    <td colSpan={2} className="loading-cell">
                      Loading messages...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={2} className="error-cell">
                      Error: {error}
                    </td>
                  </tr>
                ) : messages.length === 0 ? (
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

          {/* Tech Counts Table */}
          {isLoggedIn && (
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
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default HomePage;