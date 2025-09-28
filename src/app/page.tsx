'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/client/hooks/useAuth';
import LoginPage from './login/page';

export default function RootPage() {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useAuth();

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#121212',
        color: '#4caf50',
        fontSize: '1.2rem'
      }}>
        Loading...
      </div>
    );
  }

  // If logged in, redirect to home
  if (isLoggedIn) {
    router.push('/home');
    return null;
  }

  // If not logged in, show login page
  return <LoginPage />;
}
