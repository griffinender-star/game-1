# Pixel Dugout · Pocket Baseball

An original touch-first, pixel-art baseball game inspired by classic pocket sports games. Time your swings, aim your pitches, and manage the New York Knights through a twelve-game season.

## Run

No dependency installation or build is required. From this directory:

```sh
npm start
# Or, without npm:
python3 -m http.server 8000 --bind 0.0.0.0
```

Open the server in a modern browser. The development `index.html` uses JavaScript modules and needs a web server.

## Single-file download

`Pixel-Dugout.html` includes all game code, styles, and graphics. It needs no server or connection in browsers that run local HTML. Regenerate it after source changes with:

```sh
npm run build:standalone
```

Open the file in a **web browser**, not a file preview. iPhone/iPad Files previews do not reliably execute interactive HTML games; a hosted link opened in Safari is the reliable way to play there. Some Android file viewers have the same restriction. The standalone file shows an explanation if scripting is disabled. Saves depend on the browser allowing local-file storage.

## Play on a phone

Upload this directory to any static web host over HTTPS, then open that address on your phone. For local development, a phone on the same Wi-Fi can use the development computer's network address and port 8000 when the firewall permits it. A cloud workspace's loopback address is not reachable from your phone; use your hosting platform's supported public URL.

- **iPhone/iPad:** Safari → Share → Add to Home Screen.
- **Android:** browser menu → Install app or Add to Home screen.
- Play in portrait or landscape. No keyboard or mouse is needed.
- On HTTPS (or localhost for development), loading the game installs its offline cache. Wait for **OFFLINE READY** before disconnecting. Browser installation options vary.

## Publish one link for iPhone, tablet, and computer

The website is ready for GitHub Pages. Nothing has been published by the local build.

1. In the `griffinender-star/game-1` GitHub repository, open **Settings → Pages** and set **Source** to **GitHub Actions**. Repository administration access is required for this setting.
2. Once publication is authorized, push the game and `.github/workflows/pages.yml` to `main`, or run **Publish Pixel Dugout** from the Actions tab after the workflow is on GitHub.
3. The workflow tests the rules, builds the clean `_site` directory, and publishes only the website files. Its deployment output supplies the real public address. Do not treat an expected Pages address as live before deployment succeeds.
4. Open the published HTTPS address in Safari on iPhone/iPad or a browser on the computer. In Safari, use **Share → Add to Home Screen** to keep it like an app.

Preview the exact publishing artifact locally with `npm run build:site`, then serve `_site` using a local web server. All asset paths and the offline cache work under the repository's `/game-1/` subpath. Publishing uses GitHub's built-in workflow token, not any game API key.

## Controls

- **Pitch:** drag the crosshair near the batter to aim. Hold the gold button and release in the green meter zone. Aim outside the dotted strike zone to tempt a chase. Poor release adds target error; tired pitchers lose command.
- **Bat:** tap READY FOR PITCH, watch the ball move toward the batter on the left, then tap SWING when the meter reaches green. Timing directly controls contact quality. TAKE lets the ball pass. CONTACT favors putting the ball in play; POWER can send a well-timed swing out of the park.
- **Manage:** reorder the lineup before the first pitch; use SUBS for a fresh arm or pinch hitter. Replaced players cannot return in the same game. STEAL is available with a runner on first and second empty.
- **Quick games:** three innings by default, with extras for ties and walk-off wins. Choose nine innings when starting a new season. SIM HALF advances the current half inning.
- **Keyboard:** Space readies/swings, or hold/release Space to pitch. Arrow keys adjust aim; Escape pauses. Buttons also support native keyboard activation.

Gameplay pauses while a dialog is open or when backgrounded. Progress saves locally after each resolved play, when browser storage is available. Use the same browser and site address to resume; clearing site data removes the save. The new arcade version uses a separate v2 save and leaves older manager-mode saves untouched.

## Verify

```sh
npm test
```

The dependency-free engine tests cover pitch outcomes, timing, runner advancement, innings, walk-offs, substitutions, steals, saves, and complete seasons. Mobile browser checks were also run in touch-enabled Chromium at 360×740, 390×844, 740×360, and 844×390, including timed touch batting, hold/release pitching, pause/resume, saved games, and offline reload. Physical iOS and Android device testing remains recommended before public release.

## Files

`engine.js` contains baseball and season rules; `stadium.js` draws the original pixel-art field; `app.js` handles animation, touch/keyboard controls, and browser saves. `sw.js`, the manifest, and icons enable offline and home-screen support. There are no external asset, font, ad, or API dependencies. Runner advancement and fielding are intentionally simplified arcade rules.
