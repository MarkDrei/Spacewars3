'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LOCATIONS } from '@/shared/quests/locations';
import { CONTACTS, isContactId } from '@/shared/quests/npcArchetypes';
import type { AdminQuestAction, AdminQuestParams } from '@/lib/client/services/questService';

interface MissionAdminToolsProps {
  busy: boolean;
  onAction: (action: AdminQuestAction, params?: AdminQuestParams) => void;
}

/**
 * Test tools for developers: reset the mission progress, bring back hostile ships and jump to a
 * contact or location. The per-mission tools (force accept, fulfil, force report) are on the cards.
 */
const MissionAdminTools: React.FC<MissionAdminToolsProps> = ({ busy, onAction }) => {
  const t = useTranslations('quests');
  const [jumpTarget, setJumpTarget] = useState<string>(CONTACTS[0].id);

  const jump = () => {
    if (isContactId(jumpTarget)) {
      onAction('jump', { contactId: jumpTarget });
      return;
    }
    const location = LOCATIONS.find(candidate => candidate.id === jumpTarget);
    if (location) onAction('jump', { locationId: location.id });
  };

  return (
    <details className="mission-admin" data-testid="mission-admin-tools">
      <summary>{t('ui.admin.heading')}</summary>
      <p className="mission-admin__hint">{t('ui.admin.hint')}</p>
      <div className="mission-admin__row">
        <button
          type="button"
          className="mission-btn mission-btn--danger"
          disabled={busy}
          onClick={() => {
            if (window.confirm(t('ui.admin.resetConfirm'))) onAction('reset');
          }}
        >
          {t('ui.admin.reset')}
        </button>
        <button type="button" className="mission-btn" disabled={busy} onClick={() => onAction('respawnNpcs')}>
          {t('ui.admin.respawnNpcs')}
        </button>
        <label className="mission-admin__jump">
          {t('ui.admin.jumpTo')}
          <select value={jumpTarget} onChange={event => setJumpTarget(event.target.value)}>
            <optgroup label={t('ui.sectorContacts')}>
              {CONTACTS.map(contact => (
                <option key={contact.id} value={contact.id}>
                  {t(`contacts.${contact.id}.name`)}
                </option>
              ))}
            </optgroup>
            <optgroup label={t('ui.sectorLocations')}>
              {LOCATIONS.map(location => (
                <option key={location.id} value={location.id}>
                  {t(`locations.${location.id}.name`)}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <button type="button" className="mission-btn" disabled={busy} onClick={jump} aria-label={t('ui.admin.jumpTo')}>
          ➜
        </button>
      </div>
    </details>
  );
};

export default MissionAdminTools;
