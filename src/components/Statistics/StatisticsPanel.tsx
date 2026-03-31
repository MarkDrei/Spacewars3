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
    totals: UserStatAggregates;
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

const RANK_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉', 4: '🏆', 5: '🏆' };

interface StatRowProps {
  label: string;
  userValue: number | string;
  avgValue: number | string;
  totalValue: number | string;
  rank: number | null;
}

function StatRow({ label, userValue, avgValue, totalValue, rank }: StatRowProps) {
  return (
    <div className="stat-row">
      <span className="stat-row-label">{label}</span>
      <span className="stat-row-user">
        {typeof userValue === 'number' ? Math.round(userValue).toLocaleString() : userValue}
        {rank !== null && (
          <span className="top5-badge" title={`Rank #${rank}`}>{RANK_MEDALS[rank]}</span>
        )}
      </span>
      <span className="stat-row-avg">
        {typeof avgValue === 'number' ? Math.round(avgValue).toLocaleString() : avgValue}
      </span>
      <span className="stat-row-total">
        {typeof totalValue === 'number' ? Math.round(totalValue).toLocaleString() : totalValue}
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

  const getRank = (topList: TopEntry[]): number | null => {
    const idx = topList.findIndex((entry) => entry.userId === currentUserId);
    return idx === -1 ? null : idx + 1;
  };

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
        <span className="stats-col-total">Total</span>
      </div>

      {/* ── Combat ── */}
      <div className="stats-category">
        <h4 className="stats-category-title">⚔️ Combat</h4>
        <StatRow
          label="Battles Won"
          userValue={user.battlesWon}
          avgValue={global.averages.battlesWon}
          totalValue={global.totals.battlesWon}
          rank={getRank(global.top5.battlesWon)}
        />
        <StatRow
          label="Battles Lost"
          userValue={user.battlesLost}
          avgValue={global.averages.battlesLost}
          totalValue={global.totals.battlesLost}
          rank={null}
        />
        <StatRow
          label="Total Damage Dealt"
          userValue={user.totalDamageDealt}
          avgValue={global.averages.totalDamageDealt}
          totalValue={global.totals.totalDamageDealt}
          rank={getRank(global.top5.totalDamageDealt)}
        />
        <StatRow
          label="Total Damage Received"
          userValue={user.totalDamageReceived}
          avgValue={global.averages.totalDamageReceived}
          totalValue={global.totals.totalDamageReceived}
          rank={null}
        />
        <StatRow
          label="Iron Transferred (Won)"
          userValue={user.totalIronTransferred}
          avgValue={global.averages.totalIronTransferred}
          totalValue={global.totals.totalIronTransferred}
          rank={getRank(global.top5.totalIronTransferred)}
        />
        <StatRow
          label="XP Awarded from Battles"
          userValue={user.totalXpAwarded}
          avgValue={global.averages.totalXpAwarded}
          totalValue={global.totals.totalXpAwarded}
          rank={null}
        />
      </div>

      {/* ── Collection ── */}
      <div className="stats-category">
        <h4 className="stats-category-title">🪨 Collection</h4>
        <StatRow
          label="Asteroids Collected"
          userValue={user.asteroidsCollected}
          avgValue={global.averages.asteroidsCollected}
          totalValue={global.totals.asteroidsCollected}
          rank={null}
        />
        <StatRow
          label="Shipwrecks Collected"
          userValue={user.shipwrecksCollected}
          avgValue={global.averages.shipwrecksCollected}
          totalValue={global.totals.shipwrecksCollected}
          rank={null}
        />
        <StatRow
          label="Escape Pods Collected"
          userValue={user.escapePodsCollected}
          avgValue={global.averages.escapePodsCollected}
          totalValue={global.totals.escapePodsCollected}
          rank={null}
        />
        <StatRow
          label="Iron from Collection"
          userValue={user.totalIronFromCollection}
          avgValue={global.averages.totalIronFromCollection}
          totalValue={global.totals.totalIronFromCollection}
          rank={getRank(global.top5.totalIronFromCollection)}
        />
      </div>

      {/* ── Economy ── */}
      <div className="stats-category">
        <h4 className="stats-category-title">💰 Economy</h4>
        <StatRow
          label="Iron Spent on Research"
          userValue={user.totalIronSpentOnResearch}
          avgValue={global.averages.totalIronSpentOnResearch}
          totalValue={global.totals.totalIronSpentOnResearch}
          rank={getRank(global.top5.totalIronSpentOnResearch)}
        />
        <StatRow
          label="Research Count"
          userValue={user.researchCount}
          avgValue={global.averages.researchCount}
          totalValue={global.totals.researchCount}
          rank={null}
        />
        <StatRow
          label="Iron Spent on Builds"
          userValue={user.totalIronSpentOnBuilds}
          avgValue={global.averages.totalIronSpentOnBuilds}
          totalValue={global.totals.totalIronSpentOnBuilds}
          rank={null}
        />
        <StatRow
          label="Items Built"
          userValue={user.totalBuildsCompleted}
          avgValue={global.averages.totalBuildsCompleted}
          totalValue={global.totals.totalBuildsCompleted}
          rank={null}
        />
      </div>
    </div>
  );
};

export default StatisticsPanel;
