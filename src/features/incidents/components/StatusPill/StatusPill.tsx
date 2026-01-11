// small semantic badge to reinforce status in lists + detail views

import React from 'react';

type StatusPillProps = {
  status: string;
};

export const StatusPill: React.FC<StatusPillProps> = ({ status }) => {
  const normalized = status.toLowerCase();
  return <span className={`status-pill status-pill--${normalized}`}>{status}</span>;
};
