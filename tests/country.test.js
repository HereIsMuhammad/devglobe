import test from 'node:test';
import assert from 'node:assert/strict';
import { countryKey, extractCountry } from '../lib/country.js';

test('countryKey matches accented country names to unaccented map names', () => {
  assert.equal(countryKey(extractCountry('Perú')), countryKey('Peru'));
  assert.equal(countryKey('España'), countryKey('Espana'));
  assert.ok(countryKey('Lima, Perú').includes(countryKey('Peru')));
});