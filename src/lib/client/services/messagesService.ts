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
   * Format timestamp for display
   */
  formatTime(timestamp: number): string {
    const date = new Date(timestamp * 1000); // Convert from seconds to milliseconds
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
    const date = new Date(timestamp * 1000); // Convert from seconds to milliseconds
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  }
}

export const messagesService = new MessagesService();