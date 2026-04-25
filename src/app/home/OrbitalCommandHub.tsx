import React, { useState, useEffect } from 'react';
import { formatNumber } from '@/shared/numberFormat';
import type { DefenseValues } from '@/shared/defenseValues';
import type { BattleStatus } from '@/lib/client/hooks/useBattleStatus';
import type { TechCounts, WeaponSpec } from '@/lib/client/services/factoryService';

export interface OrbitalCommandHubProps {
  defenseValues?: DefenseValues | null;
  battleStatus?: BattleStatus | null;
  techCounts?: TechCounts | null;
  weapons?: Record<string, WeaponSpec>;
}

export const OrbitalCommandHub: React.FC<OrbitalCommandHubProps> = ({
  defenseValues,
  battleStatus,
  techCounts,
  weapons
}) => {
  // Tick for cooldowns
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  // Damage stats
  const damageDealt = battleStatus?.battle?.myTotalDamage || 0;
  const damageReceived = battleStatus?.battle?.opponentTotalDamage || 0;
  const totalDamage = damageDealt + damageReceived;
  const damageDealtPct = totalDamage > 0 ? damageDealt / totalDamage : 0;
  const damageReceivedPct = totalDamage > 0 ? damageReceived / totalDamage : 0;

  // Partial rings calculations
  const rHull = 90;
  const cHull = 2 * Math.PI * rHull;
  const hullCurrent = defenseValues?.hull?.current || 0;
  const hullMax = defenseValues?.hull?.max || 1;
  const fillHull = hullMax > 0 ? hullCurrent / hullMax : 0;

  const rArmor = 160;
  const cArmor = 2 * Math.PI * rArmor;
  const armorCurrent = defenseValues?.armor?.current || 0;
  const armorMax = defenseValues?.armor?.max || 1;
  const fillArmor = armorMax > 0 ? armorCurrent / armorMax : 0;

  const rShield = 230;
  const cShield = 2 * Math.PI * rShield;
  const shieldCurrent = defenseValues?.shield?.current || 0;
  const shieldMax = defenseValues?.shield?.max || 1;
  const fillShield = shieldMax > 0 ? shieldCurrent / shieldMax : 0;

  // Active weapons parsing
  const activeWeapons: { id: string; name: string; count: number; cooldownTimestamp: number }[] = [];
  if (techCounts && weapons) {
    for (const [key, count] of Object.entries(techCounts)) {
      if (typeof count === 'number' && count > 0 && weapons[key]) {
        activeWeapons.push({
          id: key,
          name: weapons[key].name,
          count: count,
          cooldownTimestamp: battleStatus?.battle?.weaponCooldowns?.[key] || 0
        });
      }
    }
  }

  // Pre-defined weapon colors
  const weaponColors = ['#00c6ff', '#f5af19', '#ff416c', '#00ff87', '#b341ff', '#ffeb3b'];

  return (
    <div className="orbital-command-container" style={{ width: '100%', margin: '20px 0', backgroundColor: '#02050f', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(0, 198, 255, 0.15)', boxShadow: '0 0 30px rgba(0,0,0,0.8) inset, 0 0 15px rgba(0, 198, 255, 0.1)' }}>
      <svg viewBox="0 0 1600 850" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>


          {/* Gradients */}
          <linearGradient id="shield-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00d2ff" />
            <stop offset="100%" stopColor="#0072ff" />
          </linearGradient>
          <linearGradient id="armor-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5af19" />
            <stop offset="100%" stopColor="#e65c00" />
          </linearGradient>
          <linearGradient id="hull-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff416c" />
            <stop offset="100%" stopColor="#ff4b2b" />
          </linearGradient>

          <linearGradient id="damage-dealt-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00ff87" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#60efff" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="damage-received-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff416c" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ff4b2b" stopOpacity="1" />
          </linearGradient>

          <linearGradient id="bar-bg-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
          </linearGradient>

          {/* Filters */}
          <filter id="glow-heavy" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-light" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* Global Styles */}
        <style>
          {`
            .title-main { font-family: var(--font-geist-sans), sans-serif; fill: #ffffff; font-size: 32px; letter-spacing: 4px; font-weight: 800; text-anchor: middle; text-transform: uppercase; }
            .subtitle-top { font-family: var(--font-geist-sans), sans-serif; fill: #a0c0d0; font-size: 16px; letter-spacing: 2px; text-transform: uppercase; }
            .value-large { font-family: var(--font-geist-mono), monospace; fill: #ffffff; font-size: 24px; font-weight: bold; }
            .status-text { font-family: var(--font-geist-sans), sans-serif; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
            
            .weapon-name { font-family: var(--font-geist-sans), sans-serif; fill: #e0e0e0; font-size: 16px; text-anchor: end; font-weight: 600; letter-spacing: 1px; }
            .weapon-val { font-family: var(--font-geist-mono), monospace; fill: #8ab4f8; font-size: 16px; text-anchor: start; }
            
            .ring-label { font-family: var(--font-geist-sans), sans-serif; font-size: 14px; letter-spacing: 4px; font-weight: bold; text-anchor: middle; text-transform: uppercase; }
            .box-value { font-family: var(--font-geist-mono), monospace; font-size: 14px; font-weight: bold; }
            .box-label { font-family: var(--font-geist-sans), sans-serif; font-size: 12px; opacity: 0.8; }
          `}
        </style>

        {/* Background Image */}
        <image href="/assets/images/battle/battleBg.png" x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" opacity="0.7" />
        <rect width="100%" height="100%" fill="rgba(2, 5, 15, 0.4)" /> {/* Overlay to ensure text readability */}

        {/* --- TOP HEADER --- */}
        <g id="top-header" transform="translate(800, 70)">
          <text x="0" y="0" className="title-main" filter="url(#drop-shadow)">ORBITAL COMMAND &amp; STATUS HUB</text>

          {/* Left Top: Damage Dealt */}
          <g transform="translate(0, 30)">
            <text x="-50" y="0" className="subtitle-top" textAnchor="end">TOTAL DAMAGE DEALT</text>
            <path d="M -50 15 L -720 15 L -740 40 L -70 40 Z" fill="url(#bar-bg-grad)" stroke="#00ff87" strokeWidth="1" opacity="0.4" />
            {damageDealtPct > 0 && (
              <path d={`M -50 15 L ${-50 - 670 * damageDealtPct} 15 L ${-70 - 670 * damageDealtPct} 40 L -70 40 Z`} fill="url(#damage-dealt-grad)" filter="url(#glow-light)" />
            )}
            <text x="-710" y="34" className="value-large" textAnchor="start" filter="url(#drop-shadow)">{formatNumber(damageDealt)}</text>
          </g>

          {/* Right Top: Damage Received */}
          <g transform="translate(0, 30)">
            <text x="50" y="0" className="subtitle-top" textAnchor="start">TOTAL DAMAGE RECEIVED</text>
            <path d="M 50 15 L 720 15 L 740 40 L 70 40 Z" fill="url(#bar-bg-grad)" stroke="#ff416c" strokeWidth="1" opacity="0.4" />
            {damageReceivedPct > 0 && (
              <path d={`M 50 15 L ${50 + 670 * damageReceivedPct} 15 L ${70 + 670 * damageReceivedPct} 40 L 70 40 Z`} fill="url(#damage-received-grad)" filter="url(#glow-light)" />
            )}
            <text x="710" y="34" className="value-large" textAnchor="end" filter="url(#drop-shadow)">{formatNumber(damageReceived)}</text>
          </g>
        </g>

        {/* --- LEFT PANEL: WEAPONS --- */}
        <g id="weapons-panel" transform="translate(180, 250)">
          {activeWeapons.length === 0 ? (
            <text x="50" y="0" className="weapon-val" fill="#a0c0d0">No weapons equipped</text>
          ) : (
            activeWeapons.map((w, idx) => {
              const secondsRemaining = Math.max(0, w.cooldownTimestamp - now);
              const isReady = secondsRemaining === 0;
              const timeText = isReady ? 'Ready' : `${secondsRemaining}s`;
              const fillPct = isReady ? 1 : Math.max(0, 1 - (secondsRemaining / 10)); 
              const color = weaponColors[idx % weaponColors.length];

              return (
                <g key={w.id} transform={`translate(0, ${idx * 80})`}>
                  <text x="-60" y="8" className="weapon-name">{w.name.toUpperCase()}</text>
                  <g transform="translate(0, 0)">
                    <circle cx="0" cy="0" r="24" fill="#001525" stroke={color} strokeWidth="2" filter="url(#glow-light)" />
                    <polygon points="0,-8 8,4 -8,4" fill={color} />
                  </g>
                  <rect x="50" y="-12" width="180" height="12" rx="6" fill="url(#bar-bg-grad)" stroke={color} strokeWidth="1" opacity="0.3" />
                  {fillPct > 0 && (
                    <rect x="50" y="-12" width={180 * fillPct} height="12" rx="6" fill={color} filter="url(#glow-light)" />
                  )}
                  <text x="50" y="22" className="weapon-val">{formatNumber(w.count)} units / {timeText}</text>
                </g>
              );
            })
          )}
        </g>

        {/* --- CENTER RADAR --- */}
        <g id="center-radar" transform="translate(800, 480)">
          {/* Decorative Center */}
          <circle cx="0" cy="0" r="30" fill="#0a0510" stroke="#fff" strokeWidth="1" opacity="0.2" />
          <circle cx="0" cy="0" r="10" fill="#fff" opacity="0.1" />

          {/* Crosshairs */}
          <path d="M -260 0 L 260 0 M 0 -260 L 0 260" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

          {/* Inner Red Ring (Hull) */}
          <g transform="rotate(-90)">
            {/* Background Track */}
            <circle cx="0" cy="0" r={rHull} fill="none" stroke="#25050a" strokeWidth="24" />
            {/* Segmented Track Overlay */}
            <circle cx="0" cy="0" r={rHull} fill="none" stroke="#ff416c" strokeWidth="20" strokeDasharray="8 4" opacity="0.2" />
            {/* Active Fill */}
            <circle cx="0" cy="0" r={rHull} fill="none" stroke="url(#hull-grad)" strokeWidth="20"
              strokeDasharray={cHull} strokeDashoffset={cHull * (1 - fillHull)} filter="url(#glow-heavy)" strokeLinecap="round" />
          </g>
          {/* Text Path */}
          <path id="hull-curve" d={`M -${rHull + 25},0 A ${rHull + 25},${rHull + 25} 0 0,1 ${rHull + 25},0`} fill="none" />
          <text className="ring-label" fill="#ff416c" filter="url(#glow-light)">
            <textPath href="#hull-curve" startOffset="50%" textAnchor="middle">HULL INTEGRITY</textPath>
          </text>

          {/* Middle Yellow Ring (Armor) */}
          <g transform="rotate(-90)">
            <circle cx="0" cy="0" r={rArmor} fill="none" stroke="#251505" strokeWidth="32" />
            <circle cx="0" cy="0" r={rArmor} fill="none" stroke="#f5af19" strokeWidth="28" strokeDasharray="20 10" opacity="0.2" />
            <circle cx="0" cy="0" r={rArmor} fill="none" stroke="url(#armor-grad)" strokeWidth="28"
              strokeDasharray={cArmor} strokeDashoffset={cArmor * (1 - fillArmor)} filter="url(#glow-heavy)" strokeLinecap="round" />
          </g>
          <path id="armor-curve-top" d={`M -${rArmor + 30},0 A ${rArmor + 30},${rArmor + 30} 0 0,1 ${rArmor + 30},0`} fill="none" />
          <text className="ring-label" fill="#f5af19" filter="url(#glow-light)">
            <textPath href="#armor-curve-top" startOffset="50%" textAnchor="middle">ARMOR REINFORCEMENT</textPath>
          </text>
          <text x="0" y={rArmor + 40} className="ring-label" fill="#f5af19" filter="url(#glow-light)">ARMOR</text>

          {/* Outer Blue Ring (Shield) */}
          <g transform="rotate(-90)">
            <circle cx="0" cy="0" r={rShield} fill="none" stroke="#051525" strokeWidth="40" />
            <circle cx="0" cy="0" r={rShield} fill="none" stroke="#00c6ff" strokeWidth="36" strokeDasharray="40 10" opacity="0.2" />
            <circle cx="0" cy="0" r={rShield} fill="none" stroke="url(#shield-grad)" strokeWidth="36"
              strokeDasharray={cShield} strokeDashoffset={cShield * (1 - fillShield)} filter="url(#glow-heavy)" strokeLinecap="round" />
            {/* Outer decorative thin ring */}
            <circle cx="0" cy="0" r={rShield + 28} fill="none" stroke="#00c6ff" strokeWidth="2" opacity="0.5" strokeDasharray="10 20" />
          </g>
          <text x="0" y={-(rShield + 40)} className="ring-label" fill="#00c6ff" filter="url(#glow-light)">SHIELD SYSTEM</text>
          <text x="0" y={rShield + 50} className="ring-label" fill="#00c6ff" filter="url(#glow-light)">SHIELD</text>

          {/* Connection Lines */}
          {/* Shield Line (Blue) */}
          {/* <g filter="url(#glow-light)">
            <path d={`M ${rShield * Math.cos(-55 * Math.PI / 180)},${rShield * Math.sin(-55 * Math.PI / 180)} L 131.9,-145 L 146.9,-130 L 160,-130`} fill="none" stroke="#00c6ff" strokeWidth="2" />
            <circle cx={rShield * Math.cos(-55 * Math.PI / 180)} cy={rShield * Math.sin(-55 * Math.PI / 180)} r="4" fill="#00c6ff" />
            <circle cx="160" cy="-130" r="3" fill="#00c6ff" />
          </g>
          
          {/* Hull Line (Red) */}
          {/* <g filter="url(#glow-light)">
            <path d={`M ${rHull * Math.cos(-60 * Math.PI / 180)},${rHull * Math.sin(-60 * Math.PI / 180)} L 45,-25 L 60,-10 L 70,-10`} fill="none" stroke="#ff416c" strokeWidth="2" />
            <circle cx={rHull * Math.cos(-60 * Math.PI / 180)} cy={rHull * Math.sin(-60 * Math.PI / 180)} r="4" fill="#ff416c" />
            <circle cx="70" cy="-10" r="3" fill="#ff416c" />
          </g> */}

          {/* Armor Line (Yellow) */}
          {/* <g filter="url(#glow-light)">
            <path d={`M ${rArmor * Math.cos(65 * Math.PI / 180)},${rArmor * Math.sin(65 * Math.PI / 180)} L 67.6,182.6 L 85,200 L 95,200`} fill="none" stroke="#f5af19" strokeWidth="2" />
            <circle cx={rArmor * Math.cos(65 * Math.PI / 180)} cy={rArmor * Math.sin(65 * Math.PI / 180)} r="4" fill="#f5af19" />
            <circle cx="95" cy="200" r="3" fill="#f5af19" />
          </g> */}
        </g>

        {/* --- OVERLAPPING STATS BOXES --- */}
        <g id="stats-boxes" transform="translate(800, 480)">
          {/* Shield Stats */}
          <g transform="translate(190, -230)">
            <rect x="0" y="0" width="280" height="90" rx="6" fill="rgba(1, 52, 66, 0.8)" stroke="#00c6ff" strokeWidth="2" filter="url(#drop-shadow)" />
            <path d="M 0 20 L 0 6 L 6 0 L 20 0" fill="none" stroke="#00c6ff" strokeWidth="6" />
            <path d="M 280 70 L 280 84 L 274 90 L 260 90" fill="none" stroke="#00c6ff" strokeWidth="6" />
            <text x="25" y="35" className="box-label" fill="#00c6ff" style={{ fontSize: '16px' }}>CURRENT</text>
            <text x="110" y="36" className="box-value" fill="#fff" style={{ fontSize: '20px' }}>{formatNumber(shieldCurrent)}</text>
            <text x="25" y="70" className="box-label" fill="#00c6ff" style={{ fontSize: '16px' }}>MAXIMUM</text>
            <text x="110" y="71" className="box-value" fill="#a0c0d0" style={{ fontSize: '20px' }}>{formatNumber(shieldMax)}</text>
          </g>

          {/* Hull Stats (Bottom) */}
          <g transform="translate(80, 10)">
            <rect x="0" y="0" width="280" height="90" rx="6" fill="rgba(75, 19, 32, 0.8)" stroke="#ff416c" strokeWidth="2" filter="url(#drop-shadow)" />
            <path d="M 0 20 L 0 6 L 6 0 L 20 0" fill="none" stroke="#ff416c" strokeWidth="6" />
            <path d="M 280 70 L 280 84 L 274 90 L 260 90" fill="none" stroke="#ff416c" strokeWidth="6" />
            <text x="25" y="35" className="box-label" fill="#ff416c" style={{ fontSize: '16px' }}>CURRENT</text>
            <text x="110" y="36" className="box-value" fill="#fff" style={{ fontSize: '20px' }}>{formatNumber(hullCurrent)}</text>
            <text x="25" y="70" className="box-label" fill="#ff416c" style={{ fontSize: '16px' }}>MAXIMUM</text>
            <text x="110" y="71" className="box-value" fill="#a0c0d0" style={{ fontSize: '20px' }}>{formatNumber(hullMax)}</text>
          </g>

          {/* Armor Stats (Middle) */}
          <g transform="translate(130, -110)">
            <rect x="0" y="0" width="280" height="90" rx="6" fill="rgba(56, 40, 6, 0.8)" stroke="#f5af19" strokeWidth="2" filter="url(#drop-shadow)" />
            <path d="M 0 20 L 0 6 L 6 0 L 20 0" fill="none" stroke="#9b7013ff" strokeWidth="6" />
            <path d="M 280 70 L 280 84 L 274 90 L 260 90" fill="none" stroke="#9b7013ff" strokeWidth="6" />
            <text x="25" y="35" className="box-label" fill="#f5af19" style={{ fontSize: '16px' }}>CURRENT</text>
            <text x="110" y="36" className="box-value" fill="#fff" style={{ fontSize: '20px' }}>{formatNumber(armorCurrent)}</text>
            <text x="25" y="70" className="box-label" fill="#f5af19" style={{ fontSize: '16px' }}>MAXIMUM</text>
            <text x="110" y="71" className="box-value" fill="#a0c0d0" style={{ fontSize: '20px' }}>{formatNumber(armorMax)}</text>
          </g>
        </g>

      </svg>
    </div>
  );
};

