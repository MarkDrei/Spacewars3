import { requireAuth } from '@/lib/server/serverSession';
import { getUserMessages } from '@/lib/server/MessageCache';
import HomePageClient from './HomePageClient';

// Force dynamic rendering because this page uses cookies for authentication
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Server-side authentication check - redirects to login if not authenticated
  const auth = await requireAuth();
  
  // Load messages on server-side to avoid double-loading and marking as read twice
  const messages = await getUserMessages(auth.userId);
  
  // Pass authenticated user data and messages to client component
  return <HomePageClient auth={auth} initialMessages={messages} />;
}