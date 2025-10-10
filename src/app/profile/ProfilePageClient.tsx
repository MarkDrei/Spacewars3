'use client';

import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { ServerAuthState } from '@/lib/server/serverSession';
import './ProfilePage.css';

interface ProfilePageClientProps {
  auth: ServerAuthState;
}

interface ProfileData {
  username: string;
  shipImageIndex: number;
}

const ProfilePageClient: React.FC<ProfilePageClientProps> = ({ auth }) => {
  const [profileData, setProfileData] = useState<ProfileData>({
    username: auth.username,
    shipImageIndex: 1
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Fetch profile data on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/profile');
        if (response.ok) {
          const data = await response.json();
          setProfileData(data);
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleShipSelect = async (index: number) => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipImageIndex: index })
      });

      if (response.ok) {
        setProfileData({ ...profileData, shipImageIndex: index });
        setMessage({ type: 'success', text: 'Ship image updated successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: 'Failed to update ship image' });
      }
    } catch (error) {
      console.error('Failed to update ship:', error);
      setMessage({ type: 'error', text: 'Failed to update ship image' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="profile-page">
        <div className="profile-container">
          <h1 className="page-heading">Player Profile</h1>
        
        <div className="profile-header">
          <div className="avatar">
            <span className="avatar-text">{profileData.username.charAt(0)}</span>
          </div>
          <div className="player-info">
            <h2>{profileData.username}</h2>
          </div>
        </div>

        <div className="ship-selection">
          <h3>Select Your Ship</h3>
          {message && (
            <div className={`message ${message.type}`}>
              {message.text}
            </div>
          )}
          <div className="ship-options">
            {[1, 2, 3, 4, 5].map((index) => (
              <div
                key={index}
                className={`ship-option ${profileData.shipImageIndex === index ? 'selected' : ''} ${isSaving ? 'disabled' : ''}`}
                onClick={() => !isSaving && handleShipSelect(index)}
              >
                <img 
                  src={`/assets/images/ship${index}.png`} 
                  alt={`Ship ${index}`}
                  className="ship-preview"
                />
                <span className="ship-label">Ship {index}</span>
                {profileData.shipImageIndex === index && <span className="checkmark">✓</span>}
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default ProfilePageClient;
