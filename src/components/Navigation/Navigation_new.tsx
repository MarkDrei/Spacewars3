'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './Navigation.css';

interface NavigationProps {
  onLogout: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ onLogout }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  // Helper function to check if a path is active
  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link href="/game" className="navbar-brand" onClick={closeMenu}>
          Spacewars: Ironcore
        </Link>
        
        <div className="navbar-toggle" onClick={toggleMenu}>
          <span className="navbar-toggle-icon"></span>
          <span className="navbar-toggle-icon"></span>
          <span className="navbar-toggle-icon"></span>
        </div>
        
        <div className={`navbar-menu ${isMenuOpen ? 'active' : ''}`}>
          <Link 
            href="/game" 
            className={`navbar-item ${isActive('/game') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Game
          </Link>
          <Link 
            href="/research" 
            className={`navbar-item ${isActive('/research') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Research
          </Link>
          <Link 
            href="/about" 
            className={`navbar-item ${isActive('/about') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            About
          </Link>
          <Link 
            href="/profile" 
            className={`navbar-item ${isActive('/profile') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Profile
          </Link>
          <button 
            className="navbar-item navbar-logout" 
            onClick={() => {
              closeMenu();
              onLogout();
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
