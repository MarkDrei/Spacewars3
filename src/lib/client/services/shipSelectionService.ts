// Ship selection service for updating and fetching ship picture
const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://spacewars3.onrender.com/api' 
  : '/api';

export interface UpdateShipResponse {
  success: boolean;
  shipPictureId: number;
  message: string;
}

export interface ShipSelectionError {
  error: string;
}

export const shipSelectionService = {
  async updateShipPicture(shipPictureId: number): Promise<UpdateShipResponse | ShipSelectionError> {
    try {
      const response = await fetch(`${API_BASE}/update-ship`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shipPictureId }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { error: data.error || `Server error: ${response.status}` };
      }
      
      return data;
    } catch (error) {
      console.error('Network error during updateShipPicture:', error);
      return { error: 'Network error' };
    }
  }
};
