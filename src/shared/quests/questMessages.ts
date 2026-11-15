// ---
// Texts of mission notifications, from the `quests` locale namespace. Used by the server
// (player messages) and the missions page (feedback after an action).
// ---

import type { QuestNotification } from './questTypes';
import type { QuestTranslate as Translate } from './questTexts';

/** Message text for a mission notification; `t` translates in the `quests` namespace. */
export function questNotificationText(t: Translate, notification: QuestNotification): string {
  switch (notification.kind) {
    case 'questAccepted':
      return t('notifications.questAccepted', { quest: questTitle(t, notification.questId) });
    case 'questAbandoned':
      return t('notifications.questAbandoned', { quest: questTitle(t, notification.questId) });
    case 'readyToReport':
      return t('notifications.readyToReport', {
        quest: questTitle(t, notification.questId),
        contact: t(`contacts.${notification.contactId}.name`),
      });
    case 'stageAdvanced':
      return t('notifications.stageAdvanced', {
        quest: questTitle(t, notification.questId),
        objective: t(`quest.${notification.questId}.stages.${notification.stage + 1}`),
      });
    case 'questCompleted': {
      const key = `questCompleted${notification.commander ? 'Commander' : ''}${notification.iron > 0 ? '' : 'NoIron'}`;
      return t(`notifications.${key}`, {
        quest: questTitle(t, notification.questId),
        xp: notification.xp,
        iron: notification.iron,
      });
    }
    case 'cargoFound':
      return t('notifications.cargoFound', {
        cargo: t(`cargo.${notification.cargoId}.name`),
        current: notification.current,
        required: notification.required,
      });
    case 'cargoHoldFull':
      return t('notifications.cargoHoldFull', { cargo: t(`cargo.${notification.cargoId}.name`) });
    case 'locationDiscovered':
      return t('notifications.locationDiscovered', {
        location: t(`locations.${notification.locationId}.name`),
        xp: notification.xp,
      });
    case 'achievementUnlocked':
      return t('notifications.achievementUnlocked', {
        achievement: t(`achievements.${notification.achievementId}.name`),
        tier: notification.tier,
        xp: notification.xp,
      });
  }
}

function questTitle(t: Translate, questId: string): string {
  return t(`quest.${questId}.title`);
}
