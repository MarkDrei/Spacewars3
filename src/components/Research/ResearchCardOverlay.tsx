import React from 'react';

interface ResearchCardOverlayProps {
  text: string;
}

const ResearchCardOverlay: React.FC<ResearchCardOverlayProps> = ({ text }) => {
  return (
    <div className="research-card-overlay">
      <div className="research-overlay-ribbon">
        <span className="overlay-text">{text}</span>
      </div>
    </div>
  );
};

export default ResearchCardOverlay;
