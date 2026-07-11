## MODIFIED Requirements

### Requirement: Executive Dashboard Bento Grid

The `BentoSummary` grid SHALL use a gap of `10px` between cards (reduced from `20px`). Each bento card SHALL use `12px` internal padding (reduced from `20px`). Primary metric values SHALL use `26px` font-size (reduced from `32px`). Card bottom separator margin SHALL be `10px` top / `8px` top padding (reduced from `16px` / `12px`).

#### Scenario: Bento grid renders compact
- **WHEN** the `BentoSummary` component renders on desktop
- **THEN** the grid `gap` SHALL be `10px`
- **THEN** each card's padding SHALL be `12px`
- **THEN** the primary metric font-size SHALL be `26px`

### Requirement: Sidebar Navigation Density

The sidebar nav items SHALL use `7px 10px` padding (reduced from `10px 12px`). Nav item gap SHALL be `2px` (reduced from `4px`). The brand header section SHALL use `14px` padding (reduced from `20px`). Sidebar width SHALL remain `260px`.

#### Scenario: Sidebar nav renders compact
- **WHEN** the `Sidebar` component renders on desktop
- **THEN** each nav button's padding SHALL be `7px 10px`
- **THEN** the gap between nav items SHALL be `2px`
- **THEN** the brand header padding SHALL be `14px`

### Requirement: Desktop Page Header Density

The desktop page header SHALL use `8px` bottom padding (reduced from `16px`). The page title font-size SHALL remain `22px`. The subtitle line SHALL remain `12px`.

#### Scenario: Page header renders compact
- **WHEN** the `AppLayout` desktop header renders
- **THEN** its `paddingBottom` SHALL be `8px`

### Requirement: Main Content Area Spacing

The main content area SHALL use `16px 24px` padding on desktop (reduced from `24px 32px`). The gap between content sections SHALL be `16px` (reduced from `24px`).

#### Scenario: Main content renders with tight padding
- **WHEN** the `<main>` element renders on desktop
- **THEN** its padding SHALL be `16px 24px`
- **THEN** the gap between child sections SHALL be `16px`
