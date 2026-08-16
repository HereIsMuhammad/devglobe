import { randomUUID } from 'crypto';
import { getCosmosContainer } from './cosmos.js';
import { MAX_SAVED_SEARCHES_PER_USER } from './saved-search.js';

const memorySearches = new Map(); // login -> Map(searchId -> document)

function getSavedSearchContainer() {
  return getCosmosContainer(process.env.COSMOS_SAVED_SEARCH_CONTAINER || 'saved-searches');
}

function documentId(login, searchId) {
  return `${login}:${searchId}`;
}

function getMemoryBucket(login) {
  if (!memorySearches.has(login)) memorySearches.set(login, new Map());
  return memorySearches.get(login);
}

export async function listSavedSearches(login) {
  const container = getSavedSearchContainer();
  if (!container) {
    return [...getMemoryBucket(login).values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const { resources } = await container.items.query({
    query: 'SELECT * FROM c WHERE c.login = @login ORDER BY c.createdAt DESC',
    parameters: [{ name: '@login', value: login }],
  }, { partitionKey: login }).fetchAll();
  return resources;
}

export async function getSavedSearch(login, searchId) {
  const container = getSavedSearchContainer();
  if (!container) return getMemoryBucket(login).get(searchId) || null;

  try {
    const { resource } = await container.item(documentId(login, searchId), login).read();
    return resource || null;
  } catch (error) {
    if (error.code === 404) return null;
    throw error;
  }
}

async function saveDocument(document) {
  const container = getSavedSearchContainer();
  if (!container) {
    getMemoryBucket(document.login).set(document.searchId, document);
    return document;
  }
  const { resource } = await container.items.upsert(document);
  return resource;
}

export async function createSavedSearch(login, { name, criteria, alert }) {
  const existing = await listSavedSearches(login);
  if (existing.length >= MAX_SAVED_SEARCHES_PER_USER) {
    const error = new Error(`You can save up to ${MAX_SAVED_SEARCHES_PER_USER} searches`);
    error.status = 409;
    throw error;
  }

  const searchId = randomUUID();
  const now = new Date().toISOString();
  const document = {
    id: documentId(login, searchId),
    documentType: 'saved-search',
    login,
    searchId,
    name,
    criteria,
    alert,
    seenLogins: [],
    lastRunAt: null,
    createdAt: now,
    updatedAt: now,
  };
  return saveDocument(document);
}

export async function updateSavedSearch(login, searchId, patch) {
  const existing = await getSavedSearch(login, searchId);
  if (!existing) return null;
  const document = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  return saveDocument(document);
}

export async function deleteSavedSearch(login, searchId) {
  const container = getSavedSearchContainer();
  if (!container) {
    return getMemoryBucket(login).delete(searchId);
  }

  try {
    await container.item(documentId(login, searchId), login).delete();
    return true;
  } catch (error) {
    if (error.code === 404) return false;
    throw error;
  }
}

export function __resetMemorySavedSearchStoreForTests() {
  memorySearches.clear();
}
