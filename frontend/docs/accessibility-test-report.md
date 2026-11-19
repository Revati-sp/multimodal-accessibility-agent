# Accessibility test report — AccessPilot frontend

**Build tested:** branch `feat/revati-accessibility`, demo mode (simulated data) unless noted.
**Date of automated runs:** 2026-11-18.

This report keeps three things separate: tests actually performed, tests still pending, and known limitations. **No manual screen-reader testing has been performed yet.**

## 1. Tests actually performed (automated)

| Area | How | Result |
|---|---|---|
| Axe scan (WCAG 2.0/2.1/2.2 A and AA tags): New Task, Task Progress, Approval dialog, Unknown outcome, History | `@axe-core/playwright` in Chromium, desktop and Pixel 7 viewport | 0 serious or critical violations |
| Keyboard-only journey: simulated transcript → correction → submit → approval → completion | Playwright, Tab and Enter only | Pass |
| Skip link is the first Tab stop and moves focus to `<main>` | Playwright | Pass |
| All progress-page controls reachable by Tab with a visible outline | Playwright | Pass |
| Approval dialog: heading focused on open, Escape closes it, focus returns to the opener | Playwright and RTL | Pass |
| Focus moves to the first invalid field; the error is in its accessible description | RTL | Pass |
| No horizontal scroll at phone width | Playwright (Pixel 7) | Pass |
| Live-region and TTS deduplication (same key never announced twice; reconnect replay suppressed) | Vitest and Playwright | Pass |
| TTS off by default, no speech on load, rate applied, secrets redacted | Vitest | Pass |
| Unknown-outcome wording; no Retry button | RTL and Playwright | Pass |
| Lint with `eslint-plugin-jsx-a11y` (strict) | ESLint | 0 errors |

Automated tools catch only part of WCAG. These results do not replace the manual checks below.

## 2. Manual checklist — PENDING (not yet performed)

Record the tester, date, OS, browser and assistive-technology version for each run. Mark each item Pass, Fail or N/A with notes.

### Screen reader (VoiceOver on macOS with Safari, or NVDA on Windows with Firefox or Chrome)

1. Load `/`. Headings list (VO: Ctrl+Opt+U → Headings; NVDA: Insert+F7) shows the h1 “Start a new task” and the h2s “Voice input (optional)” and “Describe your task”.
2. Form fields announce their label, hint and character count. Submitting empty announces the error and focus lands on the field.
3. Start a task. Focus lands on the h1 “Task progress”. Landmarks: banner, navigation “Main”, main, contentinfo.
4. Without looking at the screen, can the tester tell the current status, the plan version, the current step, and which step depends on which? (Plan list → each step's h3 and definition list.)
5. Live regions: “Approval needed …” is announced once (assertive). Step verification is announced politely. Nothing is repeated after pressing “Simulate connection drop (demo)”.
6. Approval dialog: announced as a dialog named “Approve this action?”. Exact arguments are readable. Tab stays inside the dialog. Escape closes it and focus returns to “Review action”.
7. Unknown outcome (scenario “Timeout after save”): the panel heading and the sentence “The action may have occurred, but it has not been confirmed.” are announced and understood. The tester can explain in their own words that the reminder may or may not exist.
8. History: “View journal for: …” links are distinguishable out of context.

### Keyboard only (no pointer)

9. Every interactive element is reachable and operable, including the `<details>` summaries, the speech settings, the scenario `<select>` and the range slider.
10. No keyboard trap anywhere other than the modal dialog, which is intentional and can be escaped with Escape.
11. The focus indicator is visible on every element, in both light and dark mode.

### Visual

12. Contrast spot-check of badges, notices and disabled buttons with a contrast analyser (target 4.5:1 for text, 3:1 for the focus ring).
13. 200% browser zoom and 320 CSS px width: no loss of content or function.
14. Windows High Contrast (forced colours): badges and notices keep their borders.
15. Status is understandable without colour (greyscale rendering).

### Motion and speech

16. With OS “Reduce motion” on, nothing animates.
17. TTS: enable it, change the rate and detail level, use Stop speaking. Spoken text matches the on-screen status. Nothing is spoken on page load.

### Unknown-outcome comprehension (research protocol)

18. Ask each participant: “Was the reminder created?” A correct answer is “not confirmed / unknown”, not “yes” or “no”. Record the time to answer and whether they chose a safe next action (Check again, What happened? or Stop).
19. Recruit blind and low-vision participants. Do not treat blindfolded sighted participants as equivalent.

## 3. Known limitations

- Manual screen-reader, zoom, forced-colours and contrast-analyser checks above are **pending**.
- Automated browser tests ran only in Chromium. Safari and Firefox are untested.
- Voice input was tested only with a simulated adapter and a permission-denied stub. A real microphone with real speech recognition has not been exercised automatically.
- TTS uses the browser's voices. Quality and queueing vary by platform.
- The live regions rely on screen-reader support for `aria-live`. Behaviour varies between VoiceOver and NVDA and must be confirmed manually (items 5 and 7).
- In gateway mode, announcements come from polling. A status that changes and changes back between polls is not announced.
