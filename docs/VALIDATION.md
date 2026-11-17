# Prototype validation · 2026-11-17

## Completed checks

- Local server returned HTTP 200 for the entry page.
- All source JavaScript passed `node --check` through `node tools/check.mjs`.
- Three meaningful Node test groups passed: original building/door transforms; all seven walkable approaches plus a blocked-target negative control; finite/repeatable geometry and bounded indices.
- WebGPU compiled all five shader modules and created the HDR, MSAA, shadow, snow, bloom and tone-mapping pipelines in the Codex in-app browser.
- Actual rendered views were observed for static-night cabin and bright village overview, including instanced snowy pines, snow particles, warm window emission, roof snow and the original seven-building footprint.
- Runtime DOM diagnostics in the cabin view reported `errors=0`, `frameCount=117`, `drawCalls=199`, `gpuMs=24.445` at 736×824. Another overview screenshot showed GPU 37.4 ms at 636×714. These are isolated snapshots under adaptive resolution, not benchmark averages. This environment did not meet the 9.8–13.6 ms target during those observations.

## Defects caught and corrected

- A Bloom pipeline initially reused an implicit auto-layout as an explicit pipeline layout, which WebGPU rejects. Replaced with one explicit shared Bloom binding layout and successfully rendered afterward.
- The approach path initially aimed one cell beyond each door; for the kitchen this was a village wall. All approaches now terminate on original door cells and all seven routes pass topology checks.
- The first cabin camera viewed the building through the south village wall. Moved the near camera inside that wall. Free camera remains intentionally collision-free.
- Raw frame intervals are now recorded separately from the bounded time step used for camera movement.

## Verification limits

The first desktop Edge handoff was stopped by the computer-use tool because it could not confidently identify the current browser URL. The user explicitly asked to resume. After re-observing the window, the localhost page was opened successfully in Edge, all three environments were visibly selected and rendered, and the interior was inspected.

Interior inspection caught two real defects: outdoor fog was applied through the room, and small gaps between decorative timbers exposed the sky. Continuous wall cores and a ceiling now enclose the room, and the shared fog function subtracts the segment of the camera ray inside the hero cabin. The warm, enclosed result was visually confirmed in Edge and its storm-mode counterpart was captured in the in-app browser.

The local-light distance guard and shelter-aware fog were compiled and rendered successfully. A later in-app DOM snapshot reported `errors=0`, `frameCount=6783`, `drawCalls=332`, `gpuMs=5.046`, mode 2 at the forest camera. Edge screenshots showed a wide range of isolated GPU times (roughly 4–40 ms, at changing sizes), while two browser instances were also rendering; this still cannot establish steady-state performance.

The sound control successfully reached “环境声 开启” in Edge, the tab showed an audio-output icon, and the scene continued rendering. No subjective listening assessment was made. Free-flight rotation/translation, automatic tour, the narrow-screen breakpoint and no-WebGPU error case still need full interactive acceptance. An attempted numeric keyboard shortcut did not visibly change the camera during automation; keyboard normalization was extended to handle logical digits and missing hardware codes, but that final input fallback has not been visually retested.

The final Edge refresh was again stopped by the tool's URL-identification protection. No further UI input was issued after that stop. All final JavaScript and geometry checks were rerun. Final keyboard fallback and hidden-intro visibility changes have syntax verification but remain outside the completed interaction checks.

## Captured scene comparisons

The following in-app screenshots contain only this prototype's page, without private browser tabs:

- [静雪守夜](previews/night.jpg)
- [微缩雪镇](previews/village.jpg)
- [白障风暴](previews/storm.jpg)
- [风暴模式下的屋内](previews/interior.jpg)

## Manual acceptance route

Run `node tools/serve.mjs` and open the printed localhost URL in desktop Edge/Chrome. Compare all three environments from the same cabin view, then inspect village and interior. Drag to look, fly with WASD/Q/E, release keys and confirm smooth stopping; switch tabs and confirm there are no stuck keys. Toggle sound and compare inside/outside, try automatic tour, press H twice, resize the window, and leave the page running long enough to watch resolution settle.

For performance work, warm up first, then hold a fixed resolution and run a repeatable camera path. Report frame interval and GPU time separately, with mean/p99/max, adapter and viewport. Do not present the current adaptive snapshots as a stable 60 fps result or as evidence of gameplay quality.
