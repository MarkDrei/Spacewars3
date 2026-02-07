'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { ServerAuthState } from '@/lib/server/serverSession';
import './ShipPage.css';

interface ShipPageClientProps {
  auth: ServerAuthState;
}

const ShipPageClient: React.FC<ShipPageClientProps> = () => {
  const [availableShips, setAvailableShips] = useState<number[]>([]);
  const [selectedShip, setSelectedShip] = useState<number | null>(null);
  const [currentShip, setCurrentShip] = useState<number | null>(null);
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Dynamically detect available ship images
    const detectShips = async () => {
      try {
        const response = await fetch('/api/ships');
        if (response.ok) {
          const data = await response.json();
          if (data.ships && Array.isArray(data.ships)) {
            setAvailableShips(data.ships);
          }
        } else {
             console.error('Failed to list ships');
        }
      } catch (error) {
         console.error('Error fetching ship list:', error);
      }
    };

    detectShips();
  }, []);

  useEffect(() => {
    // Load the user's current ship picture_id
    const loadCurrentShip = async () => {
      try {
        const response = await fetch('/api/update-ship-picture');
        if (response.ok) {
          const data = await response.json();
          setCurrentShip(data.pictureId);
          setSelectedShip(data.pictureId);
        }
      } catch (error) {
        console.error('Failed to load current ship:', error);
      }
    };

    loadCurrentShip();
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
    setSelectedShip(shipNumber);
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/update-ship-picture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pictureId: shipNumber }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentShip(shipNumber);
        setMessage(`✅ Ship ${shipNumber} selected successfully! 🚀`);
      } else {
        const error = await response.json();
        setMessage(`❌ Failed to update ship: ${error.message || 'Unknown error'}`);
        setSelectedShip(currentShip); // Revert selection on error
      }
    } catch (error) {
      console.error('Error updating ship:', error);
      setMessage('❌ Failed to update ship. Please try again.');
      setSelectedShip(currentShip); // Revert selection on error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="ship-page">
        <div className="ship-container">
          <h1 className="page-heading">Choose Your Ship</h1>
          
          {message && (
            <div className="ship-selection-message">
              {message}
            </div>
          )}

          <section className="ship-selection-section">
            <p className="ship-selection-intro">
              Select your preferred ship design from the available options below:
              {currentShip && <span> (Current: Ship {currentShip})</span>}
            </p>

            <div className="ship-grid">
              {availableShips.map((shipNumber) => (
                <div
                  key={shipNumber}
                  className={`ship-card ${selectedShip === shipNumber ? 'selected' : ''}`}
                  onClick={() => !isLoading && handleShipSelection(shipNumber)}
                  style={{ cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1 }}
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
            
            {isLoading && (
              <div className="loading-message">
                Updating ship selection...
              </div>
            )}
          </section>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default ShipPageClient;
