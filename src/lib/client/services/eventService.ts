// Simple event emitter for cross-component communication
type EventCallback = (...args: unknown[]) => void;

class EventEmitter {
  private events: { [key: string]: EventCallback[] } = {};

  on(event: string, callback: EventCallback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  off(event: string, callback: EventCallback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  }

  emit(event: string, data?: unknown) {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => callback(data));
  }
}

// Global event emitter instance
export const globalEvents = new EventEmitter();

// Event constants
export const EVENTS = {
  RESEARCH_TRIGGERED: 'research_triggered',
  RESEARCH_COMPLETED: 'research_completed',
  IRON_UPDATED: 'iron_updated',
  BUILD_QUEUE_STARTED: 'build_queue_started',
  BUILD_QUEUE_COMPLETED: 'build_queue_completed',
  BUILD_ITEM_COMPLETED: 'build_item_completed'
};
