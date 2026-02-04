import React from 'react';
import Link from 'next/link';
import {
  HomeIcon,
  MapIcon,
  BuildingIcon,
  BeakerIcon,
  UserIcon,
  RocketIcon,
  WrenchScrewdriverIcon,
} from './icons';

interface NavigationIconProps {
  route: string;
  label: string;
  isActive: boolean;
  onClick?: () => void;
}

// Mapping of routes to icon components
const iconMapping: Record<string, React.FC<{ className?: string; size?: number }>> = {
  '/home': HomeIcon,
  '/game': MapIcon,
  '/factory': BuildingIcon,
  '/research': BeakerIcon,
  '/profile': UserIcon,
  '/ship': RocketIcon,
  '/admin': WrenchScrewdriverIcon,
};

const NavigationIcon: React.FC<NavigationIconProps> = ({ route, label, isActive, onClick }) => {
  const IconComponent = iconMapping[route] || HomeIcon;

  return (
    <Link
      href={route}
      className={`nav-icon-button ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <IconComponent className="nav-icon" size={24} />
      <span className="nav-label">{label}</span>
    </Link>
  );
};

export default NavigationIcon;
