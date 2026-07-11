# mobile-responsive-shell Specification

## Purpose
Defines normative requirements for the mobile responsive navigation shell (`<768px`), including the fixed bottom tab bar, hamburger slide-over drawer for secondary sidebar content, sticky mobile header, and the `useIsMobile()` responsive hook.

## ADDED Requirements

### Requirement: Mobile Viewport Detection Hook
The frontend application SHALL provide a `useIsMobile(breakpoint?: number)` React hook (`web/src/hooks/useIsMobile.ts`) that detects whether the current window viewport width is below the specified breakpoint (default `768px`) using `window.matchMedia`.

#### Scenario: Viewport width below 768px
- **WHEN** a user opens or resizes the terminal window on a device or browser with a viewport width less than `768px`
- **THEN** `useIsMobile(768)` MUST return `true` and update reactively without requiring a page reload

#### Scenario: Viewport width at or above 768px
- **WHEN** the viewport width is equal to or greater than `768px`
- **THEN** `useIsMobile(768)` MUST return `false`

### Requirement: Fixed Bottom Tab Bar Navigation on Mobile
When running on mobile viewports (`<768px`), the application layout (`AppLayout.tsx`) SHALL hide the fixed 260px desktop sidebar and instead render a fixed bottom navigation tab bar (`BottomTabBar.tsx`) with 5 touch-friendly navigation items corresponding to the 5 primary views (`Dashboard`, `Valuation Pillar Studio`, `LTTD Lab`, `MTTD Console`, and `Ichimoku Terminal`).

#### Scenario: Bottom tab bar rendering on phone screens
- **WHEN** `useIsMobile()` is `true` (`<768px`)
- **THEN** the fixed 260px desktop sidebar MUST NOT render (`display: none` or unmounted), and `<BottomTabBar />` MUST render fixed at the bottom (`position: fixed`, `bottom: 0`, `width: 100%`, `height: 56px`, `z-index: 50`)

#### Scenario: Minimum tap target sizing on bottom tab items
- **WHEN** the bottom tab bar renders on mobile
- **THEN** each of the 5 navigation buttons MUST provide a touch target of at least `44px` height and equal horizontal width (`flex: 1`), highlighting the currently active tab icon and label (`font-size: 10px`)

### Requirement: Sticky Mobile Header with Hamburger Drawer
When on mobile viewports (`<768px`), `AppLayout.tsx` SHALL render a sticky header bar (`MobileHeader.tsx`) at the top (`height: 56px`) displaying the active page title, sync/refresh status controls, and a hamburger menu icon (`☰`). Tapping the hamburger icon SHALL open a slide-over drawer from the left containing secondary navigation elements (Brand Header, Data Range summary, and API Gateway `:8765` connection status).

#### Scenario: Tapping hamburger opens slide-over drawer
- **WHEN** a user taps the hamburger menu icon (`☰`) on the mobile header bar
- **THEN** a slide-over drawer MUST animate in from the left displaying the MAFTIA QUANT brand logo, dataset date range summary, and live API Gateway status, accompanied by a semi-transparent backdrop (`rgba(0, 0, 0, 0.5)`) over the main content

#### Scenario: Dismissing slide-over drawer
- **WHEN** a user taps the backdrop overlay or the close icon (`✕`) inside the slide-over drawer
- **THEN** the drawer MUST slide out to the left and hide cleanly

### Requirement: Responsive Main Content Layout Padding
On mobile viewports (`<768px`), the main layout wrapper (`AppLayout.tsx`) SHALL override the desktop offset (`margin-left: 260px`, `padding: 24px 32px`) to use full width (`margin-left: 0`, `padding: 16px 16px 72px 16px`) so content does not overflow or hide behind the bottom tab bar.

#### Scenario: Main content layout adjustments on phone
- **WHEN** `useIsMobile()` returns `true`
- **THEN** the `<main>` container MUST apply `margin-left: 0`, `padding-top: 16px`, `padding-left: 16px`, `padding-right: 16px`, and `padding-bottom: 72px` (to account for the 56px bottom tab bar plus safety margin)
