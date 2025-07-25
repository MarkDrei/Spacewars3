import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/Login/LoginPage';
import GamePage from './pages/Game/GamePage';
import AboutPage from './pages/About/AboutPage';
import ProfilePage from './pages/Profile/ProfilePage';
import Navigation from './components/Navigation/Navigation';
import StatusHeader from './components/StatusHeader';
import { useAuth } from './hooks/useAuth';

const App: React.FC = () => {
  const { isLoggedIn, isLoading, username, login, register, logout } = useAuth();

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
          ironAmount={0} 
          statusIndicator="grey" 
          onStatusClick={() => console.log('Status clicked')}
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
