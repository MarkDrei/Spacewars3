'use client';

import React from 'react';
import { useAuth } from '@/lib/client/hooks/useAuth';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import './ProfilePage.css';

const ProfilePage: React.FC = () => {
  const { username } = useAuth();
  
  // Dummy user data - in a real app, this would come from state management or API
  const userStats = {
    username: username || 'SpaceExplorer',
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
            <span className="avatar-text">{userStats.username.charAt(0)}</span>
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
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default ProfilePage;
