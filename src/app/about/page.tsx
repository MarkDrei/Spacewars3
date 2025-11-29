import { requireAuth } from '@/lib/server/serverSession';
import AboutPageClient from './AboutPageClient';

// Force dynamic rendering because this page uses cookies for authentication
export const dynamic = 'force-dynamic';

export default async function AboutPage() {
  // Server-side authentication check - redirects to login if not authenticated
  const auth = await requireAuth();
  
  // Pass authenticated user data to client component
  return <AboutPageClient auth={auth} />;
}