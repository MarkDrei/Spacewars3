'use client';

import React, { useState, useEffect } from 'react';
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
  label: string;
  key: keyof BestInData;
}

const BEST_IN_ROWS: BestInRow[] = [
  // ── Player stats ───────────────────────────────────────────────────────────
  { label: 'Battles Won', key: 'battlesWon' },
  { label: 'Battles Lost', key: 'battlesLost' },
  { label: 'Total Damage Dealt', key: 'totalDamageDealt' },
  { label: 'Total Damage Received', key: 'totalDamageReceived' },
  { label: 'Iron Transferred (Won)', key: 'totalIronTransferred' },
  { label: 'XP Awarded from Battles', key: 'totalXpAwarded' },
  { label: 'Asteroids Collected', key: 'asteroidsCollected' },
  { label: 'Shipwrecks Collected', key: 'shipwrecksCollected' },
  { label: 'Escape Pods Collected', key: 'escapePodsCollected' },
  { label: 'Iron from Collection', key: 'totalIronFromCollection' },
  { label: 'Iron Spent on Research', key: 'totalIronSpentOnResearch' },
  { label: 'Research Count', key: 'researchCount' },
  { label: 'Iron Spent on Builds', key: 'totalIronSpentOnBuilds' },
  { label: 'Items Built', key: 'totalBuildsCompleted' },
  // ── Ship / loadout ─────────────────────────────────────────────────────────
  { label: 'XP', key: 'xp' },
  { label: 'Ship Speed', key: 'shipSpeed' },
  { label: 'Hull Strength', key: 'hullStrength' },
  { label: 'Shield', key: 'shield' },
  { label: 'Armor', key: 'armor' },
  // ── Weapons ────────────────────────────────────────────────────────────────
  { label: 'Pulse Laser', key: 'pulseLaser' },
  { label: 'Auto Turret', key: 'autoTurret' },
  { label: 'Plasma Lance', key: 'plasmaLance' },
  { label: 'Gauss Rifle', key: 'gaussRifle' },
  { label: 'Photon Torpedo', key: 'photonTorpedo' },
  { label: 'Rocket Launcher', key: 'rocketLauncher' },
];

const Leaderboard: React.FC = () => {
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
        <h3>Leaderboard</h3>
        <p className="leaderboard-loading">Loading leaderboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="leaderboard-panel">
        <h3>Leaderboard</h3>
        <p className="leaderboard-error">{error ?? 'No leaderboard data available'}</p>
      </div>
    );
  }

  const { leaderboard, bestIn } = data;

  return (
    <div className="leaderboard-panel">

      {/* ── Leaderboard ───────────────────────────────────────────────────── */}
      <section className="leaderboard-section">
        <h3>🏅 Leaderboard</h3>
        {leaderboard.length === 0 ? (
          <p className="leaderboard-empty">No players yet.</p>
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
                  {entry.isCurrentUser && <span className="leaderboard-you"> (you)</span>}
                </span>
                <span className="leaderboard-score">{entry.score.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Best In Categories ────────────────────────────────────────────── */}
      <section className="best-in-section">
        <h3>🌟 Best In Category</h3>
        <div className="best-in-list">
          {BEST_IN_ROWS.map(({ label, key }) => {
            const winner = bestIn[key];
            return (
              <div key={key} className="best-in-row">
                <span className="best-in-label">{label}</span>
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
