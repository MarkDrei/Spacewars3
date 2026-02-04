import { requireAuth } from '@/lib/server/serverSession';
import ShipPageClient from './ShipPageClient';

// Force dynamic rendering because this page uses cookies for authentication
export const dynamic = 'force-dynamic';

export default async function ShipPage() {
  // Server-side authentication check - redirects to login if not authenticated
  const auth = await requireAuth();
  
  // Pass authenticated user data to client component
  return <ShipPageClient auth={auth} />;
}