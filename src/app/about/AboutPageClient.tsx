'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { ServerAuthState } from '@/lib/server/serverSession';
import './AboutPage.css';

interface AboutPageClientProps {
  auth: ServerAuthState;
}

const AboutPageClient: React.FC<AboutPageClientProps> = () => {
  const [availableShips, setAvailableShips] = useState<number[]>([]);
  const [selectedShip, setSelectedShip] = useState<number | null>(null);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    // Dynamically detect available ship images
    const detectShips = async () => {
      const ships: number[] = [];
      // Check for ship1.png through ship10.png (reasonable upper limit)
      for (let i = 1; i <= 10; i++) {
        try {
          const response = await fetch(`/assets/images/ship${i}.png`, { method: 'HEAD' });
          if (response.ok) {
            ships.push(i);
          }
        } catch {
          // Image doesn't exist, skip it
          continue;
        }
      }
      setAvailableShips(ships);
    };

    detectShips();
  }, []);

  const handleShipSelection = (shipNumber: number) => {
    setSelectedShip(shipNumber);
    setMessage(`You have selected Ship ${shipNumber}! 🚀`);
    
    // Clear message after 3 seconds
    setTimeout(() => {
      setMessage('');
    }, 3000);
  };

  return (
    <AuthenticatedLayout>
      <div className="about-page">
        <div className="about-container">
          <h1 className="page-heading">Choose Your Ship</h1>
          
          {message && (
            <div className="ship-selection-message">
              {message}
            </div>
          )}

          <section className="ship-selection-section">
            <p className="ship-selection-intro">
              Select your preferred ship design from the available options below:
            </p>

            <div className="ship-grid">
              {availableShips.map((shipNumber) => (
                <div
                  key={shipNumber}
                  className={`ship-card ${selectedShip === shipNumber ? 'selected' : ''}`}
                  onClick={() => handleShipSelection(shipNumber)}
                >
                  <div className="ship-image-container">
                    <Image
                      src={`/assets/images/ship${shipNumber}.png`}
                      alt={`Ship ${shipNumber}`}
                      className="ship-image"
                      width={200}
                      height={200}
                      style={{ objectFit: 'contain' }}
                      unoptimized
                    />
                  </div>
                  <div className="ship-label">
                    Ship {shipNumber}
                  </div>
                  {selectedShip === shipNumber && (
                    <div className="selected-indicator">✓</div>
                  )}
                </div>
              ))}
            </div>

            {availableShips.length === 0 && (
              <div className="loading-message">
                Loading available ships...
              </div>
            )}
          </section>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default AboutPageClient;
