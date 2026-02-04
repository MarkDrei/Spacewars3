'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { ServerAuthState } from '@/lib/server/serverSession';
import { useAuth } from '@/lib/client/hooks/useAuth';
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
  const router = useRouter();
  const { logout } = useAuth();
  const [battles, setBattles] = useState<BattleHistoryItem[]>([]);
  const [isLoadingBattles, setIsLoadingBattles] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Handle logout
  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    router.push('/'); // Redirect to login page
  };
  
  // Fetch battle history on component mount
  useEffect(() => {
    const fetchBattles = async () => {
      try {
        const response = await fetch('/api/user-battles');
        if (response.ok) {
          const data = await response.json();
          setBattles(data.battles || []);
        }
      } catch (error) {
        console.error('Failed to fetch battle history:', error);
      } finally {
        setIsLoadingBattles(false);
      }
    };
    
    fetchBattles();
  }, []);

  return (
    <AuthenticatedLayout>
      <div className="profile-page">
        <div className="profile-container">
          <h1 className="page-heading">Player Profile</h1>
        
          <div className="profile-header">
            <h2>{auth.username}</h2>
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

        {/* Logout Section */}
        <div className="logout-section">
          <button 
            className="logout-button" 
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default ProfilePageClient;
