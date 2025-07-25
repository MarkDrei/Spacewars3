import React from 'react';
import './StatusHeader.css';

export type StatusIndicator = 'grey' | 'yellow' | 'green' | 'red';

interface StatusHeaderProps {
  ironAmount: number;
  statusIndicator: StatusIndicator;
  isLoading?: boolean;
  onStatusClick?: () => void;
}

const StatusHeader: React.FC<StatusHeaderProps> = ({
  ironAmount,
  statusIndicator,
  isLoading = false,
  onStatusClick
}) => {
  const formatIronAmount = (amount: number): string => {
    return amount.toLocaleString();
  };

  return (
    <div className="status-header">
      <div className="status-content">
        <div className="iron-display">
          <span className="iron-label">Iron:</span>
          <span className="iron-amount">
            {isLoading ? '...' : formatIronAmount(ironAmount)}
          </span>
        </div>
        <div 
          className={`status-indicator ${statusIndicator}`}
          onClick={onStatusClick}
          title="Status indicator"
        />
      </div>
    </div>
  );
};

export default StatusHeader;
