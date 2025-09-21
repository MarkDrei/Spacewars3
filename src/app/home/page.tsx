'use client';

import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { useAuth } from '@/lib/client/hooks/useAuth';
import { messagesService, UnreadMessage } from '@/lib/client/services/messagesService';
import './HomePage.css';

const HomePage: React.FC = () => {
  const [messages, setMessages] = useState<UnreadMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { isLoggedIn, isLoading: authLoading } = useAuth();

  // Fetch messages on component mount, but only after authentication is confirmed
  useEffect(() => {
    // Don't fetch if still checking auth or not logged in
    if (authLoading || !isLoggedIn) {
      return;
    }

    const fetchMessages = async () => {
      try {
        setError(null);
        setIsLoading(true);
        
        console.log('🏠 Home page loading, user authenticated, fetching messages...');
        const result = await messagesService.getMessages();
        
        console.log('📋 Messages service result:', result);
        
        if ('error' in result) {
          console.error('❌ Messages service returned error:', result.error);
          setError(result.error);
          setMessages([]);
        } else {
          console.log(`✅ Loaded ${result.messages.length} message(s) on home page`);
          setMessages(result.messages);
        }
        
      } catch (err) {
        console.error('❌ Error fetching messages:', err);
        setError('Failed to load messages');
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [isLoggedIn, authLoading]);

  return (
    <AuthenticatedLayout>
      <div className="home-page">
        <div className="home-container">
          <div className="notifications-table-container">
            <table className="notifications-table">
              <thead>
                <tr>
                  <th colSpan={2} className="notifications-header">Notifications</th>
                </tr>
              </thead>
              <tbody>
                {authLoading ? (
                  <tr>
                    <td colSpan={2} className="loading-cell">
                      Checking authentication...
                    </td>
                  </tr>
                ) : !isLoggedIn ? (
                  <tr>
                    <td colSpan={2} className="error-cell">
                      Not authenticated
                    </td>
                  </tr>
                ) : isLoading ? (
                  <tr>
                    <td colSpan={2} className="loading-cell">
                      Loading messages...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={2} className="error-cell">
                      Error: {error}
                    </td>
                  </tr>
                ) : messages.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="empty-cell">
                      No new messages
                    </td>
                  </tr>
                ) : (
                  messages.map(message => (
                    <tr key={message.id} className="notification-row">
                      <td className="time-cell">
                        <div className="time-line">{messagesService.formatTime(message.created_at)}</div>
                        <div className="date-line">{messagesService.formatDate(message.created_at)}</div>
                      </td>
                      <td className="message-cell">
                        {message.message}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default HomePage;