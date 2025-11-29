'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation/Navigation';
import StatusHeader from '@/components/StatusHeader/StatusHeader';
import { useAuth } from '@/lib/client/hooks/useAuth';
import { useIron } from '@/lib/client/hooks/useIron';
import { useResearchStatus } from '@/lib/client/hooks/useResearchStatus';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

const AuthenticatedLayout: React.FC<AuthenticatedLayoutProps> = ({ children }) => {
  const router = useRouter();
  const { logout } = useAuth();
  const { ironAmount, isLoading: ironLoading, error: ironError, refetch: refetchIron } = useIron(5000);
  const { isResearchActive, error: researchError } = useResearchStatus(10000);

  // Handle logout with redirect
  const handleLogout = async () => {
    await logout();
    router.push('/'); // Redirect to root page which shows login
  };

  // Determine status indicator and behavior
  const getStatusIndicator = () => {
    if (ironError || researchError) return "red";
    if (!isResearchActive) return "yellow";
    return "grey";
  };

  const getStatusTooltip = () => {
    if (ironError) return `Iron fetch error: ${ironError}`;
    if (researchError) return `Research error: ${researchError}`;
    if (!isResearchActive) return "No research in progress - click to start research";
    return "Research in progress";
  };

  const handleStatusClick = () => {
    if (ironError) {
      console.log('Iron fetch error:', ironError);
      refetchIron(); // Retry iron fetch
    } else if (researchError) {
      console.log('Research fetch error:', researchError);
    } else if (!isResearchActive) {
      router.push('/research'); // Navigate to research page
    }
  };

  const isStatusClickable = !!((!isResearchActive) || ironError || researchError);

  return (
    <div className="app">
      <Navigation onLogout={handleLogout} />
      <StatusHeader 
        ironAmount={ironAmount} 
        statusIndicator={getStatusIndicator()} 
        isLoading={ironLoading}
        onStatusClick={handleStatusClick}
        statusTooltip={getStatusTooltip()}
        isClickable={isStatusClickable}
      />
      {children}
    </div>
  );
};

export default AuthenticatedLayout;
