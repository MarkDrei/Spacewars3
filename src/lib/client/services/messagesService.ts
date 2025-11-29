/**
 * Messages Service - Client-side utilities for formatting and managing user messages
 * Note: Messages are now loaded server-side to prevent double-loading
 */

export interface UnreadMessage {
  id: number;
  created_at: number;
  message: string;
}

class MessagesService {

  /**
   * Get all unread messages for the current user
   */
  async getMessages(): Promise<{ success: boolean; messages: UnreadMessage[]; count: number }> {
    const response = await fetch('/api/messages', {
      method: 'GET',
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch messages');
    }
    
    return response.json();
  }

  /**
   * Mark all messages as read for the current user
   */
  async markAllAsRead(): Promise<{ success: boolean; markedCount: number }> {
    const response = await fetch('/api/messages/mark-read', {
      method: 'POST',
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to mark messages as read');
    }
    
    return response.json();
  }

  /**
   * Format timestamp for display
   */
  formatTime(timestamp: number): string {
    const date = new Date(timestamp); // Timestamp is already in milliseconds
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  }

  /**
   * Format date for display (no year)
   */
  formatDate(timestamp: number): string {
    const date = new Date(timestamp); // Timestamp is already in milliseconds
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  }
}

export const messagesService = new MessagesService();