import React from 'react';
import './LoginPage.css';

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  return (
    <div className="login-page">
      <div className="login-container">
        <h1>Spacewars: Ironcore</h1>
        <p>Welcome to the space exploration game. Click the button below to enter.</p>
        
        <button 
          className="login-button"
          onClick={onLogin}
        >
          Enter Game
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
