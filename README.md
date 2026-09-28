# Modal `Sheet` first open waits on a UI-thread callback: overlay shows, frame never slides in (native)

Minimal reproduction for a `@tamagui/sheet` bug on React Native. The first time a `SheetImplementationCustom` instance measures itself, it jumps the frame to `screenSize` with `animatedNumber.setValue(screenSize, { type: 'timing', duration: 0 }, cb)`. Nothing animates until `cb` runs, because `cb` is the only place that sets `disableAnimation` back to `false` (after a `setTimeout(10)`). With `@tamagui/animations-reanimated`, `cb` is delivered through `runOnUI` → `withTiming` → `runOnJS`. If that callback never makes it back to JS, the sheet stays open forever with its overlay on screen and its frame parked at `translateY = screenSize`, just below the screen. There is no fallback.

In our production app this shows up as a flaky e2e failure under load (Maestro, Android emulator, release build): the screen is dimmed by the overlay and the frame never appears. We cannot make the callback go missing on demand on a device, so the test below simulates it.

## Branches

| Branch     | tamagui            | What it shows                                                                                           |
| ---------- | ------------------ | ------------------------------------------------------------------------------------------------------- |
| `main`     | 2.7.7 (latest)     | Stock behavior. `pnpm test`: 1 failed, 1 passed. The frame is still at `screenSize` 10s after opening.   |
| `with-fix` | 2.7.7 + pnpm patch | The first-mount jump uses `{ type: 'direct' }`, so the callback runs synchronously in JS. 2 passed.      |

## Steps

```sh
pnpm install
pnpm test               # main: 1 failed (Expected: 544, Received: 844)

git checkout with-fix
pnpm install            # applies patches/@tamagui__sheet@2.7.7.patch
pnpm test               # 2 passed
```

[`sheet.test.tsx`](sheet.test.tsx) renders [`app/index.tsx`](app/index.tsx) (one `<Sheet modal snapPointsMode="fit">` with the `@tamagui/config/v5-reanimated` driver), opens it, feeds it layout (screen 844, frame 300) and reads the sheet's animated number, which is the frame's `translateY`. It needs no simulator.

It uses reanimated's official jest mock with one change: `runOnJS` does not run inline. It queues the call until the test delivers it, as a stand-in for the UI → JS thread hop.

- `the sheet slides in once the ui thread answers`: the test delivers the queued call and the frame reaches its open position (544). Passes on both branches.
- `the first open does not wait on a callback from the ui thread`: the queued call is never delivered, which is what a lost hop looks like. On `main` the overlay is mounted and the frame is still at 844 after 10s. On `with-fix` the frame reaches 544.

The test does not prove why the callback goes missing on a device. It shows that the first open depends on it and has no fallback.

## Expected

Opening a modal sheet should not depend on an animation driver's completion callback making it back from the UI thread, or it should at least have a fallback. Closing already has one: a 1s timer, added because drivers may not fire `onFinish`.

## Fix used in `with-fix`

In `SheetImplementationCustom.native.js`:

```diff
       animatedNumber.setValue(screenSize, {
-        type: "timing",
-        duration: 0
+        type: "direct"
       }, function () {
```

## Versions

- tamagui / @tamagui/sheet / @tamagui/animations-reanimated 2.7.7. The chain is the same on `main` and in 3.0.0-beta.1479.1.
- react-native-reanimated 4.5.1, react-native-worklets 0.10.1
- expo 57.0.25, expo-router 57.0.23, react-native 0.86.3, react 19.2.3
