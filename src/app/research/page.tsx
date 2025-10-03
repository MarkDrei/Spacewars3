import { requireAuth } from '@/lib/server/serverSession';
import ResearchPageClient from './ResearchPageClient';

export default async function ResearchPage() {
  // Server-side authentication check - redirects to login if not authenticated
  const auth = await requireAuth();
  
  // Pass authenticated user data to client component
  return <ResearchPageClient auth={auth} />;
}