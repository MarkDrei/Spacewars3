import { requireAuth } from '@/lib/server/serverSession';
import AboutPageClient from './AboutPageClient';

export default async function AboutPage() {
  // Server-side authentication check - redirects to login if not authenticated
  const auth = await requireAuth();
  
  // Pass authenticated user data to client component
  return <AboutPageClient auth={auth} />;
}