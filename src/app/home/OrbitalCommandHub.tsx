import React from 'react';

export const OrbitalCommandHub: React.FC = () => {
  // Calculations for partial rings
  // Circumference = 2 * PI * R
  const rHull = 90;
  const cHull = 2 * Math.PI * rHull;
  const fillHull = 0.45; // 45%

  const rArmor = 160;
  const cArmor = 2 * Math.PI * rArmor;
  const fillArmor = 0.65; // 65%

  const rShield = 230;
  const cShield = 2 * Math.PI * rShield;
  const fillShield = 0.85; // 85%

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
            <stop offset="0%" stopColor="#00ff87" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#60efff" stopOpacity="1"/>
          </linearGradient>
          <linearGradient id="damage-received-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff416c" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#ff4b2b" stopOpacity="1"/>
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
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.5"/>
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
          
          {/* Status Star */}
          <g transform="translate(0, 50)">
            <circle cx="0" cy="0" r="30" fill="#051510" stroke="#00ff87" strokeWidth="3" filter="url(#glow-light)" />
            <polygon points="0,-15 5,-5 16,-4 8,4 10,15 0,10 -10,15 -8,4 -16,-4 -5,-5" fill="#00ff87" />
            <text x="0" y="-38" className="status-text" fill="#00ff87" textAnchor="middle">STATUS</text>
          </g>

          {/* Left Top: Damage Dealt */}
          <g transform="translate(-400, 30)">
            <text x="0" y="0" className="subtitle-top" textAnchor="end">TOTAL DAMAGE DEALT</text>
            <path d="M 10 15 L -260 15 L -280 40 L -10 40 Z" fill="url(#bar-bg-grad)" stroke="#00ff87" strokeWidth="1" opacity="0.4" />
            <path d="M 10 15 L -160 15 L -180 40 L -10 40 Z" fill="url(#damage-dealt-grad)" filter="url(#glow-light)" />
            <text x="-270" y="65" className="status-text" fill="#00ff87" textAnchor="start">STATUS: LEADING</text>
            <text x="-260" y="33" className="value-large" textAnchor="start" filter="url(#drop-shadow)">1,234,567</text>
          </g>

          {/* Right Top: Damage Received */}
          <g transform="translate(400, 30)">
            <text x="0" y="0" className="subtitle-top" textAnchor="start">TOTAL DAMAGE RECEIVED</text>
            <path d="M -10 15 L 260 15 L 280 40 L 10 40 Z" fill="url(#bar-bg-grad)" stroke="#ff416c" strokeWidth="1" opacity="0.4" />
            <path d="M -10 15 L 210 15 L 230 40 L 10 40 Z" fill="url(#damage-received-grad)" filter="url(#glow-light)" />
            <text x="270" y="65" className="status-text" fill="#ff416c" textAnchor="end">STATUS: LAGGING</text>
            <text x="260" y="33" className="value-large" textAnchor="end" filter="url(#drop-shadow)">987,654</text>
          </g>
        </g>

        {/* --- LEFT PANEL: WEAPONS --- */}
        <g id="weapons-panel" transform="translate(180, 250)">
          {/* Weapon Template Functionality encoded in static groups */}
          
          {/* Missile Salvo */}
          <g transform="translate(0, 0)">
            <text x="-60" y="8" className="weapon-name">MISSILE SALVO</text>
            <g transform="translate(0, 0)">
              <circle cx="0" cy="0" r="28" fill="#001525" stroke="#00c6ff" strokeWidth="2" filter="url(#glow-light)"/>
              <path d="M -8,12 L 8,-4 L 4,-10 L -12,6 Z" fill="#00c6ff" />
              <circle cx="6" cy="-8" r="3" fill="#ffffff" />
            </g>
            <rect x="50" y="-12" width="180" height="12" rx="6" fill="url(#bar-bg-grad)" stroke="#00c6ff" strokeWidth="1" opacity="0.3"/>
            <rect x="50" y="-12" width="140" height="12" rx="6" fill="#00c6ff" filter="url(#glow-light)"/>
            <text x="50" y="22" className="weapon-val">1,234,567 / Ready</text>
          </g>

          {/* Laser I */}
          <g transform="translate(0, 100)">
            <text x="-60" y="8" className="weapon-name">LASER I</text>
            <g transform="translate(0, 0)">
              <circle cx="0" cy="0" r="28" fill="#150a00" stroke="#f5af19" strokeWidth="2" filter="url(#glow-light)"/>
              <polygon points="0,-12 8,8 -8,8" fill="#f5af19" />
            </g>
            <rect x="50" y="-12" width="180" height="12" rx="6" fill="url(#bar-bg-grad)" stroke="#f5af19" strokeWidth="1" opacity="0.3"/>
            <rect x="50" y="-12" width="120" height="12" rx="6" fill="#f5af19" filter="url(#glow-light)"/>
            <text x="50" y="22" className="weapon-val">1,234,567 / Ready</text>
          </g>

          {/* Laser II */}
          <g transform="translate(0, 200)">
            <text x="-60" y="8" className="weapon-name">LASER II</text>
            <g transform="translate(0, 0)">
              <circle cx="0" cy="0" r="28" fill="#150a00" stroke="#f5af19" strokeWidth="2" filter="url(#glow-light)"/>
              <rect x="-6" y="-12" width="12" height="24" rx="2" fill="#f5af19" />
            </g>
            <rect x="50" y="-12" width="180" height="12" rx="6" fill="url(#bar-bg-grad)" stroke="#f5af19" strokeWidth="1" opacity="0.3"/>
            <rect x="50" y="-12" width="160" height="12" rx="6" fill="#f5af19" filter="url(#glow-light)"/>
            <text x="50" y="22" className="weapon-val">1,234,567 / Ready</text>
          </g>

          {/* Ion Cannon */}
          <g transform="translate(0, 300)">
            <text x="-60" y="8" className="weapon-name">ION CANNON</text>
            <g transform="translate(0, 0)">
              <circle cx="0" cy="0" r="28" fill="#150005" stroke="#ff416c" strokeWidth="2" filter="url(#glow-light)"/>
              <circle cx="0" cy="0" r="10" fill="#ff416c" />
              <circle cx="0" cy="0" r="16" fill="none" stroke="#ff416c" strokeWidth="2" strokeDasharray="4 4" />
            </g>
            <rect x="50" y="-12" width="180" height="12" rx="6" fill="url(#bar-bg-grad)" stroke="#ff416c" strokeWidth="1" opacity="0.3"/>
            <rect x="50" y="-12" width="80" height="12" rx="6" fill="#ff416c" filter="url(#glow-light)"/>
            <text x="50" y="22" className="weapon-val">2,632,500 / 12s</text>
          </g>

          {/* EMP */}
          <g transform="translate(0, 400)">
            <text x="-60" y="8" className="weapon-name">EMP</text>
            <g transform="translate(0, 0)">
              <circle cx="0" cy="0" r="28" fill="#001525" stroke="#00c6ff" strokeWidth="2" filter="url(#glow-light)"/>
              <polygon points="0,-12 10,0 0,12 -10,0" fill="#00c6ff" />
            </g>
            <rect x="50" y="-12" width="180" height="12" rx="6" fill="url(#bar-bg-grad)" stroke="#00c6ff" strokeWidth="1" opacity="0.3"/>
            <rect x="50" y="-12" width="170" height="12" rx="6" fill="#00c6ff" filter="url(#glow-light)"/>
            <text x="50" y="22" className="weapon-val">0 / Ready</text>
          </g>
        </g>

        {/* --- CENTER RADAR --- */}
        <g id="center-radar" transform="translate(800, 480)">
          {/* Decorative Center */}
          <circle cx="0" cy="0" r="30" fill="#0a0510" stroke="#fff" strokeWidth="1" opacity="0.2"/>
          <circle cx="0" cy="0" r="10" fill="#fff" opacity="0.1"/>
          
          {/* Crosshairs */}
          <path d="M -260 0 L 260 0 M 0 -260 L 0 260" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          
          {/* Inner Red Ring (Hull) */}
          <g transform="rotate(-90)">
            {/* Background Track */}
            <circle cx="0" cy="0" r={rHull} fill="none" stroke="#25050a" strokeWidth="24" />
            {/* Segmented Track Overlay */}
            <circle cx="0" cy="0" r={rHull} fill="none" stroke="#ff416c" strokeWidth="20" strokeDasharray="8 4" opacity="0.2"/>
            {/* Active Fill */}
            <circle cx="0" cy="0" r={rHull} fill="none" stroke="url(#hull-grad)" strokeWidth="20" 
              strokeDasharray={cHull} strokeDashoffset={cHull * (1 - fillHull)} filter="url(#glow-heavy)" strokeLinecap="round" />
          </g>
          {/* Text Path */}
          <path id="hull-curve" d={`M -${rHull+25},0 A ${rHull+25},${rHull+25} 0 0,1 ${rHull+25},0`} fill="none" />
          <text className="ring-label" fill="#ff416c" filter="url(#glow-light)">
            <textPath href="#hull-curve" startOffset="50%" textAnchor="middle">HULL INTEGRITY</textPath>
          </text>

          {/* Middle Yellow Ring (Armor) */}
          <g transform="rotate(-90)">
            <circle cx="0" cy="0" r={rArmor} fill="none" stroke="#251505" strokeWidth="32" />
            <circle cx="0" cy="0" r={rArmor} fill="none" stroke="#f5af19" strokeWidth="28" strokeDasharray="20 10" opacity="0.2"/>
            <circle cx="0" cy="0" r={rArmor} fill="none" stroke="url(#armor-grad)" strokeWidth="28" 
              strokeDasharray={cArmor} strokeDashoffset={cArmor * (1 - fillArmor)} filter="url(#glow-heavy)" strokeLinecap="round" />
          </g>
          <path id="armor-curve-top" d={`M -${rArmor+30},0 A ${rArmor+30},${rArmor+30} 0 0,1 ${rArmor+30},0`} fill="none" />
          <text className="ring-label" fill="#f5af19" filter="url(#glow-light)">
            <textPath href="#armor-curve-top" startOffset="50%" textAnchor="middle">ARMOR REINFORCEMENT</textPath>
          </text>
          <text x="0" y={rArmor + 40} className="ring-label" fill="#f5af19" filter="url(#glow-light)">ARMOR</text>

          {/* Outer Blue Ring (Shield) */}
          <g transform="rotate(-90)">
            <circle cx="0" cy="0" r={rShield} fill="none" stroke="#051525" strokeWidth="40" />
            <circle cx="0" cy="0" r={rShield} fill="none" stroke="#00c6ff" strokeWidth="36" strokeDasharray="40 10" opacity="0.2"/>
            <circle cx="0" cy="0" r={rShield} fill="none" stroke="url(#shield-grad)" strokeWidth="36" 
              strokeDasharray={cShield} strokeDashoffset={cShield * (1 - fillShield)} filter="url(#glow-heavy)" strokeLinecap="round" />
            {/* Outer decorative thin ring */}
            <circle cx="0" cy="0" r={rShield + 28} fill="none" stroke="#00c6ff" strokeWidth="2" opacity="0.5" strokeDasharray="10 20"/>
          </g>
          <text x="0" y={-(rShield + 40)} className="ring-label" fill="#00c6ff" filter="url(#glow-light)">SHIELD SYSTEM</text>
          <text x="0" y={rShield + 50} className="ring-label" fill="#00c6ff" filter="url(#glow-light)">SHIELD</text>

        </g>

        {/* --- OVERLAPPING STATS BOXES --- */}
        <g id="stats-boxes" transform="translate(800, 480)">
          {/* Shield Stats */}
          <g transform="translate(150, -130)">
            <rect x="0" y="0" width="280" height="90" rx="6" fill="rgba(0, 198, 255, 0.4)" stroke="#00c6ff" strokeWidth="2" filter="url(#drop-shadow)"/>
            <path d="M 0 20 L 0 6 L 6 0 L 20 0" fill="none" stroke="#00c6ff" strokeWidth="3" />
            <path d="M 280 70 L 280 84 L 274 90 L 260 90" fill="none" stroke="#00c6ff" strokeWidth="3" />
            <text x="25" y="35" className="box-label" fill="#00c6ff" style={{fontSize: '16px'}}>CURRENT</text>
            <text x="110" y="36" className="box-value" fill="#fff" style={{fontSize: '20px'}}>85,200,155</text>
            <text x="25" y="70" className="box-label" fill="#00c6ff" style={{fontSize: '16px'}}>MAXIMUM</text>
            <text x="110" y="71" className="box-value" fill="#a0c0d0" style={{fontSize: '20px'}}>100,234,300</text>
          </g>

          {/* Hull Stats (Middle) */}
          <g transform="translate(60, -10)">
            <rect x="0" y="0" width="280" height="90" rx="6" fill="rgba(255, 65, 108, 0.4)" stroke="#ff416c" strokeWidth="2" filter="url(#drop-shadow)"/>
            <path d="M 0 20 L 0 6 L 6 0 L 20 0" fill="none" stroke="#ff416c" strokeWidth="3" />
            <path d="M 280 70 L 280 84 L 274 90 L 260 90" fill="none" stroke="#ff416c" strokeWidth="3" />
            <text x="25" y="35" className="box-label" fill="#ff416c" style={{fontSize: '16px'}}>CURRENT</text>
            <text x="110" y="36" className="box-value" fill="#fff" style={{fontSize: '20px'}}>90,000,000</text>
            <text x="25" y="70" className="box-label" fill="#ff416c" style={{fontSize: '16px'}}>MAXIMUM</text>
            <text x="110" y="71" className="box-value" fill="#a0c0d0" style={{fontSize: '20px'}}>200,000,000</text>
          </g>

          {/* Armor Stats (Bottom) */}
          <g transform="translate(85, 110)">
            <rect x="0" y="0" width="280" height="90" rx="6" fill="rgba(245, 175, 25, 0.4)" stroke="#f5af19" strokeWidth="2" filter="url(#drop-shadow)"/>
            <path d="M 0 20 L 0 6 L 6 0 L 20 0" fill="none" stroke="#f5af19" strokeWidth="3" />
            <path d="M 280 70 L 280 84 L 274 90 L 260 90" fill="none" stroke="#f5af19" strokeWidth="3" />
            <text x="25" y="35" className="box-label" fill="#f5af19" style={{fontSize: '16px'}}>CURRENT</text>
            <text x="110" y="36" className="box-value" fill="#fff" style={{fontSize: '20px'}}>32,500,000</text>
            <text x="25" y="70" className="box-label" fill="#f5af19" style={{fontSize: '16px'}}>MAXIMUM</text>
            <text x="110" y="71" className="box-value" fill="#a0c0d0" style={{fontSize: '20px'}}>50,000,000</text>
          </g>
        </g>

      </svg>
    </div>
  );
};

