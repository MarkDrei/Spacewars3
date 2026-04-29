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
