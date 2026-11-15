import { requireAuth } from '@/lib/server/serverSession';
import { isContactId } from '@/shared/quests/npcArchetypes';
import MissionsPageClient from './MissionsPageClient';

// Force dynamic rendering because this page uses cookies for authentication
export const dynamic = 'force-dynamic';

interface MissionsPageProps {
  /** `?contact=<id>`: the contact the player hailed on the map; their conversation is shown first. */
  searchParams: Promise<{ contact?: string | string[] }>;
}

export default async function MissionsPage({ searchParams }: MissionsPageProps) {
  // Server-side authentication check - redirects to login if not authenticated
  const auth = await requireAuth();
  const { contact } = await searchParams;

  return <MissionsPageClient auth={auth} hailedContact={isContactId(contact) ? contact : null} />;
}
