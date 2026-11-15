'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { AchievementView } from '@/shared/quests/questViews';

interface AchievementsPanelProps {
  achievements: readonly AchievementView[];
}

/** All achievements with their tiers, the XP of each tier and the progress towards the next one. */
const AchievementsPanel: React.FC<AchievementsPanelProps> = ({ achievements }) => {
  const t = useTranslations('quests');
  const locale = useLocale();

  return (
    <div className="achievement-grid">
      {achievements.map(({ achievement, value, unlockedTiers, nextThreshold }) => {
        const maxed = nextThreshold === null;
        return (
          <article
            key={achievement.id}
            className={`achievement-card${unlockedTiers > 0 ? ' achievement-card--unlocked' : ''}`}
            data-testid={`achievement-${achievement.id}`}
          >
            <header className="achievement-card__header">
              <span className="achievement-card__icon" aria-hidden="true">{unlockedTiers > 0 ? '🏆' : '🔒'}</span>
              <h3 className="achievement-card__name">{t(`achievements.${achievement.id}.name`)}</h3>
              <span className="achievement-card__tier">
                {t('ui.tierLabel', { tier: `${unlockedTiers}/${achievement.tiers.length}` })}
              </span>
            </header>
            <p className="achievement-card__description">{t(`achievements.${achievement.id}.description`)}</p>
            <div className="quest-progress" aria-hidden="true">
              <div
                className="quest-progress__fill"
                style={{ width: `${maxed ? 100 : Math.min(100, (value / nextThreshold) * 100)}%` }}
              />
            </div>
            <div className="achievement-card__progress">
              {maxed
                ? t('ui.achievementMaxed', { value: value.toLocaleString(locale) })
                : t('ui.achievementProgress', { value: value.toLocaleString(locale), target: nextThreshold.toLocaleString(locale) })}
            </div>
            <ul className="achievement-card__tiers">
              {achievement.tiers.map((tier, index) => (
                <li key={tier.threshold} className={index < unlockedTiers ? 'achievement-card__tier--done' : undefined}>
                  {index < unlockedTiers ? '✓ ' : ''}
                  {t('ui.achievementTierXp', { threshold: tier.threshold, xp: tier.xp })}
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
};

export default AchievementsPanel;
