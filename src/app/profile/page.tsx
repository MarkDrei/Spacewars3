import { requireAuth } from '@/lib/server/serverSession';
import ProfilePageClient from './ProfilePageClient';

// Force dynamic rendering because this page uses cookies for authentication
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  // Server-side authentication check - redirects to login if not authenticated
  const auth = await requireAuth();
  
  // Pass authenticated user data to client component
  return <ProfilePageClient auth={auth} />;
}