'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import './Leaderboard.css';
import type { BestInData, LeaderboardResponse } from '@/app/api/leaderboard/route';

const RANK_SYMBOL: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
  4: '🏆',
  5: '🏆',
};

interface BestInRow {
  labelKey: string;
  key: keyof BestInData;
}

const BEST_IN_ROWS: BestInRow[] = [
  // ── Player stats ───────────────────────────────────────────────────────────
  { labelKey: 'statBattlesWon', key: 'battlesWon' },
  { labelKey: 'statBattlesLost', key: 'battlesLost' },
  { labelKey: 'statTotalDamageDealt', key: 'totalDamageDealt' },
  { labelKey: 'statTotalDamageReceived', key: 'totalDamageReceived' },
  { labelKey: 'statIronTransferred', key: 'totalIronTransferred' },
  { labelKey: 'statXpFromBattles', key: 'totalXpAwarded' },
  { labelKey: 'statAsteroidsCollected', key: 'asteroidsCollected' },
  { labelKey: 'statShipwrecksCollected', key: 'shipwrecksCollected' },
  { labelKey: 'statEscapePodsCollected', key: 'escapePodsCollected' },
  { labelKey: 'statIronFromCollection', key: 'totalIronFromCollection' },
  { labelKey: 'statIronSpentOnResearch', key: 'totalIronSpentOnResearch' },
  { labelKey: 'statResearchCount', key: 'researchCount' },
  { labelKey: 'statIronSpentOnBuilds', key: 'totalIronSpentOnBuilds' },
  { labelKey: 'statItemsBuilt', key: 'totalBuildsCompleted' },
  // ── Ship / loadout ─────────────────────────────────────────────────────────
  { labelKey: 'statXp', key: 'xp' },
  { labelKey: 'statShipSpeed', key: 'shipSpeed' },
  { labelKey: 'statHullStrength', key: 'hullStrength' },
  { labelKey: 'statShield', key: 'shield' },
  { labelKey: 'statArmor', key: 'armor' },
  // ── Weapons ────────────────────────────────────────────────────────────────
  { labelKey: 'statPulseLaser', key: 'pulseLaser' },
  { labelKey: 'statAutoTurret', key: 'autoTurret' },
  { labelKey: 'statPlasmaLance', key: 'plasmaLance' },
  { labelKey: 'statGaussRifle', key: 'gaussRifle' },
  { labelKey: 'statPhotonTorpedo', key: 'photonTorpedo' },
  { labelKey: 'statRocketLauncher', key: 'rocketLauncher' },
];

const Leaderboard: React.FC = () => {
  const t = useTranslations('statistics');
  const locale = useLocale();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch('/api/leaderboard');
        if (!response.ok) {
          throw new Error(`Failed to fetch leaderboard: ${response.status} ${response.statusText}`);
        }
        setData(await response.json());
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
        setError('Failed to load leaderboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (isLoading) {
    return (
      <div className="leaderboard-panel">
        <h3>{t('leaderboardHeading')}</h3>
        <p className="leaderboard-loading">{t('loadingLeaderboard')}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="leaderboard-panel">
        <h3>{t('leaderboardHeading')}</h3>
        <p className="leaderboard-error">{error ?? t('noLeaderboardData')}</p>
      </div>
    );
  }

  const { leaderboard, bestIn } = data;

  return (
    <div className="leaderboard-panel">

      {/* ── Leaderboard ───────────────────────────────────────────────────── */}
      <section className="leaderboard-section">
        <h3>{t('leaderboardHeading')}</h3>
        {leaderboard.length === 0 ? (
          <p className="leaderboard-empty">{t('noPlayersYet')}</p>
        ) : (
          <div className="leaderboard-list">
            {leaderboard.map((entry) => (
              <div
                key={entry.userId}
                className={[
                  'leaderboard-row',
                  entry.rank <= 3 ? `leaderboard-row--medal leaderboard-row--rank${entry.rank}` : '',
                  entry.rank === 4 || entry.rank === 5 ? 'leaderboard-row--trophy' : '',
                  entry.isCurrentUser ? 'leaderboard-row--me' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="leaderboard-rank">
                  {RANK_SYMBOL[entry.rank] ?? entry.rank}
                </span>
                <span className="leaderboard-username">
                  {entry.username}
                  {entry.isCurrentUser && <span className="leaderboard-you"> {t('youLabel')}</span>}
                </span>
                <span className="leaderboard-score">{entry.score.toLocaleString(locale)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Best In Categories ────────────────────────────────────────────── */}
      <section className="best-in-section">
        <h3>{t('bestInCategoryHeading')}</h3>
        <div className="best-in-list">
          {BEST_IN_ROWS.map(({ labelKey, key }) => {
            const winner = bestIn[key];
            return (
              <div key={key} className="best-in-row">
                <span className="best-in-label">{t(labelKey as Parameters<typeof t>[0])}</span>
                <span className="best-in-winner">
                  {winner ?? <span className="best-in-none">—</span>}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Leaderboard;
