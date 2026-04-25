'use client';

import React from 'react';
import type { DefenseValues } from '@/shared/defenseValues';
import type { BattleStatus } from '@/lib/client/hooks/useBattleStatus';
import type { BattleEvent, BattleStats } from '@/lib/server/battle/battleTypes';

interface BattleMockupGalleryProps {
  battleStatus: BattleStatus | null;
  defenseValues: DefenseValues | null;
  isLoading: boolean;
}

interface MockupVariant {
  id: number;
  label: string;
  accent: string;
}

const MOCKUP_VARIANTS: MockupVariant[] = [
  { id: 1, label: 'Command Bridge', accent: 'overview' },
  { id: 2, label: 'Split Screen Duel', accent: 'split' },
  { id: 3, label: 'Damage Broadcast', accent: 'broadcast' },
  { id: 4, label: 'Combat Timeline', accent: 'timeline' },
  { id: 5, label: 'Systems Audit', accent: 'audit' },
  { id: 6, label: 'Cooldown Control', accent: 'cooldowns' },
  { id: 7, label: 'Compact Briefing', accent: 'briefing' },
  { id: 8, label: 'Stacked Cards', accent: 'stacked' },
  { id: 9, label: 'Raw Telemetry', accent: 'telemetry' },
  { id: 10, label: 'Executive Debrief', accent: 'debrief' },
];

/**
 * Formats Unix timestamps expressed in whole seconds.
 * Battle timestamps from the API/backend model use seconds, not milliseconds.
 */
function formatTimestamp(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return '—';
  }

  return new Date(timestamp * 1000).toLocaleString();
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return 'Waiting for live battle';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

function formatSignedDelta(value: number): string {
  if (value === 0) {
    return '±0';
  }

  return value > 0 ? `+${value}` : `${value}`;
}

function formatEventLabel(event: BattleEvent): string {
  const actor = event.actor === 'attacker' ? 'Attacker' : 'Defender';
  const weapon = typeof event.data.weaponType === 'string'
    ? event.data.weaponType.replace(/_/g, ' ')
    : null;
  const damage = typeof event.data.damageDealt === 'number'
    ? ` for ${Math.round(event.data.damageDealt)}`
    : '';

  switch (event.type) {
    case 'battle_started':
      return event.data.message ?? 'Battle started';
    case 'battle_ended':
      return event.data.message ?? 'Battle ended';
    case 'shot_fired':
      return `${actor} fired${weapon ? ` ${weapon}` : ''}`;
    case 'damage_dealt':
      return `${actor} hit${weapon ? ` with ${weapon}` : ''}${damage}`;
    case 'shield_broken':
      return `${actor} broke shields`;
    case 'armor_broken':
      return `${actor} broke armor`;
    case 'hull_destroyed':
      return `${actor} destroyed hull`;
    default:
      return 'Battle status update';
  }
}

function formatBattleStats(stats: BattleStats | null | undefined): Array<{ label: string; value: string }> {
  if (!stats) {
    return [
      { label: 'Hull', value: '—' },
      { label: 'Armor', value: '—' },
      { label: 'Shield', value: '—' },
    ];
  }

  return [
    { label: 'Hull', value: `${stats.hull.current}/${stats.hull.max}` },
    { label: 'Armor', value: `${stats.armor.current}/${stats.armor.max}` },
    { label: 'Shield', value: `${stats.shield.current}/${stats.shield.max}` },
  ];
}

function formatCurrentDefenses(defenseValues: DefenseValues | null): Array<{ label: string; value: string }> {
  if (!defenseValues) {
    return [
      { label: 'Hull', value: '—' },
      { label: 'Armor', value: '—' },
      { label: 'Shield', value: '—' },
    ];
  }

  return [
    { label: 'Hull', value: `${defenseValues.hull.current}/${defenseValues.hull.max}` },
    { label: 'Armor', value: `${defenseValues.armor.current}/${defenseValues.armor.max}` },
    { label: 'Shield', value: `${defenseValues.shield.current}/${defenseValues.shield.max}` },
  ];
}

export default function BattleMockupGallery({
  battleStatus,
  defenseValues,
  isLoading,
}: BattleMockupGalleryProps) {
  const [selectedVariantId, setSelectedVariantId] = React.useState<number>(1);
  const [currentTimeMs, setCurrentTimeMs] = React.useState<number>(() => Date.now());

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const battle = battleStatus?.battle;
  const isLiveBattle = Boolean(battleStatus?.inBattle && battle);
  const runningForSeconds = battle ? Math.max(0, Math.floor(currentTimeMs / 1000) - battle.battleStartTime) : null;
  const selectedVariant = MOCKUP_VARIANTS.find((variant) => variant.id === selectedVariantId) ?? MOCKUP_VARIANTS[0];
  const cooldowns = battle ? Object.entries(battle.weaponCooldowns) : [];
  const recentEvents = battle?.battleLog.slice(-4).reverse() ?? [];
  const firstEvent = battle?.battleLog[0];
  const latestEvent = battle?.battleLog.at(-1);
  const currentDefenses = React.useMemo(() => formatCurrentDefenses(defenseValues), [defenseValues]);
  const myStartStats = React.useMemo(() => formatBattleStats(battle?.myStartStats), [battle?.myStartStats]);
  const opponentStartStats = React.useMemo(() => formatBattleStats(battle?.opponentStartStats), [battle?.opponentStartStats]);
  const myEndStats = React.useMemo(() => formatBattleStats(battle?.myEndStats), [battle?.myEndStats]);
  const opponentEndStats = React.useMemo(() => formatBattleStats(battle?.opponentEndStats), [battle?.opponentEndStats]);
  const damageLead = battle ? Math.round(battle.myTotalDamage - battle.opponentTotalDamage) : 0;
  const eventTypeCounts = React.useMemo(() => {
    return battle?.battleLog.reduce<Record<string, number>>((accumulator, event) => {
      accumulator[event.type] = (accumulator[event.type] ?? 0) + 1;
      return accumulator;
    }, {}) ?? {};
  }, [battle?.battleLog]);

  const backendFieldCards: Array<{ field: string; value: string; source: string }> = React.useMemo(() => [
    { field: 'battle.id', value: battle ? String(battle.id) : 'Waiting for battle', source: 'active battle API' },
    { field: 'battle.battleStartTime', value: formatTimestamp(battle?.battleStartTime), source: 'active battle API' },
    { field: 'battle.battleEndTime', value: formatTimestamp(battle?.battleEndTime), source: 'active battle API / null in live battle' },
    { field: 'battle.winnerId', value: battle?.winnerId ? String(battle.winnerId) : 'Pending', source: 'active battle API / persisted model' },
    { field: 'battle.loserId', value: battle?.loserId ? String(battle.loserId) : 'Pending', source: 'active battle API / persisted model' },
    { field: 'battle.battleLog[]', value: `${battle?.battleLog.length ?? 0} events`, source: 'active battle API' },
    { field: 'battle.weaponCooldowns', value: `${cooldowns.length} weapons`, source: 'active battle API' },
    { field: 'battle.myStartStats', value: myStartStats.map((item) => `${item.label} ${item.value}`).join(' · '), source: 'persisted model snapshot' },
    { field: 'battle.opponentStartStats', value: opponentStartStats.map((item) => `${item.label} ${item.value}`).join(' · '), source: 'persisted model snapshot' },
    { field: 'battle.myEndStats', value: myEndStats.map((item) => `${item.label} ${item.value}`).join(' · '), source: 'persisted model snapshot / available after battle ends' },
    { field: 'battle.opponentEndStats', value: opponentEndStats.map((item) => `${item.label} ${item.value}`).join(' · '), source: 'persisted model snapshot / available after battle ends' },
  ], [battle, cooldowns.length, myStartStats, opponentStartStats, myEndStats, opponentEndStats]);

  const renderSnapshotTable = (title: string, snapshot: Array<{ label: string; value: string }>) => (
    <div className="battle-mockup-panel">
      <div className="battle-mockup-panel-title">{title}</div>
      <div className="battle-mockup-mini-grid">
        {snapshot.map((item) => (
          <div key={`${title}-${item.label}`} className="battle-mockup-mini-stat">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );

  const renderVariantContent = () => {
    switch (selectedVariant.id) {
      case 1:
        return (
          <div className="battle-mockup-layout battle-mockup-layout--overview">
            <div className="battle-mockup-hero">
              <span className="battle-mockup-kicker">Live battle headline</span>
              <h3>{isLiveBattle ? 'Battle in progress' : 'Battle mockup preview'}</h3>
              <p>
                {battle
                  ? `${battle.isAttacker ? 'Attacking' : 'Defending against'} opponent #${battle.opponentId}`
                  : 'No active battle at the moment — live values populate here automatically.'}
              </p>
            </div>
            <div className="battle-mockup-card-grid">
              <div className="battle-mockup-metric-card">
                <span>Running for</span>
                <strong>{formatDuration(runningForSeconds)}</strong>
              </div>
              <div className="battle-mockup-metric-card">
                <span>Your damage</span>
                <strong>{battle ? Math.round(battle.myTotalDamage) : '—'}</strong>
              </div>
              <div className="battle-mockup-metric-card">
                <span>Opponent damage</span>
                <strong>{battle ? Math.round(battle.opponentTotalDamage) : '—'}</strong>
              </div>
              <div className="battle-mockup-metric-card">
                <span>Logged events</span>
                <strong>{battle?.battleLog.length ?? 0}</strong>
              </div>
            </div>
            {renderSnapshotTable('Current ship defenses', currentDefenses)}
          </div>
        );
      case 2:
        return (
          <div className="battle-mockup-layout battle-mockup-layout--split">
            <div className="battle-mockup-side battle-mockup-side--mine">
              <div className="battle-mockup-panel-title">You</div>
              <div className="battle-mockup-big-number">{battle ? Math.round(battle.myTotalDamage) : '—'}</div>
              <div className="battle-mockup-side-caption">Role: {battle?.isAttacker ? 'Attacker' : battle ? 'Defender' : 'Pending'}</div>
              {renderSnapshotTable('Start snapshot', myStartStats)}
            </div>
            <div className="battle-mockup-side battle-mockup-side--opponent">
              <div className="battle-mockup-panel-title">Opponent #{battle?.opponentId ?? '—'}</div>
              <div className="battle-mockup-big-number">{battle ? Math.round(battle.opponentTotalDamage) : '—'}</div>
              <div className="battle-mockup-side-caption">Damage exchanged so far</div>
              {renderSnapshotTable('Opponent start snapshot', opponentStartStats)}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="battle-mockup-layout battle-mockup-layout--broadcast">
            <div className="battle-mockup-banner-strip">
              <span>Damage race</span>
              <strong>{battle ? formatSignedDelta(damageLead) : '±0'}</strong>
            </div>
            <div className="battle-mockup-progress-compare">
              <div>
                <label>Your total damage</label>
                <progress max={Math.max(1, battle?.myTotalDamage ?? 1, battle?.opponentTotalDamage ?? 1)} value={battle?.myTotalDamage ?? 0} />
                <span>{battle ? Math.round(battle.myTotalDamage) : '—'}</span>
              </div>
              <div>
                <label>Opponent total damage</label>
                <progress max={Math.max(1, battle?.myTotalDamage ?? 1, battle?.opponentTotalDamage ?? 1)} value={battle?.opponentTotalDamage ?? 0} />
                <span>{battle ? Math.round(battle.opponentTotalDamage) : '—'}</span>
              </div>
            </div>
            <div className="battle-mockup-inline-notes">
              <span>Started: {formatTimestamp(battle?.battleStartTime)}</span>
              <span>Latest event: {latestEvent ? formatEventLabel(latestEvent) : 'No events yet'}</span>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="battle-mockup-layout battle-mockup-layout--timeline">
            <div className="battle-mockup-panel">
              <div className="battle-mockup-panel-title">Recent battle log</div>
              <ul className="battle-mockup-timeline">
                {recentEvents.length === 0 ? (
                  <li className="battle-mockup-empty">No battle events recorded yet.</li>
                ) : (
                  recentEvents.map((event) => (
                    <li key={`${event.timestamp}-${event.type}`} className="battle-mockup-timeline-item">
                      <span>{formatTimestamp(event.timestamp)}</span>
                      <strong>{formatEventLabel(event)}</strong>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="battle-mockup-panel">
              <div className="battle-mockup-panel-title">Event anchors</div>
              <div className="battle-mockup-mini-grid">
                <div className="battle-mockup-mini-stat">
                  <span>First event</span>
                  <strong>{firstEvent ? formatEventLabel(firstEvent) : '—'}</strong>
                </div>
                <div className="battle-mockup-mini-stat">
                  <span>Latest event</span>
                  <strong>{latestEvent ? formatEventLabel(latestEvent) : '—'}</strong>
                </div>
                <div className="battle-mockup-mini-stat">
                  <span>Running for</span>
                  <strong>{formatDuration(runningForSeconds)}</strong>
                </div>
              </div>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="battle-mockup-layout battle-mockup-layout--audit">
            <table className="battle-mockup-comparison-table">
              <thead>
                <tr>
                  <th>System</th>
                  <th>Your start</th>
                  <th>Opponent start</th>
                  <th>Your current</th>
                </tr>
              </thead>
              <tbody>
                {currentDefenses.map((item, index) => (
                  <tr key={item.label}>
                    <td>{item.label}</td>
                    <td>{myStartStats[index]?.value ?? '—'}</td>
                    <td>{opponentStartStats[index]?.value ?? '—'}</td>
                    <td>{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 6:
        return (
          <div className="battle-mockup-layout battle-mockup-layout--cooldowns">
            <div className="battle-mockup-panel">
              <div className="battle-mockup-panel-title">Weapon cooldown wall</div>
              <div className="battle-mockup-cooldown-grid">
                {cooldowns.length === 0 ? (
                  <div className="battle-mockup-empty">No weapon cooldowns exposed yet.</div>
                ) : (
                  cooldowns.map(([weapon, timestamp]) => (
                    <div key={weapon} className="battle-mockup-cooldown-card">
                      <span>{weapon.replace(/_/g, ' ')}</span>
                      <strong>{formatDuration(Math.max(0, timestamp - Math.floor(currentTimeMs / 1000)))}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>
            {renderSnapshotTable('Current defenses', currentDefenses)}
          </div>
        );
      case 7:
        return (
          <div className="battle-mockup-layout battle-mockup-layout--briefing">
            <div className="battle-mockup-list-row">
              <span>Battle #{battle?.id ?? '—'}</span>
              <span>{battle?.isAttacker ? 'Attacker posture' : battle ? 'Defender posture' : 'Standby posture'}</span>
              <span>Opponent #{battle?.opponentId ?? '—'}</span>
            </div>
            <div className="battle-mockup-list-row">
              <span>Started {formatTimestamp(battle?.battleStartTime)}</span>
              <span>Running {formatDuration(runningForSeconds)}</span>
              <span>{battle?.battleLog.length ?? 0} logged events</span>
            </div>
            <div className="battle-mockup-list-row">
              <span>Your damage {battle ? Math.round(battle.myTotalDamage) : '—'}</span>
              <span>Opponent damage {battle ? Math.round(battle.opponentTotalDamage) : '—'}</span>
              <span>Lead {battle ? formatSignedDelta(damageLead) : '±0'}</span>
            </div>
          </div>
        );
      case 8:
        return (
          <div className="battle-mockup-layout battle-mockup-layout--stacked">
            {renderSnapshotTable('Your current defenses', currentDefenses)}
            {renderSnapshotTable('Your start snapshot', myStartStats)}
            {renderSnapshotTable('Opponent start snapshot', opponentStartStats)}
          </div>
        );
      case 9:
        return (
          <div className="battle-mockup-layout battle-mockup-layout--telemetry">
            <pre className="battle-mockup-terminal">
{`battle.id: ${battle?.id ?? 'null'}
battle.isAttacker: ${battle?.isAttacker ?? 'null'}
battle.opponentId: ${battle?.opponentId ?? 'null'}
battleStartTime: ${battle?.battleStartTime ?? 'null'}
battleEndTime: ${battle?.battleEndTime ?? 'null'}
winnerId: ${battle?.winnerId ?? 'null'}
loserId: ${battle?.loserId ?? 'null'}
myTotalDamage: ${battle ? Math.round(battle.myTotalDamage) : 'null'}
opponentTotalDamage: ${battle ? Math.round(battle.opponentTotalDamage) : 'null'}
battleLogCount: ${battle?.battleLog.length ?? 0}
cooldownCount: ${cooldowns.length}`}
            </pre>
          </div>
        );
      case 10:
        return (
          <div className="battle-mockup-layout battle-mockup-layout--debrief">
            <div className="battle-mockup-panel">
              <div className="battle-mockup-panel-title">Executive readout</div>
              <p className="battle-mockup-summary">
                {battle
                  ? `Battle ${battle.id} has been running for ${formatDuration(runningForSeconds)}. You have dealt ${Math.round(battle.myTotalDamage)} damage versus ${Math.round(battle.opponentTotalDamage)} coming back from opponent #${battle.opponentId}.`
                  : 'This slot stays visible even without an active battle so you can review layout directions before wiring anything in.'}
              </p>
            </div>
            <div className="battle-mockup-chip-row">
              {Object.entries(eventTypeCounts).length === 0 ? (
                <span className="battle-mockup-chip">No event types yet</span>
              ) : (
                Object.entries(eventTypeCounts).map(([eventType, count]) => (
                  <span key={eventType} className="battle-mockup-chip">
                    {eventType.replace(/_/g, ' ')} × {count}
                  </span>
                ))
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <section id="battle-status" className={`battle-mockup-shell battle-mockup-shell--${selectedVariant.accent}`}>
      <div className="battle-mockup-header">
        <div>
          <p className="battle-mockup-eyebrow">Battle Mockup Lab</p>
          <h2>10 alternative battle displays on top of the home page</h2>
          <p className="battle-mockup-subtitle">
            {isLoading
              ? 'Loading live battle data...'
              : isLiveBattle
                ? 'Connected to live battle data where the backend already exposes it.'
                : 'No live battle right now — layouts remain visible and mark unavailable fields clearly.'}
          </p>
        </div>
        <div className="battle-mockup-status-pill">
          {isLiveBattle ? 'LIVE DATA' : 'MOCKUP MODE'}
        </div>
      </div>

      <div className="battle-mockup-selector" role="tablist" aria-label="Battle display mockups">
        {MOCKUP_VARIANTS.map((variant) => (
          <button
            key={variant.id}
            type="button"
            role="tab"
            aria-selected={variant.id === selectedVariant.id}
            aria-label={`Design ${variant.id}: ${variant.label}`}
            className={`battle-mockup-selector-button ${variant.id === selectedVariant.id ? 'is-active' : ''}`}
            onClick={() => setSelectedVariantId(variant.id)}
          >
            <span>{variant.id}</span>
            <strong>{variant.label}</strong>
          </button>
        ))}
      </div>

      <div className="battle-mockup-frame">
        <div className="battle-mockup-frame-header">
          <span>{`Design ${selectedVariant.id}`}</span>
          <strong>{selectedVariant.label}</strong>
        </div>
        {renderVariantContent()}
      </div>

      <div className="battle-mockup-footer">
        <div className="battle-mockup-panel">
          <div className="battle-mockup-panel-title">Already available in the backend/model</div>
          <div className="battle-mockup-field-grid">
            {backendFieldCards.map((card) => (
              <div key={card.field} className="battle-mockup-field-card">
                <span>{card.field}</span>
                <strong>{card.value}</strong>
                <small>{card.source}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="battle-mockup-footer-note">
          Real values are used whenever the live battle API already exposes them; otherwise these mockups intentionally stay as inspectable shells.
        </div>
      </div>
    </section>
  );
}
