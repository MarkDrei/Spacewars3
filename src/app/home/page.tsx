import { requireAuth } from '@/lib/server/serverSession';
import HomePageClient from './HomePageClient';

export default async function HomePage() {
  // Server-side authentication check - redirects to login if not authenticated
  const auth = await requireAuth();
  
  // Pass authenticated user data to client component
  return <HomePageClient auth={auth} />;
}