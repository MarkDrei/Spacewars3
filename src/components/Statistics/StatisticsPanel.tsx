'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
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
      // Combat
      battlesWon: TopEntry[];
      battlesLost: TopEntry[];
      totalDamageDealt: TopEntry[];
      totalDamageReceived: TopEntry[];
      totalIronTransferred: TopEntry[];
      totalXpAwarded: TopEntry[];
      // Collection
      asteroidsCollected: TopEntry[];
      shipwrecksCollected: TopEntry[];
      escapePodsCollected: TopEntry[];
      totalIronFromCollection: TopEntry[];
      // Economy
      totalIronSpentOnResearch: TopEntry[];
      researchCount: TopEntry[];
      totalIronSpentOnBuilds: TopEntry[];
      totalBuildsCompleted: TopEntry[];
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
  const t = useTranslations('statistics');
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
        <h3>{t('playerStatsHeading')}</h3>
        <p className="stats-loading">{t('loadingStats')}</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="statistics-panel">
        <h3>{t('playerStatsHeading')}</h3>
        <p className="stats-error">{error ?? t('noStatsAvailable')}</p>
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
      <h3>{t('playerStatsHeading')}</h3>
      <p className="stats-global-info">
        {global.totalPlayers} player{global.totalPlayers !== 1 ? 's' : ''} tracked
      </p>

      <div className="stats-header-row">
        <span className="stats-col-label">{t('colStat')}</span>
        <span className="stats-col-you">{t('colYou')}</span>
        <span className="stats-col-avg">{t('colAvgPerPlayer')}</span>
        <span className="stats-col-total">{t('colTotal')}</span>
      </div>

      {/* ── Combat ── */}
      <div className="stats-category">
        <h4 className="stats-category-title">{t('combatCategory')}</h4>
        <StatRow
          label={t('statBattlesWon')}
          userValue={user.battlesWon}
          avgValue={global.averages.battlesWon}
          totalValue={global.totals.battlesWon}
          rank={getRank(global.top5.battlesWon)}
        />
        <StatRow
          label={t('statBattlesLost')}
          userValue={user.battlesLost}
          avgValue={global.averages.battlesLost}
          totalValue={global.totals.battlesLost}
          rank={getRank(global.top5.battlesLost)}
        />
        <StatRow
          label={t('statTotalDamageDealt')}
          userValue={user.totalDamageDealt}
          avgValue={global.averages.totalDamageDealt}
          totalValue={global.totals.totalDamageDealt}
          rank={getRank(global.top5.totalDamageDealt)}
        />
        <StatRow
          label={t('statTotalDamageReceived')}
          userValue={user.totalDamageReceived}
          avgValue={global.averages.totalDamageReceived}
          totalValue={global.totals.totalDamageReceived}
          rank={getRank(global.top5.totalDamageReceived)}
        />
        <StatRow
          label={t('statIronTransferred')}
          userValue={user.totalIronTransferred}
          avgValue={global.averages.totalIronTransferred}
          totalValue={global.totals.totalIronTransferred}
          rank={getRank(global.top5.totalIronTransferred)}
        />
        <StatRow
          label={t('statXpFromBattles')}
          userValue={user.totalXpAwarded}
          avgValue={global.averages.totalXpAwarded}
          totalValue={global.totals.totalXpAwarded}
          rank={getRank(global.top5.totalXpAwarded)}
        />
      </div>

      {/* ── Collection ── */}
      <div className="stats-category">
        <h4 className="stats-category-title">{t('collectionCategory')}</h4>
        <StatRow
          label={t('statAsteroidsCollected')}
          userValue={user.asteroidsCollected}
          avgValue={global.averages.asteroidsCollected}
          totalValue={global.totals.asteroidsCollected}
          rank={getRank(global.top5.asteroidsCollected)}
        />
        <StatRow
          label={t('statShipwrecksCollected')}
          userValue={user.shipwrecksCollected}
          avgValue={global.averages.shipwrecksCollected}
          totalValue={global.totals.shipwrecksCollected}
          rank={getRank(global.top5.shipwrecksCollected)}
        />
        <StatRow
          label={t('statEscapePodsCollected')}
          userValue={user.escapePodsCollected}
          avgValue={global.averages.escapePodsCollected}
          totalValue={global.totals.escapePodsCollected}
          rank={getRank(global.top5.escapePodsCollected)}
        />
        <StatRow
          label={t('statIronFromCollection')}
          userValue={user.totalIronFromCollection}
          avgValue={global.averages.totalIronFromCollection}
          totalValue={global.totals.totalIronFromCollection}
          rank={getRank(global.top5.totalIronFromCollection)}
        />
      </div>

      {/* ── Economy ── */}
      <div className="stats-category">
        <h4 className="stats-category-title">{t('economyCategory')}</h4>
        <StatRow
          label={t('statIronSpentOnResearch')}
          userValue={user.totalIronSpentOnResearch}
          avgValue={global.averages.totalIronSpentOnResearch}
          totalValue={global.totals.totalIronSpentOnResearch}
          rank={getRank(global.top5.totalIronSpentOnResearch)}
        />
        <StatRow
          label={t('statResearchCount')}
          userValue={user.researchCount}
          avgValue={global.averages.researchCount}
          totalValue={global.totals.researchCount}
          rank={getRank(global.top5.researchCount)}
        />
        <StatRow
          label={t('statIronSpentOnBuilds')}
          userValue={user.totalIronSpentOnBuilds}
          avgValue={global.averages.totalIronSpentOnBuilds}
          totalValue={global.totals.totalIronSpentOnBuilds}
          rank={getRank(global.top5.totalIronSpentOnBuilds)}
        />
        <StatRow
          label={t('statItemsBuilt')}
          userValue={user.totalBuildsCompleted}
          avgValue={global.averages.totalBuildsCompleted}
          totalValue={global.totals.totalBuildsCompleted}
          rank={getRank(global.top5.totalBuildsCompleted)}
        />
      </div>
    </div>
  );
};

export default StatisticsPanel;
