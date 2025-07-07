import React, { useEffect, useRef } from 'react';
import './GamePage.css';
// This is a temporary way to initialize the game
// Later we'll refactor the game code to be more React-friendly
import { initGame } from '../../Game';

const GamePage: React.FC = () => {
  const gameInitializedRef = useRef(false);

  useEffect(() => {
    if (!gameInitializedRef.current) {
      // Only initialize the game once
      initializeGame();
      gameInitializedRef.current = true;
    }

    // Clean up function
    return () => {
      // Any cleanup code needed when component unmounts
      console.log('Game component unmounted');
    };
  }, []);

  const initializeGame = () => {
    // The existing game code expects these elements to be in the DOM
    // This is a temporary solution until we refactor the game code
    const gameCanvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    if (gameCanvas) {
      // Our existing Game class handles initialization, including event listeners
      initGame(gameCanvas);
    } else {
      console.error('Game canvas not found');
    }
  };

  return (
    <div className="game-page">
      <canvas id="gameCanvas" width="800" height="800"></canvas>
      <div id="hud">
        <div className="hud-section">
          <h3>Ship Status</h3>
          Clicks: <span id="clickCounter">0</span><br />
          Speed: <span id="speed">0</span><br />
          Coordinates: <span id="coordinates">(0, 0)</span><br />
          Score: <span id="score">0</span>
        </div>
        
        <div className="hud-section">
          <h3>Last Collected</h3>
          <div id="last-collected">Nothing collected yet</div>
        </div>
        
        <div className="hud-section">
          <h3>Inventory</h3>
          <div id="inventory-list"></div>
        </div>
      </div>
    </div>
  );
};

export default GamePage;
