import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LoginPage from './pages/Login/LoginPage';
import GamePage from './pages/Game/GamePage';
import ResearchPage from './pages/ResearchPage';
import AboutPage from './pages/About/AboutPage';
import ProfilePage from './pages/Profile/ProfilePage';
import Navigation from './components/Navigation/Navigation';
import StatusHeader from './components/StatusHeader';
import { useAuth } from './hooks/useAuth';
import { useIron } from './hooks/useIron';
import { useResearchStatus } from './hooks/useResearchStatus';

const App: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn, isLoading, username, login, register, logout } = useAuth();
  const { ironAmount, isLoading: ironLoading, error: ironError, refetch: refetchIron } = useIron(isLoggedIn, 5000);
  const { isResearchActive, error: researchError } = useResearchStatus(isLoggedIn, 10000); // Check research every 10 seconds

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
      navigate('/research'); // Navigate to research page
    }
  };

  const isStatusClickable = !!((!isResearchActive) || ironError || researchError);

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

  return (
    <div className="app">
      {isLoggedIn && <Navigation onLogout={logout} />}
      {isLoggedIn && (
        <StatusHeader 
          ironAmount={ironAmount} 
          statusIndicator={getStatusIndicator()} 
          isLoading={ironLoading}
          onStatusClick={handleStatusClick}
          statusTooltip={getStatusTooltip()}
          isClickable={isStatusClickable}
        />
      )}
      
      <Routes>
        <Route 
          path="/" 
          element={
            isLoggedIn ? 
              <Navigate to="/game" /> : 
              <LoginPage onLogin={login} onRegister={register} />
          } 
        />
        <Route 
          path="/game" 
          element={
            isLoggedIn ? 
              <GamePage /> : 
              <Navigate to="/" />
          } 
        />
        <Route 
          path="/research" 
          element={
            isLoggedIn ? 
              <ResearchPage /> : 
              <Navigate to="/" />
          } 
        />
        <Route 
          path="/about" 
          element={
            isLoggedIn ? 
              <AboutPage /> : 
              <Navigate to="/" />
          } 
        />
        <Route 
          path="/profile" 
          element={
            isLoggedIn ? 
              <ProfilePage username={username} /> : 
              <Navigate to="/" />
          } 
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
};

export default App;
