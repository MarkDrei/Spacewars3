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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load current ship picture and detect available ship images
    const initialize = async () => {
      try {
        // Fetch current ship picture
        const shipPictureResponse = await fetch('/api/ship-picture');
        if (shipPictureResponse.ok) {
          const data = await shipPictureResponse.json();
          setSelectedShip(data.shipPicture);
        }

        // Detect available ship images
        // Check for ship1.png through ship10.png (reasonable upper limit)
        const promises = Array.from({ length: 10 }, (_, i) => i + 1).map(async (i) => {
          try {
            const response = await fetch(`/assets/images/ship${i}.png`, { method: 'HEAD' });
            return response.ok ? i : null;
          } catch {
            return null;
          }
        });

        const results = await Promise.all(promises);
        const ships = results.filter((ship): ship is number => ship !== null);
        setAvailableShips(ships);
      } catch (error) {
        console.error('Failed to initialize ship selection:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    // Clear message after 3 seconds when a new message is set
    if (message) {
      const timeoutId = setTimeout(() => {
        setMessage('');
      }, 3000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [message]);

  const handleShipSelection = async (shipNumber: number) => {
    if (isSaving || shipNumber === selectedShip) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/ship-picture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shipPicture: shipNumber }),
      });

      if (response.ok) {
        setSelectedShip(shipNumber);
        setMessage(`Ship ${shipNumber} selected successfully! 🚀`);
      } else {
        const data = await response.json();
        setMessage(`Failed to select ship: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to save ship selection:', error);
      setMessage('Failed to save ship selection. Please try again.');
    } finally {
      setIsSaving(false);
    }
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

            {isLoading ? (
              <div className="loading-message">
                Loading available ships...
              </div>
            ) : (
              <div className="ship-grid">
                {availableShips.map((shipNumber) => (
                  <div
                    key={shipNumber}
                    className={`ship-card ${selectedShip === shipNumber ? 'selected' : ''} ${isSaving ? 'disabled' : ''}`}
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
            )}
          </section>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default AboutPageClient;
