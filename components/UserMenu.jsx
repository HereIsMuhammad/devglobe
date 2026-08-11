'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function UserMenu({ user, onLogout, onClaim, claimStatus }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <a href="/api/auth/github" className="btn btn--signin" aria-label="Sign in with GitHub" title="Sign in with GitHub">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        <span className="btn__label">Sign in with GitHub</span>
      </a>
    );
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-menu__trigger"
        onClick={() => setOpen(!open)}
        aria-label="User menu"
      >
        <img
          src={user.avatarUrl}
          alt={user.login}
          className="user-menu__avatar"
        />
        <svg className="user-menu__caret" viewBox="0 0 12 12" width="12" height="12" fill="currentColor">
          <path d="M6 8.5L1 3.5h10L6 8.5z" />
        </svg>
      </button>

      {open && (
        <div className="user-menu__dropdown">
          <div className="user-menu__info">
            <img src={user.avatarUrl} alt={user.login} className="user-menu__dropdown-avatar" />
            <div>
              <div className="user-menu__name">{user.name}</div>
              <div className="user-menu__login">@{user.login}</div>
            </div>
          </div>
          <div className="user-menu__divider" />
          {claimStatus === 'unclaimed' && (
            <button className="user-menu__item" onClick={() => { onClaim(); setOpen(false); }}>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M16 8A8 8 0 110 8a8 8 0 0116 0zm-3.97-3.03a.75.75 0 00-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 00-1.06 1.06L6.97 11.03a.75.75 0 001.079-.02l3.992-4.99a.75.75 0 00-.01-1.05z" />
              </svg>
              Claim my profile
            </button>
          )}
          {claimStatus === 'claimed' && (
            <div className="user-menu__item user-menu__item--claimed">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M16 8A8 8 0 110 8a8 8 0 0116 0zm-3.97-3.03a.75.75 0 00-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 00-1.06 1.06L6.97 11.03a.75.75 0 001.079-.02l3.992-4.99a.75.75 0 00-.01-1.05z" />
              </svg>
              Profile claimed ✓
            </div>
          )}
          {claimStatus === 'no_match' && (
            <div className="user-menu__item user-menu__item--no-match">
              No matching profile found
            </div>
          )}
          <button className="user-menu__item user-menu__item--logout" onClick={() => { onLogout(); setOpen(false); }}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M2 2.75C2 1.784 2.784 1 3.75 1h2.5a.75.75 0 010 1.5h-2.5a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h2.5a.75.75 0 010 1.5h-2.5A1.75 1.75 0 012 13.25zm10.44 4.5H6.75a.75.75 0 000 1.5h5.69l-1.97 1.97a.749.749 0 101.06 1.06l3.25-3.25a.749.749 0 000-1.06l-3.25-3.25a.749.749 0 10-1.06 1.06l1.97 1.97z" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
