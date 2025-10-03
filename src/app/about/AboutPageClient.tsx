'use client';

import React from 'react';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { ServerAuthState } from '@/lib/server/serverSession';
import './AboutPage.css';

interface AboutPageClientProps {
  auth: ServerAuthState;
}

const AboutPageClient: React.FC<AboutPageClientProps> = ({ auth }) => {
  return (
    <AuthenticatedLayout>
      <div className="about-page">
        <div className="about-container">
          <h1 className="page-heading">About Spacewars: Ironcore</h1>
        
        <section className="about-section">
          <h2>Game Overview</h2>
          <p>
            Spacewars: Ironcore is a 2D space exploration game where players navigate through 
            a toroidal world, collecting valuable objects and mastering interception mechanics.
          </p>
        </section>

        <section className="about-section">
          <h2>Key Features</h2>
          <ul>
            <li><strong>Toroidal World:</strong> The game world wraps around - objects that leave one edge appear on the opposite side</li>
            <li><strong>Interception Mechanics:</strong> Calculate trajectories to intercept moving objects</li>
            <li><strong>Collectibles:</strong> Find and collect shipwrecks with different salvage types and escape pods</li>
            <li><strong>Radar System:</strong> Track nearby objects and plan your routes</li>
            <li><strong>Dynamic Gameplay:</strong> Click to set ship direction and navigate through space</li>
          </ul>
        </section>

        <section className="about-section">
          <h2>Technology Stack</h2>
          <p>
            Built with modern web technologies including TypeScript, React, and HTML5 Canvas 
            for smooth gameplay and responsive design.
          </p>
        </section>

        <section className="about-section">
          <h2>How to Play</h2>
          <ol>
            <li>Click anywhere on the game canvas to set your ship&apos;s direction</li>
            <li>Your ship will accelerate towards the clicked location</li>
            <li>Collect shipwrecks and escape pods for points</li>
            <li>Use the radar to locate nearby objects</li>
            <li>Master the interception mechanics to efficiently collect items</li>
          </ol>
        </section>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default AboutPageClient;
