import { getLocation } from '@/shared/quests/locations';
import { getContact, type ContactId } from '@/shared/quests/npcArchetypes';
import type { QuestTranslate } from '@/shared/quests/questTexts';

/** Where a contact can be found: "ISV Ledger, near Ironstrike Station (4000, 4000)". */
export function contactWhereText(t: QuestTranslate, contactId: ContactId): string {
  const contact = getContact(contactId);
  const home = getLocation(contact.home);
  return t('ui.contactWhere', {
    ship: contact.shipName,
    location: t(`locations.${home.id}.name`),
    x: home.x,
    y: home.y,
  });
}
