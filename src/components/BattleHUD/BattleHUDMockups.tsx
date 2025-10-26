'use client';

import React, { useState } from 'react';
import './BattleHUDMockups.css';

interface MockBattleData {
  hull: { current: number; max: number };
  armor: { current: number; max: number };
  shield: { current: number; max: number };
  weaponsReady: boolean;
  weaponCooldown: number;
  enemyHull: { current: number; max: number };
  enemyShield: { current: number; max: number };
  targetLocked: boolean;
  distance: number;
}

const mockData: MockBattleData = {
  hull: { current: 650, max: 1000 },
  armor: { current: 450, max: 800 },
  shield: { current: 300, max: 600 },
  weaponsReady: false,
  weaponCooldown: 3.2,
  enemyHull: { current: 820, max: 1200 },
  enemyShield: { current: 150, max: 500 },
  targetLocked: true,
  distance: 2340,
};

export default function BattleHUDMockups() {
  const [selectedDesign, setSelectedDesign] = useState<number>(1);

  return (
    <div className="hud-mockups-container">
      <h1 className="mockup-title">Battle HUD Design Options</h1>
      <div className="design-selector">
        {[1, 2, 3, 4, 5].map((num) => (
          <button
            key={num}
            className={`selector-btn ${selectedDesign === num ? 'active' : ''}`}
            onClick={() => setSelectedDesign(num)}
          >
            Design {num}
          </button>
        ))}
      </div>

      <div className="hud-display">
        {selectedDesign === 1 && <Design1Minimalist data={mockData} />}
        {selectedDesign === 2 && <Design2Retro data={mockData} />}
        {selectedDesign === 3 && <Design3Military data={mockData} />}
        {selectedDesign === 4 && <Design4Futuristic data={mockData} />}
        {selectedDesign === 5 && <Design5Organic data={mockData} />}
      </div>
    </div>
  );
}

// Design 1: Minimalist Clean Interface
function Design1Minimalist({ data }: { data: MockBattleData }) {
  const getPercentage = (current: number, max: number) => (current / max) * 100;

  return (
    <div className="hud-design-1">
      <div className="d1-left">
        <div className="d1-stat-group">
          <label>HULL</label>
          <div className="d1-bar">
            <div 
              className="d1-bar-fill d1-hull" 
              style={{ width: `${getPercentage(data.hull.current, data.hull.max)}%` }}
            />
            <span className="d1-bar-text">{data.hull.current} / {data.hull.max}</span>
          </div>
        </div>
        <div className="d1-stat-group">
          <label>ARMOR</label>
          <div className="d1-bar">
            <div 
              className="d1-bar-fill d1-armor" 
              style={{ width: `${getPercentage(data.armor.current, data.armor.max)}%` }}
            />
            <span className="d1-bar-text">{data.armor.current} / {data.armor.max}</span>
          </div>
        </div>
        <div className="d1-stat-group">
          <label>SHIELD</label>
          <div className="d1-bar">
            <div 
              className="d1-bar-fill d1-shield" 
              style={{ width: `${getPercentage(data.shield.current, data.shield.max)}%` }}
            />
            <span className="d1-bar-text">{data.shield.current} / {data.shield.max}</span>
          </div>
        </div>
      </div>

      <div className="d1-center">
        <div className="d1-crosshair">
          <div className="d1-crosshair-inner">
            {data.targetLocked && <span className="d1-lock-icon">◈</span>}
          </div>
        </div>
        <div className="d1-distance">{data.distance}m</div>
      </div>

      <div className="d1-right">
        <div className="d1-weapon-status">
          <div className={`d1-weapon-icon ${data.weaponsReady ? 'ready' : 'cooldown'}`}>
            ⚡
          </div>
          <div className="d1-weapon-label">
            {data.weaponsReady ? 'READY' : `${data.weaponCooldown}s`}
          </div>
        </div>
        <div className="d1-enemy-info">
          <div className="d1-enemy-label">TARGET</div>
          <div className="d1-enemy-stat">
            <label>HULL</label>
            <div className="d1-enemy-bar">
              <div 
                className="d1-bar-fill d1-enemy-hull" 
                style={{ width: `${getPercentage(data.enemyHull.current, data.enemyHull.max)}%` }}
              />
            </div>
          </div>
          <div className="d1-enemy-stat">
            <label>SHIELD</label>
            <div className="d1-enemy-bar">
              <div 
                className="d1-bar-fill d1-enemy-shield" 
                style={{ width: `${getPercentage(data.enemyShield.current, data.enemyShield.max)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Design 2: Retro Terminal Style
function Design2Retro({ data }: { data: MockBattleData }) {
  return (
    <div className="hud-design-2">
      <div className="d2-scanlines"></div>
      <div className="d2-content">
        <div className="d2-header">
          <span className="d2-blink">█</span> COMBAT SYSTEM ACTIVE <span className="d2-blink">█</span>
        </div>
        
        <div className="d2-main">
          <div className="d2-col">
            <div className="d2-section">
              <div className="d2-section-title">&gt;&gt; SHIP STATUS</div>
              <div className="d2-line">
                HULL.... [{makeBar(data.hull.current, data.hull.max)}] {data.hull.current}/{data.hull.max}
              </div>
              <div className="d2-line">
                ARMOR... [{makeBar(data.armor.current, data.armor.max)}] {data.armor.current}/{data.armor.max}
              </div>
              <div className="d2-line">
                SHIELD.. [{makeBar(data.shield.current, data.shield.max)}] {data.shield.current}/{data.shield.max}
              </div>
            </div>
            
            <div className="d2-section">
              <div className="d2-section-title">&gt;&gt; WEAPONS</div>
              <div className="d2-line">
                STATUS: {data.weaponsReady ? '[READY]' : `[CHARGING ${data.weaponCooldown}s]`}
              </div>
            </div>
          </div>

          <div className="d2-col">
            <div className="d2-radar">
              <div className="d2-radar-grid">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="d2-radar-line" style={{ transform: `rotate(${i * 45}deg)` }} />
                ))}
                {data.targetLocked && <div className="d2-target-blip">◆</div>}
              </div>
            </div>
            <div className="d2-distance-display">RANGE: {data.distance}m</div>
          </div>

          <div className="d2-col">
            <div className="d2-section">
              <div className="d2-section-title">&gt;&gt; TARGET</div>
              <div className="d2-line">
                LOCK... [{data.targetLocked ? '████████' : '░░░░░░░░'}]
              </div>
              <div className="d2-line">
                HULL.... [{makeBar(data.enemyHull.current, data.enemyHull.max)}] {data.enemyHull.current}
              </div>
              <div className="d2-line">
                SHIELD.. [{makeBar(data.enemyShield.current, data.enemyShield.max)}] {data.enemyShield.current}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Design 3: Military Tactical Interface
function Design3Military({ data }: { data: MockBattleData }) {
  return (
    <div className="hud-design-3">
      <div className="d3-corner d3-top-left"></div>
      <div className="d3-corner d3-top-right"></div>
      <div className="d3-corner d3-bottom-left"></div>
      <div className="d3-corner d3-bottom-right"></div>

      <div className="d3-top-bar">
        <div className="d3-status-indicator active">SYS ONLINE</div>
        <div className="d3-mission-time">MISSION TIME: 04:32</div>
        <div className="d3-threat-level">THREAT: HIGH</div>
      </div>

      <div className="d3-main-grid">
        <div className="d3-left-panel">
          <div className="d3-panel-title">SHIP INTEGRITY</div>
          <div className="d3-defense-item">
            <div className="d3-defense-header">
              <span className="d3-icon">■</span>
              <span>HULL</span>
              <span className="d3-value">{data.hull.current}/{data.hull.max}</span>
            </div>
            <div className="d3-defense-bar">
              <div 
                className="d3-defense-fill d3-hull-fill"
                style={{ width: `${(data.hull.current / data.hull.max) * 100}%` }}
              >
                <div className="d3-bar-glow"></div>
              </div>
            </div>
          </div>
          <div className="d3-defense-item">
            <div className="d3-defense-header">
              <span className="d3-icon">▣</span>
              <span>ARMOR</span>
              <span className="d3-value">{data.armor.current}/{data.armor.max}</span>
            </div>
            <div className="d3-defense-bar">
              <div 
                className="d3-defense-fill d3-armor-fill"
                style={{ width: `${(data.armor.current / data.armor.max) * 100}%` }}
              >
                <div className="d3-bar-glow"></div>
              </div>
            </div>
          </div>
          <div className="d3-defense-item">
            <div className="d3-defense-header">
              <span className="d3-icon">◈</span>
              <span>SHIELD</span>
              <span className="d3-value">{data.shield.current}/{data.shield.max}</span>
            </div>
            <div className="d3-defense-bar">
              <div 
                className="d3-defense-fill d3-shield-fill"
                style={{ width: `${(data.shield.current / data.shield.max) * 100}%` }}
              >
                <div className="d3-bar-glow"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="d3-center-panel">
          <div className="d3-targeting-reticle">
            <div className="d3-reticle-ring d3-outer-ring"></div>
            <div className="d3-reticle-ring d3-middle-ring"></div>
            <div className="d3-reticle-cross-h"></div>
            <div className="d3-reticle-cross-v"></div>
            {data.targetLocked && (
              <div className="d3-lock-indicator">
                <div className="d3-lock-bracket d3-tl"></div>
                <div className="d3-lock-bracket d3-tr"></div>
                <div className="d3-lock-bracket d3-bl"></div>
                <div className="d3-lock-bracket d3-br"></div>
                <span className="d3-lock-text">LOCKED</span>
              </div>
            )}
          </div>
          <div className="d3-range-info">RANGE: {data.distance}m</div>
        </div>

        <div className="d3-right-panel">
          <div className="d3-panel-title">WEAPONS & TARGET</div>
          <div className="d3-weapon-section">
            <div className={`d3-weapon-ready ${data.weaponsReady ? 'ready' : ''}`}>
              <div className="d3-weapon-circle">
                <svg width="60" height="60" viewBox="0 0 60 60">
                  <circle cx="30" cy="30" r="25" stroke="currentColor" strokeWidth="2" fill="none" />
                  {!data.weaponsReady && (
                    <circle 
                      cx="30" cy="30" r="25" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      fill="none"
                      strokeDasharray={`${(data.weaponCooldown / 10) * 157} 157`}
                      transform="rotate(-90 30 30)"
                    />
                  )}
                </svg>
                <span className="d3-weapon-icon">⚡</span>
              </div>
              <div className="d3-weapon-label">
                {data.weaponsReady ? 'WEAPONS HOT' : `COOLDOWN ${data.weaponCooldown}s`}
              </div>
            </div>
          </div>
          <div className="d3-target-section">
            <div className="d3-target-title">HOSTILE TARGET</div>
            <div className="d3-target-stat">
              <span>HULL</span>
              <div className="d3-target-bar">
                <div 
                  className="d3-target-fill d3-target-hull"
                  style={{ width: `${(data.enemyHull.current / data.enemyHull.max) * 100}%` }}
                />
              </div>
              <span>{data.enemyHull.current}</span>
            </div>
            <div className="d3-target-stat">
              <span>SHIELD</span>
              <div className="d3-target-bar">
                <div 
                  className="d3-target-fill d3-target-shield"
                  style={{ width: `${(data.enemyShield.current / data.enemyShield.max) * 100}%` }}
                />
              </div>
              <span>{data.enemyShield.current}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Design 4: Futuristic Holographic
function Design4Futuristic({ data }: { data: MockBattleData }) {
  return (
    <div className="hud-design-4">
      <div className="d4-glow-overlay"></div>
      
      <div className="d4-hexagon-grid"></div>

      <div className="d4-layout">
        <div className="d4-side d4-left">
          <div className="d4-hologram-panel">
            <div className="d4-panel-glow"></div>
            <div className="d4-stat-hologram">
              <div className="d4-stat-icon d4-hull-icon">
                <svg width="40" height="40" viewBox="0 0 40 40">
                  <polygon points="20,5 35,15 35,25 20,35 5,25 5,15" fill="none" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </div>
              <div className="d4-stat-info">
                <div className="d4-stat-label">HULL INTEGRITY</div>
                <div className="d4-stat-value">{Math.round((data.hull.current / data.hull.max) * 100)}%</div>
                <div className="d4-hologram-bar">
                  <div 
                    className="d4-hologram-fill d4-hull-glow"
                    style={{ width: `${(data.hull.current / data.hull.max) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="d4-stat-hologram">
              <div className="d4-stat-icon d4-armor-icon">
                <svg width="40" height="40" viewBox="0 0 40 40">
                  <rect x="8" y="8" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"/>
                  <rect x="12" y="12" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </div>
              <div className="d4-stat-info">
                <div className="d4-stat-label">ARMOR PLATING</div>
                <div className="d4-stat-value">{Math.round((data.armor.current / data.armor.max) * 100)}%</div>
                <div className="d4-hologram-bar">
                  <div 
                    className="d4-hologram-fill d4-armor-glow"
                    style={{ width: `${(data.armor.current / data.armor.max) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="d4-stat-hologram">
              <div className="d4-stat-icon d4-shield-icon">
                <svg width="40" height="40" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="12" fill="none" stroke="currentColor" strokeWidth="2"/>
                  <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2"/>
                </svg>
              </div>
              <div className="d4-stat-info">
                <div className="d4-stat-label">ENERGY SHIELD</div>
                <div className="d4-stat-value">{Math.round((data.shield.current / data.shield.max) * 100)}%</div>
                <div className="d4-hologram-bar">
                  <div 
                    className="d4-hologram-fill d4-shield-glow"
                    style={{ width: `${(data.shield.current / data.shield.max) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="d4-center">
          <div className="d4-holographic-reticle">
            <div className="d4-reticle-outer"></div>
            <div className="d4-reticle-mid"></div>
            <div className="d4-reticle-inner"></div>
            {data.targetLocked && (
              <>
                <div className="d4-lock-ring"></div>
                <div className="d4-lock-pulse"></div>
              </>
            )}
          </div>
          <div className="d4-distance-hologram">{data.distance} METERS</div>
        </div>

        <div className="d4-side d4-right">
          <div className="d4-hologram-panel">
            <div className="d4-panel-glow"></div>
            
            <div className="d4-weapon-hologram">
              <div className={`d4-weapon-orb ${data.weaponsReady ? 'd4-ready' : 'd4-charging'}`}>
                <div className="d4-orb-core"></div>
                <div className="d4-orb-ring"></div>
                <div className="d4-orb-particles"></div>
              </div>
              <div className="d4-weapon-status-text">
                {data.weaponsReady ? 'WEAPONS ARMED' : `CHARGING ${data.weaponCooldown}s`}
              </div>
            </div>

            <div className="d4-target-hologram">
              <div className="d4-target-header">HOSTILE SIGNATURE</div>
              <div className="d4-target-data">
                <div className="d4-target-row">
                  <span>HULL</span>
                  <div className="d4-target-bar-container">
                    <div 
                      className="d4-target-bar d4-enemy-hull-glow"
                      style={{ width: `${(data.enemyHull.current / data.enemyHull.max) * 100}%` }}
                    />
                  </div>
                  <span>{Math.round((data.enemyHull.current / data.enemyHull.max) * 100)}%</span>
                </div>
                <div className="d4-target-row">
                  <span>SHLD</span>
                  <div className="d4-target-bar-container">
                    <div 
                      className="d4-target-bar d4-enemy-shield-glow"
                      style={{ width: `${(data.enemyShield.current / data.enemyShield.max) * 100}%` }}
                    />
                  </div>
                  <span>{Math.round((data.enemyShield.current / data.enemyShield.max) * 100)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Design 5: Organic/Alien Interface
function Design5Organic({ data }: { data: MockBattleData }) {
  return (
    <div className="hud-design-5">
      <div className="d5-bio-background"></div>
      
      <div className="d5-container">
        <div className="d5-left-organism">
          <div className="d5-bio-label">VESSEL VITALITY</div>
          
          <div className="d5-bio-cell d5-hull-cell">
            <div className="d5-cell-nucleus"></div>
            <div className="d5-cell-membrane" style={{ 
              clipPath: `inset(${100 - (data.hull.current / data.hull.max) * 100}% 0 0 0)` 
            }}></div>
            <div className="d5-cell-content">
              <div className="d5-cell-label">HULL</div>
              <div className="d5-cell-value">{data.hull.current}</div>
            </div>
          </div>

          <div className="d5-bio-cell d5-armor-cell">
            <div className="d5-cell-nucleus"></div>
            <div className="d5-cell-membrane" style={{ 
              clipPath: `inset(${100 - (data.armor.current / data.armor.max) * 100}% 0 0 0)` 
            }}></div>
            <div className="d5-cell-content">
              <div className="d5-cell-label">ARMOR</div>
              <div className="d5-cell-value">{data.armor.current}</div>
            </div>
          </div>

          <div className="d5-bio-cell d5-shield-cell">
            <div className="d5-cell-nucleus"></div>
            <div className="d5-cell-membrane" style={{ 
              clipPath: `inset(${100 - (data.shield.current / data.shield.max) * 100}% 0 0 0)` 
            }}></div>
            <div className="d5-cell-content">
              <div className="d5-cell-label">SHIELD</div>
              <div className="d5-cell-value">{data.shield.current}</div>
            </div>
          </div>
        </div>

        <div className="d5-center-eye">
          <div className="d5-eye-outer">
            <div className="d5-eye-iris">
              <div className="d5-eye-pupil">
                {data.targetLocked && <div className="d5-eye-locked"></div>}
              </div>
              <div className="d5-eye-veins"></div>
            </div>
          </div>
          <div className="d5-distance-organic">{data.distance}m</div>
        </div>

        <div className="d5-right-organism">
          <div className="d5-bio-label">COMBAT STATUS</div>
          
          <div className="d5-weapon-organism">
            <div className={`d5-weapon-core ${data.weaponsReady ? 'd5-pulsing' : ''}`}>
              <div className="d5-weapon-tendrils">
                {[...Array(8)].map((_, i) => (
                  <div 
                    key={i} 
                    className="d5-tendril"
                    style={{ transform: `rotate(${i * 45}deg)` }}
                  />
                ))}
              </div>
              <div className="d5-weapon-text">
                {data.weaponsReady ? 'READY' : `${data.weaponCooldown}s`}
              </div>
            </div>
          </div>

          <div className="d5-target-organism">
            <div className="d5-bio-label d5-small">PREY DETECTED</div>
            <div className="d5-target-tendril">
              <div className="d5-target-segment">
                <span className="d5-target-label">HULL</span>
                <div className="d5-organic-bar">
                  <div 
                    className="d5-organic-fill d5-enemy-hull"
                    style={{ width: `${(data.enemyHull.current / data.enemyHull.max) * 100}%` }}
                  />
                </div>
              </div>
              <div className="d5-target-segment">
                <span className="d5-target-label">SHIELD</span>
                <div className="d5-organic-bar">
                  <div 
                    className="d5-organic-fill d5-enemy-shield"
                    style={{ width: `${(data.enemyShield.current / data.enemyShield.max) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function for retro design
function makeBar(current: number, max: number, length: number = 8): string {
  const filled = Math.round((current / max) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}
