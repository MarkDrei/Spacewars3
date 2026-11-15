'use client';

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { ContactId } from '@/shared/quests/npcArchetypes';
import type { QuestOverview } from '@/shared/quests/questTypes';
import { objectiveText } from '@/shared/quests/questTexts';
import { buildQuestViews } from '@/shared/quests/questViews';
import './QuestTracker.css';

interface QuestTrackerProps {
  overview: QuestOverview | null;
  /** Contacts whose ship is within hail range right now. */
  contactsInRange: readonly ContactId[];
  open: boolean;
  onToggle: () => void;
  /** Opens the mission log, optionally with the conversation of a contact. */
  onOpenMissions: (contactId?: ContactId) => void;
}

/**
 * Overlay on the game map: the active missions with the progress of their current step, and a
 * hail button for every mission contact in range.
 */
const QuestTracker: React.FC<QuestTrackerProps> = ({ overview, contactsInRange, open, onToggle, onOpenMissions }) => {
  const t = useTranslations('game');
  const tq = useTranslations('quests');

  const activeQuests = useMemo(
    () =>
      overview
        ? buildQuestViews(overview.state, overview.level, overview.cargo).filter(view => view.status === 'active')
        : [],
    [overview]
  );

  return (
    <div className="quest-tracker" data-testid="quest-tracker">
      <button
        type="button"
        className="quest-tracker__header"
        onClick={onToggle}
        aria-expanded={open}
        title={t('trackerToggle')}
      >
        <span>📜 {t('trackerHeading')}</span>
        <span className="quest-tracker__count">{activeQuests.length}</span>
        <span className="quest-tracker__chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>

      {contactsInRange.map(contactId => (
        <button
          key={contactId}
          type="button"
          className="quest-tracker__hail"
          onClick={() => onOpenMissions(contactId)}
        >
          {t('trackerHail', { contact: tq(`contacts.${contactId}.name`) })}
        </button>
      ))}

      {open && (
        <div className="quest-tracker__body">
          {activeQuests.length === 0 && <div className="quest-tracker__empty">{t('trackerEmpty')}</div>}

          {activeQuests.map(view => (
            <div key={view.quest.id} className="quest-tracker__quest">
              <div className="quest-tracker__title">{tq(`quest.${view.quest.id}.title`)}</div>
              <ul className="quest-tracker__objectives">
                {view.objectives.map((objective, index) => (
                  <li key={index} className={objective.done ? 'quest-tracker__objective--done' : undefined}>
                    <span>{objectiveText(tq, objective.objective)}</span>
                    <span className="quest-tracker__progress">
                      {objective.done ? '✓' : `${objective.current}/${objective.target}`}
                    </span>
                  </li>
                ))}
                {view.readyToReport && view.reportTo && (
                  <li className="quest-tracker__objective--report">
                    {t('trackerReady', { contact: tq(`contacts.${view.reportTo}.name`) })}
                  </li>
                )}
              </ul>
            </div>
          ))}

          <button type="button" className="quest-tracker__open" onClick={() => onOpenMissions()}>
            {t('trackerOpen')}
          </button>
        </div>
      )}
    </div>
  );
};

export default QuestTracker;
