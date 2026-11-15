'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { LOCATIONS, LOCATION_DISCOVERY_XP, type LocationId } from '@/shared/quests/locations';
import { CONTACTS, HOSTILE_ARCHETYPE_IDS, type ContactId } from '@/shared/quests/npcArchetypes';
import { contactWhereText } from './missionTexts';

interface SectorPanelProps {
  discovered: readonly LocationId[];
  contactsInRange: readonly ContactId[];
}

/** Guide to the sector: who hands out missions and where, the named locations and the hostile ships. */
const SectorPanel: React.FC<SectorPanelProps> = ({ discovered, contactsInRange }) => {
  const t = useTranslations('quests');

  return (
    <div className="sector-panel">
      <section>
        <h2 className="missions-section__title">{t('ui.sectorContacts')}</h2>
        <div className="sector-grid">
          {CONTACTS.map(contact => (
            <article key={contact.id} className="sector-card sector-card--contact">
              <h3 className="sector-card__name">
                {t(`contacts.${contact.id}.name`)}
                {contactsInRange.includes(contact.id) && (
                  <span className="sector-card__badge sector-card__badge--in-range">{t('ui.sectorInRange')}</span>
                )}
              </h3>
              <p className="sector-card__text">{t(`contacts.${contact.id}.role`)}</p>
              <p className="sector-card__where">{contactWhereText(t, contact.id)}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="missions-section__title">{t('ui.sectorLocations')}</h2>
        <p className="missions-section__summary">{t('ui.sectorDiscoveryHint', { xp: LOCATION_DISCOVERY_XP })}</p>
        <div className="sector-grid">
          {LOCATIONS.map(location => {
            const isDiscovered = discovered.includes(location.id);
            return (
              <article
                key={location.id}
                className={`sector-card sector-card--${location.kind}`}
                data-testid={`sector-location-${location.id}`}
              >
                <h3 className="sector-card__name">
                  {t(`locations.${location.id}.name`)}
                  <span
                    className={`sector-card__badge ${isDiscovered ? 'sector-card__badge--discovered' : 'sector-card__badge--unknown'}`}
                  >
                    {isDiscovered ? t('ui.sectorDiscovered') : t('ui.sectorUndiscovered')}
                  </span>
                </h3>
                <p className="sector-card__text">{t(`locations.${location.id}.description`)}</p>
                <p className="sector-card__where">{t('ui.sectorCoordinates', { x: location.x, y: location.y })}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="missions-section__title">{t('ui.sectorHostiles')}</h2>
        <div className="sector-grid">
          {HOSTILE_ARCHETYPE_IDS.map(archetypeId => (
            <article key={archetypeId} className="sector-card sector-card--hostile">
              <h3 className="sector-card__name">{t(`hostiles.${archetypeId}.name`)}</h3>
              <p className="sector-card__text">{t(`hostiles.${archetypeId}.description`)}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default SectorPanel;
