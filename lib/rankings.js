import { extractCountry, normalizeCountry, countryKey } from './country.js';

/**
 * Build per-developer country ranks from existing composite scores.
 * Returns Map<login, { country, countryRank, countryTotal }>.
 */
export function buildCountryRankings(developers) {
  const byCountry = new Map();

  for (const dev of developers) {
    if (!dev.location) continue;

    const country = normalizeCountry(extractCountry(dev.location));
    const key = countryKey(country);
    if (!key || country.length <= 1) continue;

    if (!byCountry.has(key)) {
      byCountry.set(key, { name: country, devs: [] });
    }
    byCountry.get(key).devs.push(dev);
  }

  const byLogin = new Map();

  for (const { name, devs } of byCountry.values()) {
    devs.sort((a, b) => b.score - a.score);
    const total = devs.length;
    devs.forEach((dev, index) => {
      const login = dev.login || dev.id;
      byLogin.set(login, {
        country: name,
        countryRank: index + 1,
        countryTotal: total,
      });
    });
  }

  return byLogin;
}
