# mobile-bottom-sheet Specification

## Purpose
Defines normative requirements for the reusable iOS-style `<BottomSheet />` component used on mobile viewports (`<768px`) to house secondary controls, such as the Valuation Studio Piecewise Threshold Editor, without cluttering the primary chart stack.

## ADDED Requirements

### Requirement: iOS-Style Slide-Up Bottom Sheet Component
The frontend application SHALL provide a reusable `<BottomSheet />` React component (`web/src/components/ui/BottomSheet.tsx`) that renders its children inside a slide-up panel overlay at the bottom of the viewport on mobile devices (`<768px`).

#### Scenario: Bottom sheet mount and portal rendering
- **WHEN** `<BottomSheet isOpen={true}>` is rendered on a mobile viewport
- **THEN** the component MUST render via a React Portal (`createPortal`) directly into `document.body` with `z-index: 10000` to escape parent `overflow` and stacking context clipping, animating upwards (`transform: translateY(0)`) from the bottom of the screen over a semi-transparent backdrop (`rgba(0, 0, 0, 0.5)`)

#### Scenario: Drag handle and state transitions
- **WHEN** the bottom sheet is open
- **THEN** it MUST render a visual drag handle bar (`width: 36px`, `height: 4px`, `border-radius: 2px`) at the top of the sheet and support three vertical snap states:
  - `closed`: sheet is hidden off-screen (`transform: translateY(100%)`)
  - `peek`: sheet covers roughly 40% of viewport height (`max-height: 40vh`), allowing the user to view chart updates above while adjusting inputs
  - `expanded`: sheet covers roughly 85% of viewport height (`max-height: 85vh`) with scrollable content area (`overflow-y: auto`)

#### Scenario: Drag-to-dismiss and backdrop tap
- **WHEN** a user taps the dark backdrop overlay or drags the bottom sheet downwards past the dismiss threshold via touch gestures (`touchstart`/`touchmove`/`touchend`)
- **THEN** the bottom sheet MUST smoothly transition to the `closed` state (`transform: translateY(100%)`) and invoke its `onClose()` callback
