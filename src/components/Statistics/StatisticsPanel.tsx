'use client';

import React, { useState, useEffect } from 'react';
import './StatisticsPanel.css';

interface UserStatAggregates {
  battlesWon: number;
  battlesLost: number;
  totalDamageDealt: number;
  totalDamageReceived: number;
  totalIronTransferred: number;
  totalXpAwarded: number;
  totalBattleDurationSec: number;
  asteroidsCollected: number;
  shipwrecksCollected: number;
  escapePodsCollected: number;
  totalIronFromCollection: number;
  totalIronSpentOnResearch: number;
  researchCount: number;
  totalIronSpentOnBuilds: number;
  totalBuildsCompleted: number;
}

interface TopEntry {
  userId: number;
  username: string;
  value: number;
}

interface StatisticsResponse {
  user: UserStatAggregates;
  global: {
    totalPlayers: number;
    averages: UserStatAggregates;
    top5: {
      battlesWon: TopEntry[];
      totalDamageDealt: TopEntry[];
      totalIronTransferred: TopEntry[];
      totalIronFromCollection: TopEntry[];
      totalIronSpentOnResearch: TopEntry[];
    };
  };
  currentUserId: number;
}

interface StatRowProps {
  label: string;
  userValue: number | string;
  avgValue: number | string;
  isInTop5: boolean;
  formatValue?: (v: number) => string;
}

function StatRow({ label, userValue, avgValue, isInTop5 }: StatRowProps) {
  return (
    <div className="stat-row">
      <span className="stat-row-label">{label}</span>
      <span className="stat-row-user">
        {typeof userValue === 'number' ? Math.round(userValue).toLocaleString() : userValue}
        {isInTop5 && <span className="top5-badge" title="Top 5">🏆</span>}
      </span>
      <span className="stat-row-avg">
        {typeof avgValue === 'number' ? Math.round(avgValue).toLocaleString() : avgValue}
      </span>
    </div>
  );
}

const StatisticsPanel: React.FC = () => {
  const [stats, setStats] = useState<StatisticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/statistics');
        if (!response.ok) {
          throw new Error(`Failed to fetch statistics: ${response.status}`);
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error('Failed to fetch statistics:', err);
        setError('Failed to load statistics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="statistics-panel">
        <h3>Player Statistics</h3>
        <p className="stats-loading">Loading statistics...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="statistics-panel">
        <h3>Player Statistics</h3>
        <p className="stats-error">{error ?? 'No statistics available'}</p>
      </div>
    );
  }

  const { user, global, currentUserId } = stats;

  const isInTop5 = (topList: TopEntry[]): boolean =>
    topList.some((entry) => entry.userId === currentUserId);

  return (
    <div className="statistics-panel">
      <h3>Player Statistics</h3>
      <p className="stats-global-info">
        {global.totalPlayers} player{global.totalPlayers !== 1 ? 's' : ''} tracked
      </p>

      <div className="stats-header-row">
        <span className="stats-col-label">Stat</span>
        <span className="stats-col-you">You</span>
        <span className="stats-col-avg">Avg/Player</span>
      </div>

      {/* ── Combat ── */}
      <div className="stats-category">
        <h4 className="stats-category-title">⚔️ Combat</h4>
        <StatRow
          label="Battles Won"
          userValue={user.battlesWon}
          avgValue={global.averages.battlesWon}
          isInTop5={isInTop5(global.top5.battlesWon)}
        />
        <StatRow
          label="Battles Lost"
          userValue={user.battlesLost}
          avgValue={global.averages.battlesLost}
          isInTop5={false}
        />
        <StatRow
          label="Total Damage Dealt"
          userValue={user.totalDamageDealt}
          avgValue={global.averages.totalDamageDealt}
          isInTop5={isInTop5(global.top5.totalDamageDealt)}
        />
        <StatRow
          label="Total Damage Received"
          userValue={user.totalDamageReceived}
          avgValue={global.averages.totalDamageReceived}
          isInTop5={false}
        />
        <StatRow
          label="Iron Transferred (Won)"
          userValue={user.totalIronTransferred}
          avgValue={global.averages.totalIronTransferred}
          isInTop5={isInTop5(global.top5.totalIronTransferred)}
        />
        <StatRow
          label="XP Awarded from Battles"
          userValue={user.totalXpAwarded}
          avgValue={global.averages.totalXpAwarded}
          isInTop5={false}
        />
      </div>

      {/* ── Collection ── */}
      <div className="stats-category">
        <h4 className="stats-category-title">🪨 Collection</h4>
        <StatRow
          label="Asteroids Collected"
          userValue={user.asteroidsCollected}
          avgValue={global.averages.asteroidsCollected}
          isInTop5={false}
        />
        <StatRow
          label="Shipwrecks Collected"
          userValue={user.shipwrecksCollected}
          avgValue={global.averages.shipwrecksCollected}
          isInTop5={false}
        />
        <StatRow
          label="Escape Pods Collected"
          userValue={user.escapePodsCollected}
          avgValue={global.averages.escapePodsCollected}
          isInTop5={false}
        />
        <StatRow
          label="Iron from Collection"
          userValue={user.totalIronFromCollection}
          avgValue={global.averages.totalIronFromCollection}
          isInTop5={isInTop5(global.top5.totalIronFromCollection)}
        />
      </div>

      {/* ── Economy ── */}
      <div className="stats-category">
        <h4 className="stats-category-title">💰 Economy</h4>
        <StatRow
          label="Iron Spent on Research"
          userValue={user.totalIronSpentOnResearch}
          avgValue={global.averages.totalIronSpentOnResearch}
          isInTop5={isInTop5(global.top5.totalIronSpentOnResearch)}
        />
        <StatRow
          label="Research Count"
          userValue={user.researchCount}
          avgValue={global.averages.researchCount}
          isInTop5={false}
        />
        <StatRow
          label="Iron Spent on Builds"
          userValue={user.totalIronSpentOnBuilds}
          avgValue={global.averages.totalIronSpentOnBuilds}
          isInTop5={false}
        />
        <StatRow
          label="Items Built"
          userValue={user.totalBuildsCompleted}
          avgValue={global.averages.totalBuildsCompleted}
          isInTop5={false}
        />
      </div>
    </div>
  );
};

export default StatisticsPanel;
