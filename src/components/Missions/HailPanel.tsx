'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { getContact, type ContactId } from '@/shared/quests/npcArchetypes';
import type { QuestView } from '@/shared/quests/questViews';
import QuestCard, { type QuestCardActions } from './QuestCard';

interface HailPanelProps {
  /** Contacts in hail range, in display order. */
  contacts: readonly ContactId[];
  views: readonly QuestView[];
  actions: QuestCardActions;
}

/** Conversation with every mission contact in hail range: missions to report and missions on offer. */
const HailPanel: React.FC<HailPanelProps> = ({ contacts, views, actions }) => {
  const t = useTranslations('quests');
  if (contacts.length === 0) return null;

  return (
    <section className="hail-panel" data-testid="hail-panel">
      <h2 className="hail-panel__heading">{t('ui.hailHeading')}</h2>
      {contacts.map(contactId => {
        const reports = views.filter(view => view.status === 'active' && view.reportTo === contactId);
        const offers = views.filter(view => view.status === 'available' && view.quest.giver === contactId);
        return (
          <div key={contactId} className="hail-contact" data-testid={`hail-contact-${contactId}`}>
            <div className="hail-contact__header">
              <span className="hail-contact__name">{t(`contacts.${contactId}.name`)}</span>
              <span className="hail-contact__role">
                {t(`contacts.${contactId}.role`)} · {getContact(contactId).shipName}
              </span>
            </div>
            <blockquote className="quest-card__speech">
              {reports.length + offers.length > 0 ? t(`contacts.${contactId}.greeting`) : t('ui.hailNothing')}
            </blockquote>

            {reports.length > 0 && (
              <>
                <h3 className="hail-contact__section">{t('ui.hailReports')}</h3>
                <div className="quest-list">
                  {reports.map(view => (
                    <QuestCard key={view.quest.id} view={view} actions={actions} />
                  ))}
                </div>
              </>
            )}
            {offers.length > 0 && (
              <>
                <h3 className="hail-contact__section">{t('ui.hailOffers')}</h3>
                <div className="quest-list">
                  {offers.map(view => (
                    <QuestCard key={view.quest.id} view={view} actions={actions} />
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
};

export default HailPanel;
