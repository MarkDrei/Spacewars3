import React from 'react';
import { useTranslations } from 'next-intl';

export type ResearchOverlayType = 'inProgress' | 'otherInProgress';

interface ResearchCardOverlayProps {
  overlayType: ResearchOverlayType;
}

const ResearchCardOverlay: React.FC<ResearchCardOverlayProps> = ({ overlayType }) => {
  const t = useTranslations('research');
  const text = overlayType === 'inProgress' ? t('overlayInProgress') : t('overlayOtherInProgress');
  return (
    <div className="research-card-overlay">
      <div className="research-overlay-ribbon">
        <span className="overlay-text">{text}</span>
      </div>
    </div>
  );
};

export default ResearchCardOverlay;
