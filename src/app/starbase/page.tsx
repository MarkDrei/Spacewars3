import { requireAuth } from '@/lib/server/serverSession';
import StarbasePageClient from './StarbasePageClient';

// Force dynamic rendering because this page uses cookies for authentication
export const dynamic = 'force-dynamic';

export default async function StarbasePage() {
  // Server-side authentication check - redirects to login if not authenticated
  const auth = await requireAuth();

  return <StarbasePageClient auth={auth} />;
}
