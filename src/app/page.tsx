import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/server/serverSession';
import LoginPage from './login/page';

export default async function RootPage() {
  // Check authentication server-side
  const authenticated = await isAuthenticated();
  
  // If logged in, redirect to home immediately
  if (authenticated) {
    redirect('/home');
  }

  // If not logged in, show login page
  return <LoginPage />;
}
