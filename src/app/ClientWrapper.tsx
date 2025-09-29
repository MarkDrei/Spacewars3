'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface ClientWrapperProps {
  children: React.ReactNode;
  isAuthenticated: boolean;
  username?: string;
  shipId?: number;
  userId?: number;
}

export default function ClientWrapper({ 
  children, 
  isAuthenticated, 
  username, 
  shipId, 
  userId 
}: ClientWrapperProps) {
  const pathname = usePathname();
  const router = useRouter();
  
  // Define routes that don't require authentication
  const publicRoutes = ['/login'];
  const isPublicRoute = publicRoutes.includes(pathname);
  
  useEffect(() => {
    // Server-side auth check already happened, so we can trust the isAuthenticated value
    
    if (!isAuthenticated && !isPublicRoute) {
      // User is not authenticated and trying to access a protected route
      router.replace('/login');
      return;
    }
    
    if (isAuthenticated && (pathname === '/login' || pathname === '/')) {
      // User is authenticated and on login page or root, redirect to home
      router.replace('/home');
      return;
    }
  }, [isAuthenticated, pathname, isPublicRoute, router]);
  
  // If user is not authenticated and on a protected route, don't render children
  // (they will be redirected by the useEffect above)
  if (!isAuthenticated && !isPublicRoute) {
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
        Redirecting to login...
      </div>
    );
  }
  
  // If user is authenticated and on login/root, don't render children
  // (they will be redirected by the useEffect above)
  if (isAuthenticated && (pathname === '/login' || pathname === '/')) {
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
        Redirecting to home...
      </div>
    );
  }
  
  // Render children for valid combinations
  return <>{children}</>;
}