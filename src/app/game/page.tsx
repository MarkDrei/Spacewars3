import { requireAuth } from '@/lib/server/serverSession';
import GamePageClient from './GamePageClient';

export default async function GamePage() {
  // Server-side authentication check - redirects to login if not authenticated
  const auth = await requireAuth();
  
  // Pass authenticated user data to client component
  return <GamePageClient auth={auth} />;
}