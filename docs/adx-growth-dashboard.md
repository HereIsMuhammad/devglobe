# DevGlobe ADX growth dashboard

The generated dashboard tracks current developer reach, claim and nomination activity, AI profile adoption, and consent-based agent introductions.

## Architecture

```text
Cosmos DB change feed -> Azure Data Explorer raw tables -> ADX dashboard
```

The dashboard expects two raw tables:

- `DevGlobeDevelopersRaw` from the Cosmos DB `developers` container
- `DevGlobeIntroductionsRaw` from the Cosmos DB `agent-introductions` container

Each table stores the full Cosmos document as `dynamic`. This avoids coupling ingestion to every application field while still allowing KQL to project typed values.

## Create the ADX tables

Run these commands in the target ADX database:

```kusto
.create table DevGlobeDevelopersRaw (
    Document: dynamic,
    CosmosTimestamp: datetime
)

.create table DevGlobeIntroductionsRaw (
    Document: dynamic,
    CosmosTimestamp: datetime
)
```

Create JSON ingestion mappings:

```kusto
.create-or-alter table DevGlobeDevelopersRaw ingestion json mapping 'DevGlobeDevelopersRawMapping' '[
  {"column":"Document","path":"$","datatype":"dynamic"},
  {"column":"CosmosTimestamp","path":"$._ts","datatype":"datetime","transform":"DateTimeFromUnixSeconds"}
]'

.create-or-alter table DevGlobeIntroductionsRaw ingestion json mapping 'DevGlobeIntroductionsRawMapping' '[
  {"column":"Document","path":"$","datatype":"dynamic"},
  {"column":"CosmosTimestamp","path":"$._ts","datatype":"datetime","transform":"DateTimeFromUnixSeconds"}
]'
```

## Connect Cosmos DB

In the Azure portal, create a Cosmos DB data connection for each table from the ADX database **Data connections** page.

Use these settings:

| Cosmos container | ADX table | Mapping |
| --- | --- | --- |
| `developers` | `DevGlobeDevelopersRaw` | `DevGlobeDevelopersRawMapping` |
| `agent-introductions` | `DevGlobeIntroductionsRaw` | `DevGlobeIntroductionsRawMapping` |

1. Select the DevGlobe Cosmos DB account and `devglobe` database.
2. Choose the ADX cluster's system-assigned or user-assigned managed identity.
3. Grant that identity **Cosmos DB Built-in Data Reader** and **Reader** access to the Cosmos DB account.
4. Set the retrieval start date before the earliest lifecycle event needed in the dashboard.
5. Create both data connections and verify that each raw table receives rows.

The connection uses the Cosmos DB change feed. It captures inserts and updates, but not hard deletes, and rapid successive updates may be represented only by their latest state. The dashboard deduplicates current profile and introduction state using `arg_max(CosmosTimestamp, *)`.

## Verify ingestion

```kusto
DevGlobeDevelopersRaw
| summarize Rows=count(), Latest=max(CosmosTimestamp)

DevGlobeIntroductionsRaw
| summarize Rows=count(), Latest=max(CosmosTimestamp)
```

Inspect one projected document before importing the dashboard:

```kusto
DevGlobeDevelopersRaw
| top 1 by CosmosTimestamp desc
| project Login=tostring(Document.login), Claimed=tobool(Document.claimed), Document
```

## Generate and import

From the repository root in PowerShell:

```powershell
npm run build-adx-dashboard
```

The generator defaults to `https://devlglobe.eastus2.kusto.windows.net` and `devglobe-analytics`. Set `ADX_CLUSTER_URI` and `ADX_DATABASE` before running the command only when targeting another ADX database.

Import `dashboards/devglobe-growth-dashboard.json` from **Azure Data Explorer > Dashboards > New dashboard > Import dashboard**. Authenticate the `DevGlobe Analytics` data source if prompted.

The generated dashboard contains:

- **Growth Overview**: public developers, claims, nominations, and claim share
- **Developer Adoption**: location, language, mapping coverage, recent claims, and nomination outcomes
- **Agent Network**: AI profile adoption, opt-ins, tools, and introduction outcomes

## Data limitations

Cosmos DB stores the current application state, not a complete event ledger. Trends are therefore based only on explicit timestamps such as `claimedAt`, `nomination.submittedAt`, `aiProfile.updatedAt`, and introduction `createdAt`. The dashboard cannot infer when legacy developer profiles were first created.

For exact funnels, retention, or deletion-aware reporting, emit immutable events to a separate `analytics-events` container and connect that container to its own ADX table.