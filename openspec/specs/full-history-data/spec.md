# full-history-data Specification

## Purpose
TBD - created by archiving change frontend-dashboard-revamp. Update Purpose after archive.
## Requirements
### Requirement: App loads full Bitcoin history from 2016
On mount, the `TerminalContext` SHALL fetch `getDailyAnalytics` with `limit=5000` and no explicit `start_date`, returning data from as early as 2016 (when Bitcoin daily data in `master_ohlcv` begins). The `verifyCausalData` function SHALL still filter out any future-dated entries.

#### Scenario: All charts display data from 2016 onward
- **WHEN** the application loads successfully
- **THEN** `dailyData` array contains at least 3,000 entries spanning from 2016 or earlier to today's date

#### Scenario: Fetch cap does not truncate to 365 days
- **WHEN** the API call is made
- **THEN** the `limit` parameter is `5000`, not `365`

### Requirement: Sync gap is detected on mount and displayed
After the initial data fetch, the application SHALL call `GET /api/v1/health` to retrieve `database.latest_data_timestamp`. The application SHALL compute `gapDays = daysDiff(latestClientDate, serverDate)` and expose it in a visible `syncGap` state accessible to `AppLayout` and `Sidebar`.

#### Scenario: Gap badge shown when server has newer data
- **WHEN** `gapDays > 0`
- **THEN** the header area displays a badge with text `⚠ N day(s) behind` and a `⟳ Sync Data` button

#### Scenario: No badge when data is current
- **WHEN** `gapDays === 0`
- **THEN** the header displays `✓ Data current` with the last sync date

#### Scenario: Manual sync triggers full refetch
- **WHEN** user clicks `⟳ Sync Data`
- **THEN** `refreshData()` is called, re-fetching 5000 rows, and the sync gap badge updates after completion

### Requirement: Sidebar displays data range and trading day count
The Sidebar SHALL display the earliest and latest dates in `dailyData` and the total number of trading days loaded.

#### Scenario: Sidebar shows data range
- **WHEN** `dailyData` is loaded
- **THEN** sidebar shows `DATA RANGE` section with `<earliest_date> → <latest_date>` and `N trading days`

