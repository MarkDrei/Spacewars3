'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import AchievementsPanel from '@/components/Missions/AchievementsPanel';
import HailPanel from '@/components/Missions/HailPanel';
import MissionAdminTools from '@/components/Missions/MissionAdminTools';
import QuestCard, { type QuestCardActions } from '@/components/Missions/QuestCard';
import SectorPanel from '@/components/Missions/SectorPanel';
import { useQuests } from '@/lib/client/hooks/useQuests';
import { formatBoldText, parseMessage } from '@/lib/client/messages/messageFormat';
import {
  sendAdminQuestAction,
  sendQuestAction,
  type AdminQuestAction,
  type AdminQuestParams,
} from '@/lib/client/services/questService';
import type { ServerAuthState } from '@/lib/server/serverSession';
import { isAdminUsername } from '@/shared/adminAccess';
import { LOCATIONS } from '@/shared/quests/locations';
import type { ContactId } from '@/shared/quests/npcArchetypes';
import { QUESTS, STORY_CHAPTERS } from '@/shared/quests/questDefinitions';
import { questNotificationText } from '@/shared/quests/questMessages';
import type { QuestActionResult, QuestNotification } from '@/shared/quests/questTypes';
import { buildAchievementViews, buildQuestViews, type QuestView } from '@/shared/quests/questViews';
import './MissionsPage.css';

/** The contacts in hail range change while the ship moves, so the page keeps polling. */
const POLL_INTERVAL_MS = 5000;

type Tab = 'active' | 'available' | 'story' | 'achievements' | 'sector';

interface MissionsPageClientProps {
  auth: ServerAuthState;
  /** Contact the player hailed on the map (`?contact=`); shown first among the contacts in range. */
  hailedContact: ContactId | null;
}

/** What a contact says after a mission was completed. */
interface Debrief {
  questId: string;
}

const MissionsPageClient: React.FC<MissionsPageClientProps> = ({ auth, hailedContact }) => {
  const router = useRouter();
  const t = useTranslations('quests');
  const { overview, isLoading, error, reload } = useQuests({ pollIntervalMs: POLL_INTERVAL_MS });
  const [selectedTab, setSelectedTab] = useState<Tab | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const isAdmin = isAdminUsername(auth.username);

  const views = useMemo(
    () => (overview ? buildQuestViews(overview.state, overview.level, overview.cargo) : []),
    [overview]
  );
  const achievements = useMemo(() => (overview ? buildAchievementViews(overview.state) : []), [overview]);
  const activeViews = views.filter(view => view.status === 'active');
  const availableViews = views.filter(view => view.status === 'available');
  const tab: Tab = selectedTab ?? (activeViews.length > 0 || availableViews.length === 0 ? 'active' : 'available');

  const contactsInRange = useMemo(() => {
    const inRange = overview?.contactsInRange ?? [];
    return hailedContact && inRange.includes(hailedContact)
      ? [hailedContact, ...inRange.filter(contactId => contactId !== hailedContact)]
      : inRange;
  }, [overview, hailedContact]);

  /** Runs a mission action, shows what happened and reloads the mission state. */
  const run = useCallback(
    async (action: () => Promise<Partial<QuestActionResult>>) => {
      setBusy(true);
      setActionError(null);
      try {
        const notifications: QuestNotification[] = (await action()).notifications ?? [];
        setFeedback(
          notifications.length > 0
            ? notifications.map(notification => questNotificationText(t, notification))
            : [t('ui.admin.done')]
        );
        const completed = notifications.find(notification => notification.kind === 'questCompleted');
        setDebrief(completed ? { questId: completed.questId } : null);
        await reload();
      } catch (err) {
        setFeedback([]);
        setActionError(err instanceof Error ? err.message : t('ui.loadError'));
      } finally {
        setBusy(false);
      }
    },
    [reload, t]
  );

  const actions: QuestCardActions = useMemo(
    () => ({
      busy,
      contactsInRange,
      onAccept: questId => void run(() => sendQuestAction('accept', questId)),
      onReport: (questId, contactId) => void run(() => sendQuestAction('report', questId, contactId)),
      onAbandon: questId => void run(() => sendQuestAction('abandon', questId)),
      admin: isAdmin
        ? {
            onForceAccept: questId => void run(() => sendAdminQuestAction('accept', { questId })),
            onFulfil: questId => void run(() => sendAdminQuestAction('fulfil', { questId })),
            onForceReport: questId => void run(() => sendAdminQuestAction('report', { questId })),
          }
        : undefined,
    }),
    [busy, contactsInRange, isAdmin, run]
  );

  const runAdminAction = useCallback(
    (action: AdminQuestAction, params?: AdminQuestParams) => void run(() => sendAdminQuestAction(action, params)),
    [run]
  );

  const renderQuests = (list: readonly QuestView[]) => (
    <div className="quest-list">
      {list.map(view => (
        <QuestCard key={view.quest.id} view={view} actions={actions} />
      ))}
    </div>
  );

  const renderGroup = (key: string, title: string, summary: string, list: readonly QuestView[]) => {
    const done = list.filter(view => view.completions > 0).length;
    return (
      <section key={key} className="missions-section" data-testid={`missions-group-${key}`}>
        <h2 className="missions-section__title">
          {title}
          <span className="missions-section__progress">
            {t('ui.chapterProgress', { done, total: list.length })}
          </span>
        </h2>
        <p className="missions-section__summary">{summary}</p>
        {renderQuests(list)}
      </section>
    );
  };

  const completedQuests = views.filter(view => view.completions > 0).length;
  const unlockedTiers = achievements.reduce((sum, view) => sum + view.unlockedTiers, 0);
  const totalTiers = achievements.reduce((sum, view) => sum + view.achievement.tiers.length, 0);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'active', label: t('ui.tabActive', { count: activeViews.length }) },
    { id: 'available', label: t('ui.tabAvailable', { count: availableViews.length }) },
    { id: 'story', label: t('ui.tabStory') },
    { id: 'achievements', label: t('ui.tabAchievements') },
    { id: 'sector', label: t('ui.tabSector') },
  ];

  return (
    <AuthenticatedLayout>
      <div className="missions-page">
        <div className="missions-container">
          <div className="missions-header">
            <h1 className="missions-title">{t('ui.pageHeading')}</h1>
            <button type="button" className="mission-btn" onClick={() => router.push('/game')}>
              {t('ui.returnToGame')}
            </button>
          </div>

          {!overview && isLoading && <div className="missions-loading">{t('ui.loading')}</div>}
          {!overview && !isLoading && (
            <div className="missions-error">
              {error ?? t('ui.loadError')}{' '}
              <button type="button" className="mission-btn" onClick={() => void reload()}>
                {t('ui.retry')}
              </button>
            </div>
          )}

          {overview && (
            <>
              <div className="missions-summary" data-testid="missions-summary">
                <span className="missions-summary__chip">{t('ui.summaryLevel', { level: overview.level })}</span>
                <span className="missions-summary__chip">
                  {t('ui.summaryMissions', { done: completedQuests, total: QUESTS.length })}
                </span>
                <span className="missions-summary__chip">
                  {t('ui.summaryLocations', { done: overview.state.discovered.length, total: LOCATIONS.length })}
                </span>
                <span className="missions-summary__chip">
                  {t('ui.summaryAchievements', { done: unlockedTiers, total: totalTiers })}
                </span>
              </div>

              {isAdmin && <MissionAdminTools busy={busy} onAction={runAdminAction} />}

              {actionError && (
                <div className="missions-feedback missions-feedback--error" role="alert">
                  {actionError}
                </div>
              )}
              {feedback.length > 0 && (
                <ul className="missions-feedback" data-testid="missions-feedback">
                  {feedback.map((message, index) => {
                    const parsed = parseMessage(message);
                    return (
                      <li key={index} className={`missions-feedback__line missions-feedback__line--${parsed.type}`}>
                        {formatBoldText(parsed.content)}
                      </li>
                    );
                  })}
                </ul>
              )}
              {debrief && (
                <div className="missions-debrief" data-testid="missions-debrief">
                  <div className="missions-debrief__title">{t(`quest.${debrief.questId}.title`)}</div>
                  <blockquote className="quest-card__speech">{t(`quest.${debrief.questId}.completion`)}</blockquote>
                  <button type="button" className="mission-btn" onClick={() => setDebrief(null)}>
                    {t('ui.dialogueClose')}
                  </button>
                </div>
              )}

              <HailPanel contacts={contactsInRange} views={views} actions={actions} />

              <div className="missions-tabs" role="tablist">
                {tabs.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    className={`missions-tab${tab === id ? ' missions-tab--active' : ''}`}
                    onClick={() => setSelectedTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'active' &&
                (activeViews.length > 0 ? renderQuests(activeViews) : <p className="missions-empty">{t('ui.noActive')}</p>)}

              {tab === 'available' &&
                (availableViews.length > 0 ? (
                  renderQuests(availableViews)
                ) : (
                  <p className="missions-empty">{t('ui.noAvailable')}</p>
                ))}

              {tab === 'story' && (
                <>
                  {STORY_CHAPTERS.map(chapter =>
                    renderGroup(
                      `chapter-${chapter}`,
                      `${t('ui.chapterLabel', { number: chapter })}: ${t(`chapters.${chapter}.title`)}`,
                      t(`chapters.${chapter}.summary`),
                      views.filter(view => view.quest.chapter === chapter)
                    )
                  )}
                  {renderGroup(
                    'side',
                    t('ui.sideQuests'),
                    t('ui.sideQuestsSummary'),
                    views.filter(view => !view.quest.chapter && !view.quest.repeatable)
                  )}
                  {renderGroup(
                    'contracts',
                    t('ui.contracts'),
                    t('ui.contractsSummary'),
                    views.filter(view => !view.quest.chapter && view.quest.repeatable)
                  )}
                </>
              )}

              {tab === 'achievements' && <AchievementsPanel achievements={achievements} />}

              {tab === 'sector' && (
                <SectorPanel discovered={overview.state.discovered} contactsInRange={overview.contactsInRange} />
              )}
            </>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default MissionsPageClient;
