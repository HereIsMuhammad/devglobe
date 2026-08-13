'use client';

import React from 'react';

const COPY = {
  search: {
    step: '1 of 3',
    title: 'Find yourself on DevGlobe',
    body: 'Search your name or GitHub username to see whether your developer profile is already on the globe.',
    action: 'Search my name',
  },
  missing: {
    step: '2 of 3',
    title: 'You are not on the globe yet',
    body: 'Submit your GitHub username and location. Your profile will appear after a quick review.',
    action: 'Add me to the globe',
  },
  found: {
    step: '2 of 3',
    title: 'Your profile is ready',
    body: 'Turn your open-source contributions, rank, and developer identity into a shareable card.',
    action: 'Generate my card',
  },
  refine: {
    step: '1 of 3',
    title: 'A few developers matched',
    body: 'Add your GitHub username or full name to narrow the results to your profile.',
    action: 'Refine my search',
  },
  support: {
    step: '3 of 3',
    title: 'Help DevGlobe grow',
    body: 'Like the idea? An upvote on Product Hunt and a star on GitHub help more developers discover the globe.',
    action: 'Done',
  },
};

export default function QuickTour({ step, matchedDeveloper, onFocusSearch, onAddMe, onGenerateCard, onClose }) {
  if (!step) return null;
  const copy = COPY[step];

  const handleAction = () => {
    if (step === 'support') return onClose();
    if (step === 'missing') return onAddMe();
    if (step === 'found' && matchedDeveloper) return onGenerateCard(matchedDeveloper);
    onFocusSearch();
  };

  return (
    <aside className={`quick-tour quick-tour--${step}`} aria-live="polite" aria-label="DevGlobe quick tour">
      <button className="quick-tour__close" onClick={onClose} aria-label="Close quick tour">&times;</button>
      <div className="quick-tour__step">QUICK TOUR · {copy.step}</div>
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
      {step === 'found' && matchedDeveloper && (
        <div className="quick-tour__match">
          <img src={matchedDeveloper.avatarUrl} alt="" />
          <span><strong>{matchedDeveloper.name || matchedDeveloper.login}</strong>@{matchedDeveloper.login}</span>
        </div>
      )}
      {step === 'support' && (
        <div className="quick-tour__support">
          <a href="https://www.producthunt.com/products/devglobe-2" target="_blank" rel="noopener noreferrer">
            Upvote on Product Hunt
          </a>
          <a href="https://github.com/sajeetharan/devglobe" target="_blank" rel="noopener noreferrer">
            Star on GitHub
          </a>
        </div>
      )}
      <button className="quick-tour__action" onClick={handleAction}>{copy.action}</button>
    </aside>
  );
}