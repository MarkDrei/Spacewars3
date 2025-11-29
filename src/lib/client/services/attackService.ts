// ---
// Attack Service - Initiate battles with other players
// ---

export interface AttackResult {
  success: boolean;
  error?: string;
  battle?: {
    id: number;
    attackerId: number;
    attackeeId: number;
    battleStartTime: number;
  };
}

/**
 * Attack another player and initiate a battle
 */
export async function attackPlayer(targetUserId: number): Promise<AttackResult> {
  console.log(`⚔️ Attack service sending request for user ID: ${targetUserId}`);
  console.log(`📤 Request body:`, JSON.stringify({ targetUserId }));
  
  try {
    const response = await fetch('/api/attack', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetUserId })
    });
    
    console.log(`📥 Response status: ${response.status} ${response.statusText}`);
    const data = await response.json();
    console.log(`📋 Response data:`, data);
    
    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`
      };
    }
    
    return {
      success: true,
      battle: data.battle
    };
  } catch (error) {
    console.error('❌ Network error during attack:', error);
    return {
      success: false,
      error: 'Network error'
    };
  }
}

export const attackService = {
  attackPlayer
};
