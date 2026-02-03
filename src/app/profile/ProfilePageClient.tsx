'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { ServerAuthState } from '@/lib/server/serverSession';
import './ProfilePage.css';

interface ProfilePageClientProps {
  auth: ServerAuthState;
}

interface BattleHistoryItem {
  id: number;
  opponentUsername: string;
  isAttacker: boolean;
  didWin: boolean;
  userDamage: number;
  opponentDamage: number;
  duration: number;
  battleStartTime: number;
  battleEndTime: number | null;
}

const ProfilePageClient: React.FC<ProfilePageClientProps> = ({ auth }) => {
  const [battles, setBattles] = useState<BattleHistoryItem[]>([]);
  const [isLoadingBattles, setIsLoadingBattles] = useState(true);
  const [shipPicture, setShipPicture] = useState<number>(1);
  
  // Fetch battle history and ship picture on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch battles
        const battlesResponse = await fetch('/api/user-battles');
        if (battlesResponse.ok) {
          const data = await battlesResponse.json();
          setBattles(data.battles || []);
        }
        
        // Fetch ship picture
        const shipPictureResponse = await fetch('/api/ship-picture');
        if (shipPictureResponse.ok) {
          const data = await shipPictureResponse.json();
          setShipPicture(data.shipPicture);
        }
      } catch (error) {
        console.error('Failed to fetch profile data:', error);
      } finally {
        setIsLoadingBattles(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Dummy user data - in a real app, this would come from state management or API
  const userStats = {
    username: auth.username,
    level: 12,
    totalScore: 15420,
    gamesPlayed: 47,
    shipwrecksCollected: 156,
    escapePodsRescued: 23,
    totalDistance: 892.5,
    averageScore: 328,
    bestScore: 1250,
    playtime: '24h 35m'
  };

  return (
    <AuthenticatedLayout>
      <div className="profile-page">
        <div className="profile-container">
          <h1 className="page-heading">Player Profile</h1>
        
        <div className="profile-header">
          <div className="avatar">
            <Image
              src={`/assets/images/ship${shipPicture}.png`}
              alt={`Ship ${shipPicture}`}
              width={120}
              height={120}
              style={{ objectFit: 'contain' }}
              unoptimized
            />
          </div>
          <div className="player-info">
            <h2>{userStats.username}</h2>
            <p className="level">Level {userStats.level}</p>
            <p className="total-score">Total Score: {userStats.totalScore.toLocaleString()}</p>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <h3>Games Played</h3>
            <p className="stat-value">{userStats.gamesPlayed}</p>
          </div>
          
          <div className="stat-card">
            <h3>Shipwrecks Collected</h3>
            <p className="stat-value">{userStats.shipwrecksCollected}</p>
          </div>
          
          <div className="stat-card">
            <h3>Escape Pods Rescued</h3>
            <p className="stat-value">{userStats.escapePodsRescued}</p>
          </div>
          
          <div className="stat-card">
            <h3>Total Distance</h3>
            <p className="stat-value">{userStats.totalDistance} km</p>
          </div>
          
          <div className="stat-card">
            <h3>Average Score</h3>
            <p className="stat-value">{userStats.averageScore}</p>
          </div>
          
          <div className="stat-card">
            <h3>Best Score</h3>
            <p className="stat-value">{userStats.bestScore}</p>
          </div>
        </div>

        <div className="achievements">
          <h3>Recent Achievements</h3>
          <div className="achievement-list">
            <div className="achievement">
              <span className="achievement-icon">🏆</span>
              <div className="achievement-info">
                <h4>Space Veteran</h4>
                <p>Played 50 games</p>
              </div>
            </div>
            <div className="achievement">
              <span className="achievement-icon">🚀</span>
              <div className="achievement-info">
                <h4>Long Distance Explorer</h4>
                <p>Traveled over 800 km</p>
              </div>
            </div>
            <div className="achievement">
              <span className="achievement-icon">⭐</span>
              <div className="achievement-info">
                <h4>Score Master</h4>
                <p>Achieved score over 1000</p>
              </div>
            </div>
          </div>
        </div>

        <div className="playtime-info">
          <h3>Playtime Statistics</h3>
          <p>Total time in space: <strong>{userStats.playtime}</strong></p>
        </div>

        {/* Battle History Section */}
        <div className="battle-history">
          <h3>Battle History</h3>
          {isLoadingBattles ? (
            <p className="loading-message">Loading battle history...</p>
          ) : battles.length === 0 ? (
            <p className="no-battles-message">No battles yet. Start your first battle!</p>
          ) : (
            <div className="battle-list">
              {battles.map((battle) => (
                <div 
                  key={battle.id} 
                  className={`battle-card ${battle.didWin ? 'victory' : 'defeat'}`}
                >
                  <div className="battle-header">
                    <span className={`battle-result ${battle.didWin ? 'win' : 'loss'}`}>
                      {battle.didWin ? '✓ Victory' : '✗ Defeat'}
                    </span>
                    <span className="battle-role">
                      {battle.isAttacker ? 'Attacker' : 'Defender'}
                    </span>
                  </div>
                  <div className="battle-details">
                    <div className="battle-opponent">
                      <strong>Opponent:</strong> {battle.opponentUsername}
                    </div>
                    <div className="battle-stats">
                      <div className="stat-item">
                        <span className="stat-label">Your Damage:</span>
                        <span className="stat-value">{Math.round(battle.userDamage)}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Opponent Damage:</span>
                        <span className="stat-value">{Math.round(battle.opponentDamage)}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Duration:</span>
                        <span className="stat-value">{battle.duration}s</span>
                      </div>
                    </div>
                    <div className="battle-time">
                      {new Date(battle.battleStartTime * 1000).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default ProfilePageClient;
