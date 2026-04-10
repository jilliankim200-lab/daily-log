import React from 'react';
export function MIcon({ name, size = 20, style }: { name: string; size?: number; style?: React.CSSProperties }) {
  return (
    <span className="material-symbols-rounded" style={{ fontSize: size, lineHeight: 1, display: 'inline-flex', alignItems: 'center', ...style }}>{name}</span>
  );
}
