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
      console.log(`🚀 Collection service sending request for object ID: ${objectId}`);
      
      const requestBody = JSON.stringify({ objectId });
      console.log(`📤 Request body: ${requestBody}`);
      
      const response = await fetch('/api/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      console.log(`📥 Response status: ${response.status} ${response.statusText}`);
      
      const data = await response.json();
      console.log(`📋 Response data:`, data);
      
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
