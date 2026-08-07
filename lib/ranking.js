import {
  cityKey,
  countryKey,
  extractCity,
  extractCountry,
  normalizeCity,
  normalizeCountry,
} from './country.js';

export function addDeveloperRanks(developers) {
  const countryGroups = new Map();
  const cityGroups = new Map();

  developers.forEach((developer) => {
    if (!developer.location) return;
    const country = normalizeCountry(extractCountry(developer.location));
    const countryGroupKey = countryKey(country);
    if (!countryGroupKey) return;

    if (!countryGroups.has(countryGroupKey)) countryGroups.set(countryGroupKey, { country, logins: [] });
    countryGroups.get(countryGroupKey).logins.push(developer.login);

    const city = normalizeCity(extractCity(developer.location));
    const cityGroupKey = cityKey(city);
    if (!cityGroupKey) return;

    const key = `${countryGroupKey}:${cityGroupKey}`;
    if (!cityGroups.has(key)) cityGroups.set(key, { city, logins: [] });
    cityGroups.get(key).logins.push(developer.login);
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

  const cityRanks = new Map();
  cityGroups.forEach(({ city, logins }) => {
    logins.forEach((login, index) => {
      cityRanks.set(login, {
        city,
        cityRank: index + 1,
        cityTotal: logins.length,
      });
    });
  });

  return developers.map((developer, index) => ({
    ...developer,
    globalRank: index + 1,
    globalTotal: developers.length,
    ...(countryRanks.get(developer.login) || {}),
    ...(cityRanks.get(developer.login) || {}),
  }));
}