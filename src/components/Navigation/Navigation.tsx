'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/client/hooks/useAuth';
import NavigationIcon from './NavigationIcon';
import './Navigation.css';

interface NavigationProps {
  onLogout: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ onLogout }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const { username } = useAuth();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  // Helper function to check if a path is active
  const isActive = (path: string) => {
    if (path === '/home') {
      return pathname === '/' || pathname === '/home';
    }
    return pathname === path;
  };

  // Function to scroll to a section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Check if user has admin access
  const hasAdminAccess = username === 'a' || username === 'q';

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link href="/home" className="navbar-brand" onClick={closeMenu}>
          Spacewars: Ironcore
        </Link>
        
        <div className="navbar-toggle" onClick={toggleMenu}>
          <span className="navbar-toggle-icon"></span>
          <span className="navbar-toggle-icon"></span>
          <span className="navbar-toggle-icon"></span>
        </div>
        {/* Desktop Navigation - Top Bar */}
        <div className={`navbar-menu navbar-menu-desktop ${isMenuOpen ? 'active' : ''}`}>
          <Link 
            href="/home" 
            className={`navbar-item ${isActive('/home') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Home
          </Link>
          <Link 
            href="/game" 
            className={`navbar-item ${isActive('/game') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Game
          </Link>
          <Link 
            href="/factory" 
            className={`navbar-item ${isActive('/factory') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Factory
          </Link>
          <Link 
            href="/research" 
            className={`navbar-item ${isActive('/research') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Research
          </Link>
          <Link 
            href="/ship" 
            className={`navbar-item ${isActive('/ship') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Ship
          </Link>
          <Link 
            href="/profile" 
            className={`navbar-item ${isActive('/profile') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Profile
          </Link>
          {hasAdminAccess && (
            <Link 
              href="/admin" 
              className={`navbar-item ${isActive('/admin') ? 'active' : ''} admin-link`}
              onClick={closeMenu}
            >
              🛠️ Admin
            </Link>
          )}
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

        {/* Mobile Navigation - Bottom Bar */}
        <div className="navbar-menu navbar-menu-mobile">
          <NavigationIcon route="/home" label="Home" isActive={isActive('/home')} />
          <NavigationIcon route="/game" label="Game" isActive={isActive('/game')} />
          <NavigationIcon route="/factory" label="Factory" isActive={isActive('/factory')} />
          <NavigationIcon route="/research" label="Research" isActive={isActive('/research')} />
          <NavigationIcon route="/ship" label="Ship" isActive={isActive('/ship')} />
          <NavigationIcon route="/profile" label="Profile" isActive={isActive('/profile')} />
          {hasAdminAccess && (
            <NavigationIcon route="/admin" label="Admin" isActive={isActive('/admin')} />
          )}
        </div>

        {/* Mobile Shortcut Bar - Only on Home and Factory Pages */}
        {((pathname === '/' || pathname === '/home') || pathname === '/factory') && (
          <div className="navbar-shortcut-bar">
            {(pathname === '/' || pathname === '/home') ? (
              <>
                <button className="shortcut-button" onClick={() => scrollToSection('battle-status')}>
                  Battle
                </button>
                <button className="shortcut-button" onClick={() => scrollToSection('notifications')}>
                  Messages
                </button>
                <button className="shortcut-button" onClick={() => scrollToSection('progress')}>
                  Progress
                </button>
                <button className="shortcut-button" onClick={() => scrollToSection('defense')}>
                  Defense
                </button>
                <button className="shortcut-button" onClick={() => scrollToSection('tech-inventory')}>
                  Tech
                </button>
                <button className="shortcut-button" onClick={() => scrollToSection('weapon-cooldowns')}>
                  Cooldowns
                </button>
              </>
            ) : pathname === '/factory' ? (
              <>
                <button className="shortcut-button" onClick={() => scrollToSection('build-queue')}>
                  Queue
                </button>
                <button className="shortcut-button" onClick={() => scrollToSection('defense-systems')}>
                  Defense
                </button>
                <button className="shortcut-button" onClick={() => scrollToSection('projectile-weapons')}>
                  Projectile
                </button>
                <button className="shortcut-button" onClick={() => scrollToSection('energy-weapons')}>
                  Energy
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
