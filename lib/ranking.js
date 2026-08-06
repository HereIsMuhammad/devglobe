import { countryKey, extractCountry, normalizeCountry } from './country.js';

export function addDeveloperRanks(developers) {
  const countryGroups = new Map();

  developers.forEach((developer) => {
    if (!developer.location) return;
    const country = normalizeCountry(extractCountry(developer.location));
    const key = countryKey(country);
    if (!key) return;

    if (!countryGroups.has(key)) countryGroups.set(key, { country, logins: [] });
    countryGroups.get(key).logins.push(developer.login);
  });

  const countryRanks = new Map();
  countryGroups.forEach(({ country, logins }) => {
    logins.forEach((login, index) => {
      countryRanks.set(login, {
        country,
        countryRank: index + 1,
        countryTotal: logins.length,
      });
    });
  });

  return developers.map((developer, index) => ({
    ...developer,
    globalRank: index + 1,
    globalTotal: developers.length,
    ...(countryRanks.get(developer.login) || {}),
  }));
}