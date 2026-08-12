import { getSpecialTags } from '../lib/special-tags.js';

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
          <span className="special-tag__icon" aria-hidden="true">{tag.shortLabel}</span>
          <span className="special-tag__label">{tag.label}</span>
        </span>
      ))}
    </span>
  );
}