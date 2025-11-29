'use client';

import React, { useEffect, useState } from 'react';
import './DataAgeIndicator.css';

interface DataAgeIndicatorProps {
  lastUpdateTime: number | null;
}

const DataAgeIndicator: React.FC<DataAgeIndicatorProps> = ({ lastUpdateTime }) => {
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  useEffect(() => {
    if (!lastUpdateTime) return;

    // Update elapsed time every 100ms for smooth updates
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastUpdateTime;
      setElapsedTime(elapsed);
    }, 100);

    return () => clearInterval(interval);
  }, [lastUpdateTime]);

  // Format elapsed time in a human-readable way
  const formatElapsedTime = (ms: number): string => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  };

  // Get color class based on age
  const getAgeClass = (ms: number): string => {
    if (ms < 2000) return 'fresh'; // Green
    if (ms < 4000) return 'moderate'; // Yellow
    return 'stale'; // Red
  };

  if (!lastUpdateTime) {
    return null;
  }

  return (
    <div className="data-age-indicator">
      <div className={`age-badge ${getAgeClass(elapsedTime)}`}>
        <span className="age-label">Data age:</span>
        <span className="age-value">{formatElapsedTime(elapsedTime)}</span>
      </div>
    </div>
  );
};

export default DataAgeIndicator;
