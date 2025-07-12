import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/Login/LoginPage';
import GamePage from './pages/Game/GamePage';
import AboutPage from './pages/About/AboutPage';
import ProfilePage from './pages/Profile/ProfilePage';
import Navigation from './components/Navigation/Navigation';

const App: React.FC = () => {
  // This is a dummy auth state - in a real app, this would come from a context
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  return (
    <div className="app">
      {isLoggedIn && <Navigation onLogout={handleLogout} />}
      
      <Routes>
        <Route 
          path="/" 
          element={
            isLoggedIn ? 
              <Navigate to="/game" /> : 
              <LoginPage onLogin={handleLogin} />
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
              <ProfilePage /> : 
              <Navigate to="/" />
          } 
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
};

export default App;
