---
title: Scoring and OSS Worth
description: Understand DevGlobe's relative score and its separate direct-value OSS Worth estimate.
---

# Scoring and OSS Worth

These metrics answer different questions and must not be treated as interchangeable.

## DevGlobe score

The 0–100 score is a **relative ranking signal** calibrated against developers currently indexed by DevGlobe. It combines GitHub stars, commits, repository reach, Stack Overflow reputation and engagement, and community signals. Dimensions are log-normalized so outliers do not consume the full scale.

When a profile has no linked Stack Overflow activity, that score's Stack Overflow weight is redistributed across GitHub dimensions. Consequently, a score can move when the indexed cohort or source data changes.

The score is not an absolute measure of skill, code quality, seniority, or employability.

## OSS Worth

OSS Worth is a separate playful direct-value estimate. GitHub and Stack Overflow are calculated independently and then added.

### GitHub

```text
GitHub dollars =
  contributions × $0.50 +
  followers × $0.10 +
  repository stars × $0.30
```

The GitHub formula follows [GitEstimate](https://github.com/taqui-786/GitEstimate). DevGlobe uses its indexed `totalCommits` as the available contribution-count input.

### Stack Overflow

```text
Stack Overflow dollars =
  answers × $0.50 +
  reputation × $0.10 +
  badges × $0.30
```

An unlinked Stack Overflow profile contributes zero rather than changing GitHub's value.

### Combined display

```text
total dollars = GitHub dollars + Stack Overflow dollars
OSS Credits = round(total dollars × 10)
```

There is no 60/40 allocation, maximum pool, or cross-platform normalization. Dollar values are entertainment estimates, not compensation, market value, or financial advice.

## Freshness

Both metrics depend on the latest indexed public data. Profiles identify stale or unknown freshness where the source update time is unavailable.