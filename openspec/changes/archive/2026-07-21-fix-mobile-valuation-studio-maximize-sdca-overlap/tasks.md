## 1. Clean Up SDCA Panel Implementation

- [x] 1.1 In `web/src/components/studios/SdcaPanel.tsx`, remove the `fullscreen` prop from the `SdcaPanelProps` interface.
- [x] 1.2 In `web/src/components/studios/SdcaPanel.tsx`, update the component definition to remove the `fullscreen` destructuring parameter, and remove it from the default parameters list.
- [x] 1.3 In `web/src/components/studios/SdcaPanel.tsx`, modify the outer `div` className to be simply `chart-panel` (remove the template string that appended the `fullscreen` class conditional).
- [x] 1.4 In `web/src/components/studios/ValuationStudio.tsx` (around line 1300), remove the `fullscreen={maximized !== null}` prop from the `<SdcaPanel />` instantiation.

## 2. Testing and Validation

- [x] 2.1 Build the frontend to verify there are no TypeScript compiler errors: `cd web && bun run build`.
- [x] 2.2 Run the existing test suites or check local dashboard rendering by starting the dev server or reviewing components.
- [x] 2.3 Verify that when a chart subplot is maximized, the `SdcaPanel` is successfully hidden from the UI (it will be matched by the CSS `.chart-panel:not(.fullscreen)` rule which applies `display: none !important`).

## 3. Commit Changes

- [x] 3.1 Commit the cleanup of SDCA panel fullscreen overlap bug: `git commit -m "fix: resolve SDCA strategy panel fullscreen overlap issue on mobile"`.
