import { requireAuth } from '@/lib/server/serverSession';
import FactoryPageClient from './FactoryPageClient';

export default async function FactoryPage() {
  // Server-side authentication check - redirects to login if not authenticated
  const auth = await requireAuth();
  
  // Pass authenticated user data to client component
  return <FactoryPageClient auth={auth} />;
}