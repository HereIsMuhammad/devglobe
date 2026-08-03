import React from 'react';

export default function Header() {
  return (
    <header className="header">
      <div className="header__brand">
        <span className="header__icon">🌐</span>
        <h1 className="header__title">DevGlobe</h1>
        <span className="header__subtitle">Visualizing the World's Top Open-Source Contributors</span>
      </div>
      <div className="header__actions">
        <a href="https://github.com/sajeetharan/devglobe" target="_blank" rel="noreferrer" className="btn btn--star">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z" />
          </svg>
          Star on GitHub
        </a>
        <a href="https://github.com/sponsors/sajeetharan" target="_blank" rel="noreferrer" className="btn btn--sponsor">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="m8 14.25.345.666a.75.75 0 0 1-.69 0l-.008-.004-.018-.01a7.152 7.152 0 0 1-.31-.17 22.055 22.055 0 0 1-3.434-2.414C2.045 10.731 0 8.35 0 5.5 0 2.836 2.086 1 4.25 1 5.797 1 7.153 1.802 8 3.02 8.847 1.802 10.203 1 11.75 1 13.914 1 16 2.836 16 5.5c0 2.85-2.045 5.231-3.885 6.818a22.066 22.066 0 0 1-3.744 2.584l-.018.01-.006.003h-.002z" />
          </svg>
          Sponsor
        </a>
      </div>
    </header>
  );
}
