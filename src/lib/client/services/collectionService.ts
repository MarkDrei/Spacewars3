// Collection service for collecting space objects
export interface CollectionResult {
  success: boolean;
  distance?: number;
  ironReward?: number;
  totalIron?: number;
  objectType?: string;
  error?: string;
}

export const collectionService = {
  async collectObject(objectId: number): Promise<CollectionResult> {
    try {
      const response = await fetch('/api/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ objectId }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to collect object'
        };
      }
      
      return {
        success: true,
        distance: data.distance,
        ironReward: data.ironReward,
        totalIron: data.totalIron,
        objectType: data.objectType
      };
    } catch (error) {
      console.error('Network error during collection:', error);
      return {
        success: false,
        error: 'Network error'
      };
    }
  }
};
