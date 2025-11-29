import { requireAuth } from '@/lib/server/serverSession';
import ResearchPageClient from './ResearchPageClient';

// Force dynamic rendering because this page uses cookies for authentication
export const dynamic = 'force-dynamic';

export default async function ResearchPage() {
  // Server-side authentication check - redirects to login if not authenticated
  const auth = await requireAuth();
  
  // Pass authenticated user data to client component
  return <ResearchPageClient auth={auth} />;
}