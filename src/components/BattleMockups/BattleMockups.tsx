'use client';

import React, { useState, useEffect } from 'react';
import type { BattleStatus } from '@/lib/client/hooks/useBattleStatus';
import type { BattleEvent } from '@/lib/server/battle/battleTypes';
import './BattleMockups.css';

interface BattleMockupsProps {
  battleStatus: BattleStatus;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(startTimeSec: number): string {
  const elapsed = Math.max(0, Math.floor(Date.now() / 1000) - startTimeSec);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatCooldown(ts: number): string {
  const remaining = Math.max(0, ts - Math.floor(Date.now() / 1000));
  if (remaining === 0) return 'Ready';
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function eventLabel(e: BattleEvent): string {
  const actor = e.actor === 'attacker' ? 'ATK' : 'DEF';
  switch (e.type) {
    case 'shot_fired': return `[${actor}] Fired ${e.data.weaponType ?? 'weapon'}`;
    case 'damage_dealt': return `[${actor}] ${e.data.damageDealt?.toFixed(1) ?? '?'} dmg to ${e.data.targetDefense ?? '?'}`;
    case 'shield_broken': return `[${actor}] Shield broken!`;
    case 'armor_broken': return `[${actor}] Armor broken!`;
    case 'hull_destroyed': return `[${actor}] Hull destroyed!`;
    case 'battle_started': return 'Battle started';
    case 'battle_ended': return 'Battle ended';
    default: return e.type;
  }
}

function roleName(isAttacker: boolean): string {
  return isAttacker ? 'Attacker' : 'Defender';
}

const DESIGN_NAMES = [
  '1 – Classic Enhanced',
  '2 – Sci-Fi HUD',
  '3 – Terminal Console',
  '4 – VS Split',
  '5 – Damage Meter',
  '6 – Minimal Compact',
  '7 – RPG Combat',
  '8 – Military Ops',
  '9 – Breaking Alert',
  '10 – Stats Dashboard',
];

// ─── Individual Designs ─────────────────────────────────────────────────────

function Design1({ b }: { b: NonNullable<BattleStatus['battle']> }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);
  void tick;
  const recentEvents = b.battleLog.slice(-3).reverse();
  return (
    <div className="bm-d1">
      <div className="bm-d1-header">⚔️ BATTLE IN PROGRESS</div>
      <div className="bm-d1-sub">
        {b.isAttacker ? 'You attacked' : 'Under attack from'} opponent #{b.opponentId}
        &nbsp;·&nbsp;Role: {roleName(b.isAttacker)}
        &nbsp;·&nbsp;Duration: <strong>{formatDuration(b.battleStartTime)}</strong>
      </div>
      <div className="bm-d1-stats">
        <div className="bm-d1-stat">
          <span className="bm-d1-label">Your Damage</span>
          <span className="bm-d1-value">{b.myTotalDamage.toFixed(1)}</span>
        </div>
        <div className="bm-d1-stat">
          <span className="bm-d1-label">Opponent Damage</span>
          <span className="bm-d1-value">{b.opponentTotalDamage.toFixed(1)}</span>
        </div>
      </div>
      {recentEvents.length > 0 && (
        <div className="bm-d1-log">
          <div className="bm-d1-log-title">Recent Events</div>
          {recentEvents.map((e, i) => (
            <div key={i} className="bm-d1-log-item">{eventLabel(e)}</div>
          ))}
        </div>
      )}
      {Object.keys(b.weaponCooldowns).length > 0 && (
        <div className="bm-d1-cooldowns">
          {Object.entries(b.weaponCooldowns).map(([w, ts]) => (
            <div key={w} className="bm-d1-cooldown-item">
              <span>{w.replace(/_/g, ' ')}</span>
              <span className={formatCooldown(ts) === 'Ready' ? 'bm-ready' : ''}>{formatCooldown(ts)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Design2({ b }: { b: NonNullable<BattleStatus['battle']> }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);
  void tick;
  const totalDmg = b.myTotalDamage + b.opponentTotalDamage;
  const myPct = totalDmg > 0 ? (b.myTotalDamage / totalDmg) * 100 : 50;
  return (
    <div className="bm-d2">
      <div className="bm-d2-title">◈ COMBAT SYSTEMS ACTIVE ◈</div>
      <div className="bm-d2-grid">
        <div className="bm-d2-block">
          <div className="bm-d2-block-label">PILOT STATUS</div>
          <div className="bm-d2-block-val">{roleName(b.isAttacker).toUpperCase()}</div>
        </div>
        <div className="bm-d2-block">
          <div className="bm-d2-block-label">TARGET ID</div>
          <div className="bm-d2-block-val">#{b.opponentId}</div>
        </div>
        <div className="bm-d2-block">
          <div className="bm-d2-block-label">ENGAGEMENT TIME</div>
          <div className="bm-d2-block-val bm-d2-blink">{formatDuration(b.battleStartTime)}</div>
        </div>
        <div className="bm-d2-block">
          <div className="bm-d2-block-label">BATTLE ID</div>
          <div className="bm-d2-block-val">#{b.id}</div>
        </div>
      </div>
      <div className="bm-d2-bar-section">
        <div className="bm-d2-bar-label">
          <span>YOU: {b.myTotalDamage.toFixed(1)}</span>
          <span>DAMAGE OUTPUT</span>
          <span>OPP: {b.opponentTotalDamage.toFixed(1)}</span>
        </div>
        <div className="bm-d2-bar-track">
          <div className="bm-d2-bar-fill" style={{ width: `${myPct}%` }} />
          <div className="bm-d2-bar-center" />
        </div>
      </div>
      {Object.keys(b.weaponCooldowns).length > 0 && (
        <div className="bm-d2-weapons">
          {Object.entries(b.weaponCooldowns).map(([w, ts]) => {
            const ready = formatCooldown(ts) === 'Ready';
            return (
              <div key={w} className={`bm-d2-weapon ${ready ? 'bm-d2-weapon-ready' : ''}`}>
                <div className="bm-d2-weapon-name">{w.replace(/_/g, ' ')}</div>
                <div className="bm-d2-weapon-status">{formatCooldown(ts)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Design3({ b }: { b: NonNullable<BattleStatus['battle']> }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);
  void tick;
  const events = b.battleLog.slice(-6).reverse();
  const lines = [
    `> BATTLE_ID: ${b.id}`,
    `> STATUS: ACTIVE`,
    `> ROLE: ${roleName(b.isAttacker).toUpperCase()}`,
    `> TARGET: #${b.opponentId}`,
    `> ELAPSED: ${formatDuration(b.battleStartTime)}`,
    `> MY_DMG: ${b.myTotalDamage.toFixed(2)}`,
    `> OPP_DMG: ${b.opponentTotalDamage.toFixed(2)}`,
    `>`,
    `> WEAPON_STATUS:`,
    ...Object.entries(b.weaponCooldowns).map(([w, ts]) => `>   ${w}: ${formatCooldown(ts)}`),
    `>`,
    `> RECENT_EVENTS:`,
    ...events.map(e => `>   ${eventLabel(e)}`),
  ];
  return (
    <div className="bm-d3">
      <div className="bm-d3-header">SPACEWARS COMBAT TERMINAL v2.0</div>
      <div className="bm-d3-body">
        {lines.map((l, i) => <div key={i} className="bm-d3-line">{l}</div>)}
        <div className="bm-d3-cursor">█</div>
      </div>
    </div>
  );
}

function Design4({ b }: { b: NonNullable<BattleStatus['battle']> }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);
  void tick;
  return (
    <div className="bm-d4">
      <div className="bm-d4-header">
        <span>⚔️ BATTLE #{b.id}</span>
        <span className="bm-d4-duration">⏱ {formatDuration(b.battleStartTime)}</span>
      </div>
      <div className="bm-d4-vs">
        <div className="bm-d4-side bm-d4-you">
          <div className="bm-d4-role">{b.isAttacker ? '⚔ ATTACKER' : '🛡 DEFENDER'}</div>
          <div className="bm-d4-player">YOU</div>
          <div className="bm-d4-dmg-label">Damage Dealt</div>
          <div className="bm-d4-dmg">{b.myTotalDamage.toFixed(1)}</div>
          {Object.keys(b.weaponCooldowns).length > 0 && (
            <div className="bm-d4-weapons">
              {Object.entries(b.weaponCooldowns).map(([w, ts]) => (
                <div key={w} className="bm-d4-weapon-row">
                  <span>{w.replace(/_/g, ' ')}</span>
                  <span className={formatCooldown(ts) === 'Ready' ? 'bm-ready' : 'bm-cooling'}>{formatCooldown(ts)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bm-d4-center">VS</div>
        <div className="bm-d4-side bm-d4-opp">
          <div className="bm-d4-role">{b.isAttacker ? '🛡 DEFENDER' : '⚔ ATTACKER'}</div>
          <div className="bm-d4-player">#{b.opponentId}</div>
          <div className="bm-d4-dmg-label">Damage Dealt</div>
          <div className="bm-d4-dmg">{b.opponentTotalDamage.toFixed(1)}</div>
        </div>
      </div>
    </div>
  );
}

function Design5({ b }: { b: NonNullable<BattleStatus['battle']> }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);
  void tick;
  const maxDmg = Math.max(b.myTotalDamage, b.opponentTotalDamage, 1);
  const myPct = (b.myTotalDamage / maxDmg) * 100;
  const oppPct = (b.opponentTotalDamage / maxDmg) * 100;
  const totalDmg = b.myTotalDamage + b.opponentTotalDamage;
  return (
    <div className="bm-d5">
      <div className="bm-d5-title">💥 DAMAGE REPORT — Battle #{b.id}</div>
      <div className="bm-d5-meta">
        {roleName(b.isAttacker)} vs #{b.opponentId} &nbsp;·&nbsp; Running: {formatDuration(b.battleStartTime)}
        &nbsp;·&nbsp; Total dealt: {totalDmg.toFixed(1)}
      </div>
      <div className="bm-d5-meter-row">
        <div className="bm-d5-meter-label">You</div>
        <div className="bm-d5-meter-track">
          <div className="bm-d5-meter-fill bm-d5-you-fill" style={{ width: `${myPct}%` }} />
        </div>
        <div className="bm-d5-meter-num">{b.myTotalDamage.toFixed(1)}</div>
      </div>
      <div className="bm-d5-meter-row">
        <div className="bm-d5-meter-label">Opp</div>
        <div className="bm-d5-meter-track">
          <div className="bm-d5-meter-fill bm-d5-opp-fill" style={{ width: `${oppPct}%` }} />
        </div>
        <div className="bm-d5-meter-num">{b.opponentTotalDamage.toFixed(1)}</div>
      </div>
      {Object.keys(b.weaponCooldowns).length > 0 && (
        <div className="bm-d5-cooldowns">
          <div className="bm-d5-cooldowns-title">Weapons</div>
          <div className="bm-d5-cooldowns-grid">
            {Object.entries(b.weaponCooldowns).map(([w, ts]) => {
              const ready = formatCooldown(ts) === 'Ready';
              return (
                <div key={w} className={`bm-d5-weapon ${ready ? 'bm-d5-weapon-ready' : ''}`}>
                  <span>{w.replace(/_/g, ' ')}</span>
                  <span>{formatCooldown(ts)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Design6({ b }: { b: NonNullable<BattleStatus['battle']> }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);
  void tick;
  const lastEvent = b.battleLog.length > 0 ? eventLabel(b.battleLog[b.battleLog.length - 1]) : 'No events yet';
  const weapons = Object.entries(b.weaponCooldowns);
  const readyCount = weapons.filter(([, ts]) => formatCooldown(ts) === 'Ready').length;
  return (
    <div className="bm-d6">
      <span className="bm-d6-badge">⚔ BATTLE</span>
      <span className="bm-d6-id">#{b.id}</span>
      <span className="bm-d6-sep">|</span>
      <span className="bm-d6-role">{roleName(b.isAttacker)}</span>
      <span className="bm-d6-sep">|</span>
      <span className="bm-d6-opp">vs #{b.opponentId}</span>
      <span className="bm-d6-sep">|</span>
      <span className="bm-d6-dur">⏱ {formatDuration(b.battleStartTime)}</span>
      <span className="bm-d6-sep">|</span>
      <span className="bm-d6-dmg">📊 You {b.myTotalDamage.toFixed(0)} / Opp {b.opponentTotalDamage.toFixed(0)}</span>
      {weapons.length > 0 && (
        <>
          <span className="bm-d6-sep">|</span>
          <span className="bm-d6-weapons">🔫 {readyCount}/{weapons.length} ready</span>
        </>
      )}
      <span className="bm-d6-sep">|</span>
      <span className="bm-d6-event" title={lastEvent}>📡 {lastEvent}</span>
    </div>
  );
}

function Design7({ b }: { b: NonNullable<BattleStatus['battle']> }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);
  void tick;
  const events = b.battleLog.slice(-4).reverse();
  const myLead = b.myTotalDamage > b.opponentTotalDamage;
  return (
    <div className="bm-d7">
      <div className="bm-d7-header">
        <div className="bm-d7-title">★ SPACE BATTLE ★</div>
        <div className="bm-d7-subtitle">Turn-based combat • Round ongoing</div>
      </div>
      <div className="bm-d7-field">
        <div className="bm-d7-combatant bm-d7-player">
          <div className="bm-d7-sprite">🚀</div>
          <div className="bm-d7-name">YOU</div>
          <div className="bm-d7-hp-bar">
            <div className="bm-d7-hp-fill bm-d7-hp-you" style={{ width: myLead ? '70%' : '40%' }} />
          </div>
          <div className="bm-d7-stat">ATK {b.myTotalDamage.toFixed(0)}</div>
        </div>
        <div className="bm-d7-mid">
          <div className="bm-d7-timer">{formatDuration(b.battleStartTime)}</div>
          <div className="bm-d7-vs">VS</div>
          <div className="bm-d7-id">#{b.id}</div>
        </div>
        <div className="bm-d7-combatant bm-d7-enemy">
          <div className="bm-d7-sprite">👾</div>
          <div className="bm-d7-name">#{b.opponentId}</div>
          <div className="bm-d7-hp-bar">
            <div className="bm-d7-hp-fill bm-d7-hp-opp" style={{ width: myLead ? '40%' : '70%' }} />
          </div>
          <div className="bm-d7-stat">ATK {b.opponentTotalDamage.toFixed(0)}</div>
        </div>
      </div>
      {events.length > 0 && (
        <div className="bm-d7-log">
          {events.map((e, i) => <div key={i} className="bm-d7-log-line">▶ {eventLabel(e)}</div>)}
        </div>
      )}
      {Object.keys(b.weaponCooldowns).length > 0 && (
        <div className="bm-d7-actions">
          {Object.entries(b.weaponCooldowns).map(([w, ts]) => {
            const ready = formatCooldown(ts) === 'Ready';
            return (
              <div key={w} className={`bm-d7-action ${ready ? 'bm-d7-action-ready' : ''}`}>
                {ready ? '▶' : '⏳'} {w.replace(/_/g, ' ')}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Design8({ b }: { b: NonNullable<BattleStatus['battle']> }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);
  void tick;
  const events = b.battleLog.slice(-5).reverse();
  return (
    <div className="bm-d8">
      <div className="bm-d8-header">
        <span className="bm-d8-title">◆ SITREP — ENGAGEMENT {b.id.toString().padStart(4, '0')} ◆</span>
        <span className="bm-d8-time">T+{formatDuration(b.battleStartTime)}</span>
      </div>
      <div className="bm-d8-grid">
        <div className="bm-d8-row"><span className="bm-d8-key">UNIT ROLE</span><span className="bm-d8-val">{roleName(b.isAttacker).toUpperCase()}</span></div>
        <div className="bm-d8-row"><span className="bm-d8-key">TARGET UNIT</span><span className="bm-d8-val">ENTITY #{b.opponentId}</span></div>
        <div className="bm-d8-row"><span className="bm-d8-key">DAMAGE INFLICTED</span><span className="bm-d8-val">{b.myTotalDamage.toFixed(2)} UNITS</span></div>
        <div className="bm-d8-row"><span className="bm-d8-key">DAMAGE RECEIVED</span><span className="bm-d8-val">{b.opponentTotalDamage.toFixed(2)} UNITS</span></div>
        <div className="bm-d8-row"><span className="bm-d8-key">EVENTS LOGGED</span><span className="bm-d8-val">{b.battleLog.length}</span></div>
        {Object.entries(b.weaponCooldowns).map(([w, ts]) => (
          <div key={w} className="bm-d8-row">
            <span className="bm-d8-key">SYS/{w.toUpperCase().replace(/_/g, '-')}</span>
            <span className={`bm-d8-val ${formatCooldown(ts) === 'Ready' ? 'bm-d8-ready' : ''}`}>{formatCooldown(ts).toUpperCase()}</span>
          </div>
        ))}
      </div>
      {events.length > 0 && (
        <div className="bm-d8-log">
          <div className="bm-d8-log-title">▶ ACTIVITY LOG</div>
          {events.map((e, i) => (
            <div key={i} className="bm-d8-log-line">[{b.battleLog.length - i - 1 + 1 <= b.battleLog.length ? (b.battleLog.length - i).toString().padStart(3, '0') : '???'}] {eventLabel(e).toUpperCase()}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function Design9({ b }: { b: NonNullable<BattleStatus['battle']> }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);
  void tick;
  const headline = b.isAttacker
    ? `PLAYER LAUNCHES ASSAULT ON OPPONENT #${b.opponentId}`
    : `PLAYER UNDER ATTACK FROM OPPONENT #${b.opponentId}`;
  const winning = b.myTotalDamage >= b.opponentTotalDamage;
  return (
    <div className="bm-d9">
      <div className="bm-d9-ticker">⚠ BREAKING &nbsp;⚠ BREAKING &nbsp;⚠ BREAKING &nbsp;⚠ BREAKING &nbsp;⚠ BREAKING</div>
      <div className="bm-d9-headline">{headline}</div>
      <div className="bm-d9-sub">Battle #{b.id} · {formatDuration(b.battleStartTime)} elapsed · {b.battleLog.length} events recorded</div>
      <div className="bm-d9-body">
        <div className="bm-d9-stat">
          <div className="bm-d9-stat-num bm-d9-you">{b.myTotalDamage.toFixed(1)}</div>
          <div className="bm-d9-stat-label">YOUR DAMAGE</div>
        </div>
        <div className={`bm-d9-verdict ${winning ? 'bm-d9-winning' : 'bm-d9-losing'}`}>
          {winning ? '📈 LEADING' : '📉 TRAILING'}
        </div>
        <div className="bm-d9-stat">
          <div className="bm-d9-stat-num bm-d9-opp">{b.opponentTotalDamage.toFixed(1)}</div>
          <div className="bm-d9-stat-label">OPP DAMAGE</div>
        </div>
      </div>
      {Object.keys(b.weaponCooldowns).length > 0 && (
        <div className="bm-d9-footer">
          {Object.entries(b.weaponCooldowns).map(([w, ts]) => {
            const ready = formatCooldown(ts) === 'Ready';
            return (
              <span key={w} className={`bm-d9-weapon-tag ${ready ? 'bm-d9-tag-ready' : 'bm-d9-tag-cool'}`}>
                {w.replace(/_/g, ' ')}: {formatCooldown(ts)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Design10({ b }: { b: NonNullable<BattleStatus['battle']> }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);
  void tick;
  const recentEvents = b.battleLog.slice(-3).reverse();
  const weapons = Object.entries(b.weaponCooldowns);
  const readyCount = weapons.filter(([, ts]) => formatCooldown(ts) === 'Ready').length;
  return (
    <div className="bm-d10">
      <div className="bm-d10-title">📊 Battle Dashboard — #{b.id}</div>
      <div className="bm-d10-cards">
        <div className="bm-d10-card">
          <div className="bm-d10-card-icon">🎯</div>
          <div className="bm-d10-card-val">{b.myTotalDamage.toFixed(1)}</div>
          <div className="bm-d10-card-label">Your Damage</div>
        </div>
        <div className="bm-d10-card">
          <div className="bm-d10-card-icon">💥</div>
          <div className="bm-d10-card-val">{b.opponentTotalDamage.toFixed(1)}</div>
          <div className="bm-d10-card-label">Opp Damage</div>
        </div>
        <div className="bm-d10-card">
          <div className="bm-d10-card-icon">⏱</div>
          <div className="bm-d10-card-val">{formatDuration(b.battleStartTime)}</div>
          <div className="bm-d10-card-label">Duration</div>
        </div>
        <div className="bm-d10-card">
          <div className="bm-d10-card-icon">📋</div>
          <div className="bm-d10-card-val">{b.battleLog.length}</div>
          <div className="bm-d10-card-label">Events</div>
        </div>
        <div className="bm-d10-card">
          <div className="bm-d10-card-icon">🔫</div>
          <div className="bm-d10-card-val">{weapons.length > 0 ? `${readyCount}/${weapons.length}` : '—'}</div>
          <div className="bm-d10-card-label">Weapons Ready</div>
        </div>
        <div className="bm-d10-card">
          <div className="bm-d10-card-icon">{b.isAttacker ? '⚔' : '🛡'}</div>
          <div className="bm-d10-card-val">{roleName(b.isAttacker)}</div>
          <div className="bm-d10-card-label">Your Role</div>
        </div>
      </div>
      {recentEvents.length > 0 && (
        <div className="bm-d10-events">
          <div className="bm-d10-events-title">Recent Activity</div>
          {recentEvents.map((e, i) => (
            <div key={i} className="bm-d10-event-row">{eventLabel(e)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

const DESIGNS = [Design1, Design2, Design3, Design4, Design5, Design6, Design7, Design8, Design9, Design10];

// ─── Main Component ──────────────────────────────────────────────────────────

export function BattleMockups({ battleStatus }: BattleMockupsProps) {
  const [designIndex, setDesignIndex] = useState(0);

  if (!battleStatus.inBattle || !battleStatus.battle) return null;

  const battle = battleStatus.battle;
  const DesignComponent = DESIGNS[designIndex];
  const total = DESIGNS.length;

  const prev = () => setDesignIndex(i => (i - 1 + total) % total);
  const next = () => setDesignIndex(i => (i + 1) % total);

  return (
    <div id="battle-status" className="bm-wrapper">
      <DesignComponent b={battle} />
      <div className="bm-nav">
        <button className="bm-nav-btn" onClick={prev} aria-label="Previous design">◀</button>
        <span className="bm-nav-label">{DESIGN_NAMES[designIndex]}</span>
        <button className="bm-nav-btn" onClick={next} aria-label="Next design">▶</button>
      </div>
    </div>
  );
}
