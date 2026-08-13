import { siCncf, siDocker, siGithub, siGoogle } from 'simple-icons';
import { getSpecialTags } from '../lib/special-tags.js';

const SIMPLE_ICONS = {
  'github-star': siGithub,
  'google-developer-expert': siGoogle,
  'docker-champion': siDocker,
  'docker-captain': siDocker,
  'cncf-ambassador': siCncf,
};

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 2h9v9H2zm11 0h9v9h-9zM2 13h9v9H2zm11 0h9v9h-9z" />
    </svg>
  );
}

function AwsLogo() {
  return (
    <svg viewBox="0 0 32 24" aria-hidden="true">
      <text x="2" y="15" className="special-tag__aws-text">aws</text>
      <path className="special-tag__aws-smile" d="M5 18.2c6.6 3.2 14 3.2 20.5-.1M22.8 17.3l3.1.5-1.1 2.8" />
    </svg>
  );
}

function CredentialLogo({ tag }) {
  const icon = SIMPLE_ICONS[tag.id];

  if (icon) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={icon.path} />
      </svg>
    );
  }

  if (tag.id === 'microsoft-mvp') return <MicrosoftLogo />;
  if (tag.id === 'aws-hero' || tag.id === 'aws-community-builder') return <AwsLogo />;
  return <span aria-hidden="true">{tag.shortLabel}</span>;
}

export default function SpecialTags({ tags, compact = false }) {
  const specialTags = getSpecialTags(tags);
  if (specialTags.length === 0) return null;

  return (
    <span className={`special-tags${compact ? ' special-tags--compact' : ''}`} aria-label="Developer credentials">
      {specialTags.map(tag => (
        <span
          className={`special-tag special-tag--${tag.className}`}
          title={tag.label}
          tabIndex={0}
          key={tag.id}
        >
          <span className="special-tag__icon" aria-hidden="true">
            <CredentialLogo tag={tag} />
          </span>
          <span className="special-tag__label">{tag.label}</span>
        </span>
      ))}
    </span>
  );
}