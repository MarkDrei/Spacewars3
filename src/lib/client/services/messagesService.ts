/**
 * Messages Service - Client-side service for fetching and managing user messages
 */

export interface UnreadMessage {
  id: number;
  created_at: number;
  message: string;
}

export interface MessagesResponse {
  success: boolean;
  messages: UnreadMessage[];
  count: number;
}

export interface MessagesErrorResponse {
  error: string;
}

class MessagesService {
  /**
   * Fetch unread messages for the current user and mark them as read
   */
  async getMessages(): Promise<MessagesResponse | MessagesErrorResponse> {
    try {
      console.log('📬 Fetching messages from API...');
      
      // Add timeout to the fetch call
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch('/api/messages', {
        method: 'GET',
        credentials: 'include', // Include session cookie
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      console.log('📋 Messages API response received - status:', response.status, response.statusText);

      const data = await response.json();
      console.log('📋 Messages API response data:', data);

      if (!response.ok) {
        console.error('❌ Messages API error:', data);
        return { error: data.error || `HTTP ${response.status}: ${response.statusText}` };
      }

      console.log(`📨 Retrieved ${data.count} message(s)`);
      return data;
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('❌ Messages API request timed out');
        return { error: 'Request timed out - messages API not responding' };
      }
      console.error('❌ Network error fetching messages:', error);
      return { error: 'Network error occurred while fetching messages' };
    }
  }

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