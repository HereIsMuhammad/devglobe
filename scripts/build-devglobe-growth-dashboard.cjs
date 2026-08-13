#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUTPUT_DIR = path.join(__dirname, '..', 'dashboards');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'devglobe-growth-dashboard.json');
const CLUSTER_URI = process.env.ADX_CLUSTER_URI || 'https://devlglobe.eastus2.kusto.windows.net';
const DATABASE = process.env.ADX_DATABASE || 'devglobe-analytics';

if (!/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.kusto\.windows\.net\/?$/i.test(CLUSTER_URI)) {
  throw new Error(`ADX_CLUSTER_URI is not a valid Azure Data Explorer cluster URI: ${CLUSTER_URI}`);
}

const DS_ID = crypto.randomUUID();
const dataSources = [
  { id: DS_ID, kind: 'manual-kusto', name: 'DevGlobe Analytics', clusterUri: CLUSTER_URI, database: DATABASE },
];

const OVERVIEW_PAGE = crypto.randomUUID();
const DEVELOPERS_PAGE = crypto.randomUUID();
const AGENTS_PAGE = crypto.randomUUID();
const pages = [
  { name: 'Growth Overview', id: OVERVIEW_PAGE },
  { name: 'Developer Adoption', id: DEVELOPERS_PAGE },
  { name: 'Agent Network', id: AGENTS_PAGE },
];

const tiles = [];
const queries = [];
function uuid() { return crypto.randomUUID(); }

function addQuery(text, dsId) {
  const id = uuid();
  queries.push({ dataSource: { kind: 'inline', dataSourceId: dsId }, text, id, usedVariables: [] });
  return id;
}

function addMarkdown(pageId, title, md, y, height = 2) {
  tiles.push({ id: uuid(), title, visualType: 'markdownCard', pageId, layout: { x: 0, y, width: 18, height }, markdownText: md || '', visualOptions: {} });
}

function addTile(pageId, title, type, qId, layout, opts = {}) {
  tiles.push({ id: uuid(), title, visualType: type, pageId, layout, queryRef: { kind: 'query', queryId: qId }, visualOptions: opts });
}

function multistat(w, h = 1) {
  return { multiStat__textSize: 'auto', multiStat__valueColumn: null, colorRulesDisabled: false, multiStat__displayOrientation: 'horizontal', multiStat__labelColumn: null, multiStat__slot: { width: w, height: h }, colorRules: [] };
}

function pie(kind = 'donut', loc = 'bottom') {
  return { hideLegend: false, legendLocation: loc, xColumn: null, yColumns: null, seriesColumns: null, crossFilterDisabled: false, drillthroughDisabled: false, labelDisabled: false, pie__label: ['name', 'percentage'], tooltipDisabled: false, pie__tooltip: ['name', 'percentage', 'value'], pie__orderBy: 'size', pie__kind: kind, pie__topNSlices: null, seriesColors: {}, crossFilter: [], drillthrough: [] };
}

function chart(xCol, yCols, opts = {}) {
  return { multipleYAxes: { base: { id: '-1', label: opts.yLabel || '', columns: [], yAxisMaximumValue: null, yAxisMinimumValue: null, yAxisScale: 'linear', horizontalLines: [] }, additional: [], showMultiplePanels: false }, hideLegend: Boolean(opts.hideLegend), legendLocation: opts.legend || 'bottom', xColumnTitle: '', xColumn: xCol, yColumns: yCols, seriesColumns: opts.series || null, xAxisScale: 'linear', verticalLine: '', crossFilterDisabled: false, drillthroughDisabled: false, forceAxisTicks: false, seriesColors: {}, crossFilter: [], drillthrough: [] };
}

function table() {
  return { table__enableRenderLinks: false, colorRulesDisabled: true, crossFilterDisabled: false, drillthroughDisabled: false, crossFilter: [], drillthrough: [], table__renderLinks: [], colorRules: [] };
}

const latestDevelopers = `let LatestDevelopers = () {
  DevGlobeDevelopersRaw
  | extend Login = tostring(Document.login), UpdatedAt = coalesce(CosmosTimestamp, unixtime_seconds_todatetime(tolong(Document._ts)))
  | where isnotempty(Login)
  | summarize arg_max(UpdatedAt, *) by Login
  | extend
      Name = tostring(Document.name),
      Location = tostring(Document.location),
      TopLanguage = tostring(Document.topLanguage),
      Claimed = tobool(Document.claimed),
      ClaimedAt = todatetime(Document.claimedAt),
      NominationStatus = tostring(Document.nomination.status),
      SubmittedAt = todatetime(Document.nomination.submittedAt),
      ReviewedAt = todatetime(Document.nomination.reviewedAt),
      AiProfilePublic = tostring(Document.aiProfile.visibility) == "public",
      AcceptsAgentRequests = tobool(Document.aiProfile.acceptsAgentRequests),
      AiProfileUpdatedAt = todatetime(Document.aiProfile.updatedAt),
      Tools = todynamic(Document.aiProfile.tools),
      HasCoordinates = isnotnull(todouble(Document.lat)) and isnotnull(todouble(Document.lng)),
      IsPublic = isempty(NominationStatus) or NominationStatus == "approved";
};`;

const latestIntroductions = `let LatestIntroductions = () {
  DevGlobeIntroductionsRaw
  | extend RequestId = tostring(Document.id), UpdatedAt = coalesce(CosmosTimestamp, unixtime_seconds_todatetime(tolong(Document._ts)))
  | where isnotempty(RequestId)
  | summarize arg_max(UpdatedAt, *) by RequestId
  | extend
      Status = tostring(Document.status),
      AgentId = tostring(Document.agentId),
      DeveloperLogin = tostring(Document.developerLogin),
      CreatedAt = todatetime(Document.createdAt),
      ExpiresAt = todatetime(Document.expiresAt);
};`;

// Growth Overview
let y = 0;
addMarkdown(OVERVIEW_PAGE, 'DevGlobe Growth', '## DevGlobe Growth\nCurrent reach, verified adoption, and recent conversion signals. Historical trends use explicit lifecycle timestamps; legacy profile creation dates cannot be reconstructed from current-state documents.', y, 2);
y += 2;

const overviewKpis = addQuery(`${latestDevelopers}
let D = LatestDevelopers;
union
  (D | where IsPublic | summarize Value=count() | extend Metric="Public developers"),
  (D | where Claimed | summarize Value=count() | extend Metric="Claimed profiles"),
  (D | where AiProfilePublic | summarize Value=count() | extend Metric="Public AI profiles"),
  (D | where AcceptsAgentRequests | summarize Value=count() | extend Metric="Open to agents")
| project Metric, Value`, DS_ID);
addTile(OVERVIEW_PAGE, 'Platform KPIs', 'multistat', overviewKpis, { x: 0, y, width: 18, height: 4 }, multistat(18, 4));
y += 4;

const claimsDaily = addQuery(`${latestDevelopers}
LatestDevelopers
| where Claimed and ClaimedAt between (ago(90d) .. now())
| summarize Claims=count() by Day=startofday(ClaimedAt)
| order by Day asc`, DS_ID);
addTile(OVERVIEW_PAGE, 'Daily Profile Claims', 'line', claimsDaily, { x: 0, y, width: 9, height: 5 }, chart('Day', ['Claims'], { hideLegend: true }));

const nominationsDaily = addQuery(`${latestDevelopers}
LatestDevelopers
| where isnotnull(SubmittedAt) and SubmittedAt between (ago(90d) .. now())
| summarize Nominations=count() by Day=startofday(SubmittedAt)
| order by Day asc`, DS_ID);
addTile(OVERVIEW_PAGE, 'Daily Nominations', 'column', nominationsDaily, { x: 9, y, width: 9, height: 5 }, chart('Day', ['Nominations'], { hideLegend: true }));
y += 5;

const weeklyConversions = addQuery(`${latestDevelopers}
LatestDevelopers
| where Claimed and ClaimedAt >= ago(180d)
| summarize Claims=count() by Week=startofweek(ClaimedAt)
| where Week < startofweek(now())
| order by Week asc`, DS_ID);
addTile(OVERVIEW_PAGE, 'Completed Weekly Claims', 'column', weeklyConversions, { x: 0, y, width: 12, height: 5 }, chart('Week', ['Claims'], { hideLegend: true }));

const claimShare = addQuery(`${latestDevelopers}
LatestDevelopers
| where IsPublic
| summarize Value=count() by Status=iff(Claimed, "Claimed", "Unclaimed")
| project Status, Value`, DS_ID);
addTile(OVERVIEW_PAGE, 'Claimed Share', 'pie', claimShare, { x: 12, y, width: 6, height: 5 }, pie('donut', 'bottom'));

// Developer Adoption
y = 0;
addMarkdown(DEVELOPERS_PAGE, 'Developer Adoption', '## Developer Adoption\nWhere the public community is represented, what technologies are visible, and which profiles need enrichment.', y, 2);
y += 2;

const adoptionKpis = addQuery(`${latestDevelopers}
let D = LatestDevelopers | where IsPublic;
union
  (D | summarize Value=dcount(Location) | extend Metric="Locations"),
  (D | summarize Value=dcount(TopLanguage) | extend Metric="Languages"),
  (D | where HasCoordinates | summarize Value=count() | extend Metric="Mapped profiles"),
  (D | where isempty(Location) or Location in ("Unknown", "undefined") | summarize Value=count() | extend Metric="Missing location")
| project Metric, Value`, DS_ID);
addTile(DEVELOPERS_PAGE, 'Coverage KPIs', 'multistat', adoptionKpis, { x: 0, y, width: 18, height: 4 }, multistat(18, 4));
y += 4;

const topLocations = addQuery(`${latestDevelopers}
LatestDevelopers
| where IsPublic and isnotempty(Location) and Location !in ("Unknown", "undefined")
| summarize Developers=count() by Location
| top 15 by Developers desc`, DS_ID);
addTile(DEVELOPERS_PAGE, 'Top Locations', 'bar', topLocations, { x: 0, y, width: 9, height: 6 }, chart('Location', ['Developers'], { hideLegend: true }));

const topLanguages = addQuery(`${latestDevelopers}
LatestDevelopers
| where IsPublic and isnotempty(TopLanguage)
| summarize Developers=count() by TopLanguage
| top 15 by Developers desc`, DS_ID);
addTile(DEVELOPERS_PAGE, 'Top Languages', 'bar', topLanguages, { x: 9, y, width: 9, height: 6 }, chart('TopLanguage', ['Developers'], { hideLegend: true }));
y += 6;

const recentClaims = addQuery(`${latestDevelopers}
LatestDevelopers
| where Claimed
| top 25 by ClaimedAt desc
| project ClaimedAt, Login, Name, Location, TopLanguage`, DS_ID);
addTile(DEVELOPERS_PAGE, 'Recent Claims', 'table', recentClaims, { x: 0, y, width: 10, height: 6 }, table());

const nominationFunnel = addQuery(`${latestDevelopers}
LatestDevelopers
| where isnotempty(NominationStatus)
| summarize Value=count() by Status=NominationStatus
| project Status, Value`, DS_ID);
addTile(DEVELOPERS_PAGE, 'Nomination Outcomes', 'pie', nominationFunnel, { x: 10, y, width: 8, height: 6 }, pie('donut', 'bottom'));

// Agent Network
y = 0;
addMarkdown(AGENTS_PAGE, 'Agent Network', '## Agent Network\nConsent-based AI profile adoption and verified-agent introduction outcomes.', y, 2);
y += 2;

const agentKpis = addQuery(`${latestDevelopers}
${latestIntroductions}
let D = LatestDevelopers;
let I = LatestIntroductions;
union
  (D | where AiProfilePublic | summarize Value=count() | extend Metric="Public AI profiles"),
  (D | where AcceptsAgentRequests | summarize Value=count() | extend Metric="Open developers"),
  (I | summarize Value=count() | extend Metric="Introduction requests"),
  (I | where Status == "accepted" | summarize Value=count() | extend Metric="Accepted connections")
| project Metric, Value`, DS_ID);
addTile(AGENTS_PAGE, 'Agent Network KPIs', 'multistat', agentKpis, { x: 0, y, width: 18, height: 4 }, multistat(18, 4));
y += 4;

const aiProfileTrend = addQuery(`${latestDevelopers}
LatestDevelopers
| where AiProfilePublic and AiProfileUpdatedAt between (ago(90d) .. now())
| summarize Profiles=count() by Day=startofday(AiProfileUpdatedAt)
| order by Day asc`, DS_ID);
addTile(AGENTS_PAGE, 'AI Profile Updates', 'line', aiProfileTrend, { x: 0, y, width: 9, height: 5 }, chart('Day', ['Profiles'], { hideLegend: true }));

const introductionTrend = addQuery(`${latestIntroductions}
LatestIntroductions
| where CreatedAt between (ago(90d) .. now())
| summarize Requests=count() by Day=startofday(CreatedAt)
| order by Day asc`, DS_ID);
addTile(AGENTS_PAGE, 'Introduction Requests', 'column', introductionTrend, { x: 9, y, width: 9, height: 5 }, chart('Day', ['Requests'], { hideLegend: true }));
y += 5;

const toolAdoption = addQuery(`${latestDevelopers}
LatestDevelopers
| where AiProfilePublic and isnotnull(Tools)
| mv-expand Tool=Tools
| extend ToolId=tostring(Tool.id)
| where isnotempty(ToolId)
| summarize Developers=dcount(Login) by ToolId
| order by Developers desc`, DS_ID);
addTile(AGENTS_PAGE, 'Self-Declared AI Tools', 'bar', toolAdoption, { x: 0, y, width: 9, height: 6 }, chart('ToolId', ['Developers'], { hideLegend: true }));

const introductionOutcomes = addQuery(`${latestIntroductions}
LatestIntroductions
| extend EffectiveStatus=iff(Status == "pending" and ExpiresAt < now(), "expired", Status)
| summarize Value=count() by Status=EffectiveStatus
| project Status, Value`, DS_ID);
addTile(AGENTS_PAGE, 'Introduction Outcomes', 'pie', introductionOutcomes, { x: 9, y, width: 9, height: 6 }, pie('donut', 'bottom'));
y += 6;

const recentIntroductions = addQuery(`${latestIntroductions}
LatestIntroductions
| top 25 by CreatedAt desc
| project CreatedAt, DeveloperLogin, AgentId, Status, ExpiresAt`, DS_ID);
addTile(AGENTS_PAGE, 'Recent Introduction Requests', 'table', recentIntroductions, { x: 0, y, width: 18, height: 6 }, table());

const dashboard = {
  $schema: 'https://dataexplorer.azure.com/static/d/schema/75/dashboard.json',
  id: uuid(),
  eTag: uuid(),
  title: 'DevGlobe Platform Growth',
  schema_version: 75,
  tiles,
  pages,
  dataSources,
  queries,
  baseQueries: [],
  embeddedApps: [],
  parameters: [],
};

let errors = 0;
if (!Array.isArray(dashboard.queries)) { console.error('ERROR: Dashboard queries must be an array'); errors++; }
if (!Array.isArray(dashboard.embeddedApps)) { console.error('ERROR: Dashboard embeddedApps must be an array'); errors++; }
if (!Array.isArray(dashboard.baseQueries) || dashboard.baseQueries.length > 0) { console.error('ERROR: Dashboard baseQueries must be empty unless parameter base queries are defined'); errors++; }
const pageIdSet = new Set(pages.map(page => page.id));
const dsIdSet = new Set(dataSources.map(source => source.id));
const queryIdSet = new Set(queries.map(query => query.id));

for (const tile of tiles) {
  if (!pageIdSet.has(tile.pageId)) { console.error(`ERROR: Tile "${tile.title}" bad pageId`); errors++; }
  if (tile.queryRef && !queryIdSet.has(tile.queryRef.queryId)) { console.error(`ERROR: Tile "${tile.title}" bad queryId`); errors++; }
}
for (const query of queries) {
  if (!dsIdSet.has(query.dataSource.dataSourceId)) { console.error(`ERROR: Query ${query.id} bad dataSourceId`); errors++; }
}
const tileIdSet = new Set();
for (const tile of tiles) { if (tileIdSet.has(tile.id)) { console.error(`ERROR: Dup tile ${tile.id}`); errors++; } tileIdSet.add(tile.id); }
const queryIdSetDuplicateCheck = new Set();
for (const query of queries) { if (queryIdSetDuplicateCheck.has(query.id)) { console.error(`ERROR: Dup query ${query.id}`); errors++; } queryIdSetDuplicateCheck.add(query.id); }
for (const tile of tiles) { if (tile.visualType === 'multistat' && !tile.visualOptions?.multiStat__slot?.height) { console.error(`ERROR: Multistat "${tile.title}" missing slot.height`); errors++; } }

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(dashboard, null, 2)}\n`);
console.log(`Generated ${OUTPUT_PATH}`);
console.log(`   Pages: ${pages.length}`);
console.log(`   Tiles: ${tiles.length}`);
console.log(`   Queries: ${queries.length}`);
console.log(errors === 0 ? '   Validation: PASSED' : `   Validation: ${errors} error(s)!`);
if (errors > 0) process.exit(1);