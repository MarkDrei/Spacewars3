'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/client/hooks/useAuth';
import NavigationIcon from './NavigationIcon';
import LocaleSwitcher from './LocaleSwitcher';
import './Navigation.css';

interface NavigationProps {
  onLogout: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ onLogout }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const { username } = useAuth();
  const t = useTranslations('nav');

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
          Spacewars: Ironstrike
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
            {t('home')}
          </Link>
          <Link 
            href="/game" 
            className={`navbar-item ${isActive('/game') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            {t('game')}
          </Link>
          <Link 
            href="/factory" 
            className={`navbar-item ${isActive('/factory') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            {t('factory')}
          </Link>
          <Link 
            href="/research" 
            className={`navbar-item ${isActive('/research') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            {t('research')}
          </Link>
          <Link 
            href="/ship" 
            className={`navbar-item ${isActive('/ship') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            {t('ship')}
          </Link>
          <Link 
            href="/profile" 
            className={`navbar-item ${isActive('/profile') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            {t('profile')}
          </Link>
          {hasAdminAccess && (
            <Link 
              href="/admin" 
              className={`navbar-item ${isActive('/admin') ? 'active' : ''} admin-link`}
              onClick={closeMenu}
            >
              🛠️ {t('admin')}
            </Link>
          )}
          <button 
            className="navbar-item navbar-logout" 
            onClick={() => {
              closeMenu();
              onLogout();
            }}
          >
            {t('logout')}
          </button>
          <LocaleSwitcher />
        </div>

        {/* Mobile Navigation - Bottom Bar */}
        <div className="navbar-menu navbar-menu-mobile">
          <NavigationIcon route="/home" label={t('home')} isActive={isActive('/home')} />
          <NavigationIcon route="/game" label={t('game')} isActive={isActive('/game')} />
          <NavigationIcon route="/factory" label={t('factory')} isActive={isActive('/factory')} />
          <NavigationIcon route="/research" label={t('research')} isActive={isActive('/research')} />
          <NavigationIcon route="/ship" label={t('ship')} isActive={isActive('/ship')} />
          <NavigationIcon route="/profile" label={t('profile')} isActive={isActive('/profile')} />
          {hasAdminAccess && (
            <NavigationIcon route="/admin" label={t('admin')} isActive={isActive('/admin')} />
          )}
          <LocaleSwitcher />
        </div>

        {/* Mobile Shortcut Bar - Only on Home, Factory, and Research Pages */}
        {((pathname === '/' || pathname === '/home') || pathname === '/factory' || pathname === '/research') && (
          <div className="navbar-shortcut-bar">
            {(pathname === '/' || pathname === '/home') ? (
              <>
                <button className="shortcut-button" onClick={() => scrollToSection('battle-status')}>
                  {t('homeShortcuts.battle')}
                </button>
                <button className="shortcut-button" onClick={() => scrollToSection('notifications')}>
                  {t('homeShortcuts.messages')}
                </button>
                <button className="shortcut-button" onClick={() => scrollToSection('progress')}>
                  {t('homeShortcuts.progress')}
                </button>
                <button className="shortcut-button" onClick={() => scrollToSection('defense')}>
                  {t('homeShortcuts.defense')}
                </button>
                <button className="shortcut-button" onClick={() => scrollToSection('tech-inventory')}>
                  {t('homeShortcuts.tech')}
                </button>
              </>
            ) : pathname === '/factory' ? (
              <>
                <button className="shortcut-button" onClick={() => scrollToSection('build-queue')}>
                  {t('factoryShortcuts.queue')}
                </button>
                <button className="shortcut-button" onClick={() => scrollToSection('defense-systems')}>
                  {t('factoryShortcuts.defense')}
                </button>
                <button className="shortcut-button" onClick={() => scrollToSection('projectile-weapons')}>
                  {t('factoryShortcuts.projectile')}
                </button>
                <button className="shortcut-button" onClick={() => scrollToSection('energy-weapons')}>
                  {t('factoryShortcuts.energy')}
                </button>
              </>
            ) : pathname === '/research' ? (
              <>
                <button className="shortcut-button" onClick={() => scrollToSection('projectile-weapons')}>
                  {t('researchShortcuts.projectile')}
                </button>
                <button className="shortcut-button" onClick={() => scrollToSection('energy-weapons')}>
                  {t('researchShortcuts.energy')}
                </button>
                <button className="shortcut-button" onClick={() => scrollToSection('defense')}>
                  {t('researchShortcuts.defense')}
                </button>
                <button className="shortcut-button" onClick={() => scrollToSection('ship')}>
                  {t('researchShortcuts.ship')}
                </button>
                <button className="shortcut-button" onClick={() => scrollToSection('spies')}>
                  {t('researchShortcuts.spies')}
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
