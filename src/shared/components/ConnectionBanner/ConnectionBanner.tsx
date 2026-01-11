// presentational banner to signal websocket connectivity issues

import React from 'react';

type ConnectionBannerProps = {
  status: 'connected' | 'disconnected';
};

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({ status }) => {
  if (status === 'connected') {
    return null;
  }

  return (
    <div className="connection-banner connection-banner--warning" role="status">
      <strong className="connection-banner__title">Connection lost.</strong>
      <span className="connection-banner__message">
        Live updates will resume when the server reconnects.
      </span>
    </div>
  );
};
