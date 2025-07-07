import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/Login/LoginPage';
import GamePage from './pages/Game/GamePage';

const App: React.FC = () => {
  // This is a dummy auth state - in a real app, this would come from a context
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  return (
    <div className="app">
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
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
};

export default App;
