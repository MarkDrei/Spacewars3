'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getContact, type ContactId } from '@/shared/quests/npcArchetypes';
import { objectiveText } from '@/shared/quests/questTexts';
import type { QuestView } from '@/shared/quests/questViews';
import { contactWhereText } from './missionTexts';

export interface QuestCardActions {
  /** An action is running; all buttons are disabled meanwhile. */
  busy: boolean;
  contactsInRange: readonly ContactId[];
  onAccept: (questId: string) => void;
  onReport: (questId: string, contactId: ContactId) => void;
  onAbandon: (questId: string) => void;
  /** Test tools, only for developers. */
  admin?: {
    onForceAccept: (questId: string) => void;
    onFulfil: (questId: string) => void;
    onForceReport: (questId: string) => void;
  };
}

interface QuestCardProps {
  view: QuestView;
  actions: QuestCardActions;
}

/** One mission with what the player needs in its current state: briefing, objectives, rewards, actions. */
const QuestCard: React.FC<QuestCardProps> = ({ view, actions }) => {
  const t = useTranslations('quests');
  const locale = useLocale();
  const { quest, status } = view;
  const title = t(`quest.${quest.id}.title`);
  const giverInRange = actions.contactsInRange.includes(quest.giver);
  const reportInRange = view.reportTo !== null && actions.contactsInRange.includes(view.reportTo);
  const badge = view.readyToReport ? 'ready' : status;

  const tag = quest.chapter
    ? t('ui.tagStory', { number: quest.chapter })
    : quest.repeatable
      ? t('ui.tagContract')
      : t('ui.tagSide');

  const rewardParts = [
    t('ui.rewardXp', { xp: quest.rewards.xp.toLocaleString(locale) }),
    t('ui.rewardIron', { iron: quest.rewards.iron.toLocaleString(locale) }),
    ...(quest.rewards.commander ? [t('ui.rewardCommander')] : []),
  ];

  return (
    <article className={`quest-card quest-card--${badge}`} data-testid={`quest-card-${quest.id}`}>
      <header className="quest-card__header">
        <h3 className="quest-card__title">{title}</h3>
        <span className="quest-card__tag">{tag}</span>
        <span className={`quest-card__status quest-card__status--${badge}`}>
          {badge === 'ready' && t('ui.statusReady')}
          {badge === 'locked' && t('ui.statusLocked')}
          {badge === 'available' && t('ui.statusAvailable')}
          {badge === 'active' && t('ui.statusActive')}
          {badge === 'completed' && t('ui.statusCompleted')}
        </span>
      </header>

      {status === 'locked' && (
        <p className="quest-card__requires">
          {t('ui.requires')}{' '}
          {[
            ...view.missing.quests.map(questId => t('ui.requiresQuest', { quest: t(`quest.${questId}.title`) })),
            ...(view.missing.minLevel !== null ? [t('ui.requiresLevel', { level: view.missing.minLevel })] : []),
          ].join(', ')}
        </p>
      )}

      {status === 'available' && <blockquote className="quest-card__speech">{t(`quest.${quest.id}.offer`)}</blockquote>}

      {status === 'active' && (
        <div className="quest-card__stage">
          {quest.stages.length > 1 && (
            <div className="quest-card__step">
              {t('ui.stageOf', { current: view.stage + 1, total: quest.stages.length })}
            </div>
          )}
          <p className="quest-card__stage-text">{t(`quest.${quest.id}.stages.${view.stage + 1}`)}</p>
          <ul className="quest-card__objectives">
            {view.objectives.map((objective, index) => (
              <li key={index} className={objective.done ? 'quest-card__objective--done' : undefined}>
                <div className="quest-card__objective-line">
                  <span>{objectiveText(t, objective.objective)}</span>
                  <span className="quest-card__objective-count">
                    {objective.done ? '✓ ' : ''}
                    {objective.current}/{objective.target}
                  </span>
                </div>
                <div className="quest-progress" aria-hidden="true">
                  <div
                    className="quest-progress__fill"
                    style={{ width: `${Math.min(100, (objective.current / objective.target) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
            {view.reportTo && (
              <li className={view.readyToReport ? 'quest-card__objective--report' : undefined}>
                {t('objectives.reportOnly', { contact: t(`contacts.${view.reportTo}.name`) })}
                <span className="quest-card__where"> — {contactWhereText(t, view.reportTo)}</span>
              </li>
            )}
          </ul>
        </div>
      )}

      {status === 'completed' && (
        <blockquote className="quest-card__speech quest-card__speech--done">
          {t(`quest.${quest.id}.completion`)}
        </blockquote>
      )}

      {(status === 'available' || status === 'locked') && (
        <p className="quest-card__giver">
          {t('ui.offeredBy', { contact: t(`contacts.${quest.giver}.name`) })}
          <span className="quest-card__where"> — {contactWhereText(t, quest.giver)}</span>
        </p>
      )}

      <footer className="quest-card__footer">
        <span className="quest-card__rewards">
          {t('ui.rewards')}: {rewardParts.join(' · ')}
        </span>
        {view.completions > 0 && quest.repeatable && (
          <span className="quest-card__completions">{t('ui.completedTimes', { count: view.completions })}</span>
        )}
      </footer>
      {quest.rewards.commander && status !== 'completed' && (
        <p className="quest-card__hint">{t('ui.rewardCommanderHint')}</p>
      )}

      {(status === 'available' || status === 'active') && (
        <div className="quest-card__actions">
          {status === 'available' && (
            <>
              <button
                type="button"
                className="mission-btn mission-btn--primary"
                disabled={actions.busy || !giverInRange}
                onClick={() => actions.onAccept(quest.id)}
              >
                {t('ui.accept')}
              </button>
              {!giverInRange && (
                <span className="quest-card__hint">
                  {t('ui.acceptOutOfRange', { ship: getContact(quest.giver).shipName })}
                </span>
              )}
            </>
          )}
          {status === 'active' && view.readyToReport && view.reportTo && (
            <>
              <button
                type="button"
                className="mission-btn mission-btn--primary"
                disabled={actions.busy || !reportInRange}
                onClick={() => actions.onReport(quest.id, view.reportTo!)}
              >
                {t('ui.report')}
              </button>
              {!reportInRange && (
                <span className="quest-card__hint">
                  {t('ui.reportOutOfRange', { ship: getContact(view.reportTo).shipName })}
                </span>
              )}
            </>
          )}
          {status === 'active' && (
            <button
              type="button"
              className="mission-btn mission-btn--danger"
              disabled={actions.busy}
              onClick={() => {
                if (window.confirm(t('ui.abandonConfirm', { quest: title }))) actions.onAbandon(quest.id);
              }}
            >
              {t('ui.abandon')}
            </button>
          )}
        </div>
      )}

      {actions.admin && (
        <div className="quest-card__admin">
          {status !== 'active' && (
            <button type="button" disabled={actions.busy} onClick={() => actions.admin!.onForceAccept(quest.id)}>
              {t('ui.admin.forceAccept')}
            </button>
          )}
          {status === 'active' && (
            <>
              <button type="button" disabled={actions.busy} onClick={() => actions.admin!.onFulfil(quest.id)}>
                {t('ui.admin.fulfil')}
              </button>
              <button type="button" disabled={actions.busy} onClick={() => actions.admin!.onForceReport(quest.id)}>
                {t('ui.admin.forceReport')}
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
};

export default QuestCard;
