import { describe, it, expect } from 'vitest';

describe('serverTranslations', () => {
  describe('getServerT', () => {
    it('getServerT_englishLocale_returnsEnglishText', async () => {
      const { getServerT } = await import('@/lib/server/i18n/serverTranslations');
      const t = await getServerT('en', 'messages');
      expect(t('summaryNoMessages')).toBe('No messages to summarize.');
    });

    it('getServerT_germanLocale_returnsGermanText', async () => {
      const { getServerT } = await import('@/lib/server/i18n/serverTranslations');
      const t = await getServerT('de', 'messages');
      expect(t('summaryNoMessages')).toBe('Keine Nachrichten zum Zusammenfassen.');
    });

    it('getServerT_unknownLocale_fallsBackToEnglish', async () => {
      const { getServerT } = await import('@/lib/server/i18n/serverTranslations');
      const t = await getServerT('xx', 'messages');
      expect(t('summaryNoMessages')).toBe('No messages to summarize.');
    });

    it('getServerT_missingKey_returnsKeyName', async () => {
      const { getServerT } = await import('@/lib/server/i18n/serverTranslations');
      const t = await getServerT('en', 'messages');
      expect(t('nonExistentKey_abc123')).toBe('nonExistentKey_abc123');
    });

    it('getServerT_dottedKey_descendsIntoNestedObjects', async () => {
      const { getServerT } = await import('@/lib/server/i18n/serverTranslations');
      const t = await getServerT('en', 'quests');
      expect(t('quest.c1_first_haul.title')).toBe('First Haul');
      expect(t('contacts.vess.name')).toBe('Quartermaster Vess');
    });

    it('getServerT_dottedKeyPointingToAnObject_returnsKeyName', async () => {
      const { getServerT } = await import('@/lib/server/i18n/serverTranslations');
      const t = await getServerT('en', 'quests');
      expect(t('quest.c1_first_haul')).toBe('quest.c1_first_haul');
      expect(t('quest.c1_first_haul.title.deeper')).toBe('quest.c1_first_haul.title.deeper');
    });

    it('getServerT_parameterUsedTwice_replacesEveryOccurrence', async () => {
      const { getServerT } = await import('@/lib/server/i18n/serverTranslations');
      const t = await getServerT('en', 'quests');
      expect(t('ui.contactWhere', { ship: 'ISV Ledger', location: 'Ironstrike Station', x: 1, y: 2 })).toBe(
        'ISV Ledger, near Ironstrike Station (1, 2)'
      );
    });

    it('getServerT_withParams_interpolatesValues', async () => {
      const { getServerT } = await import('@/lib/server/i18n/serverTranslations');
      const t = await getServerT('en', 'messages');
      expect(t('levelUp', { level: 5 })).toBe('P: 🎉 Level Up! You reached level 5!');
    });

    it('getServerT_germanWithParams_interpolatesValues', async () => {
      const { getServerT } = await import('@/lib/server/i18n/serverTranslations');
      const t = await getServerT('de', 'messages');
      expect(t('levelUp', { level: 3 })).toBe('P: 🎉 Levelaufstieg! Du hast Level 3 erreicht!');
    });

    it('getServerT_emailNamespace_englishVerificationSubject', async () => {
      const { getServerT } = await import('@/lib/server/i18n/serverTranslations');
      const t = await getServerT('en', 'email');
      expect(t('verificationSubject')).toContain('Verify');
    });

    it('getServerT_emailNamespace_germanVerificationSubject', async () => {
      const { getServerT } = await import('@/lib/server/i18n/serverTranslations');
      const t = await getServerT('de', 'email');
      expect(t('verificationSubject')).toContain('Bestätige');
    });
  });
});
