# Pixel Dugout · Pocket Baseball

An original touch-first, pixel-art baseball game inspired by classic pocket sports games. Create a manager, inherit a struggling New York Knights club, and rebuild it through drafts, trades, and player development. Play every pitch across twelve-game seasons.

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

## Update the published website

The live game is at **https://griffinender-star.github.io/game-1/**. It uses GitHub Pages with **Deploy from a branch → gh-pages → / (root)**.

After testing an update:

```sh
npm test
npm run build:standalone
npm run publish:pages
```

`publish:pages` builds the `_site` directory and updates only the public website files on `gh-pages`, using the existing Git authentication. It preserves the source checkout and staging area, never force-pushes, and skips unchanged content. GitHub's native Pages workflow then deploys the branch. Check its successful deployment before announcing the update. `node scripts/publish-pages.mjs --dry-run` reviews a prepared build without pushing.

The optional manual workflow in `.github/workflows/pages.yml` is an alternative only for repositories whose Pages Source is set to GitHub Actions. It does not run automatically because this site currently publishes from `gh-pages`.

All asset paths, career modules, and offline files support the `/game-1/` subpath. The public game needs no API credentials. Saved careers stay on each device, not in the repository.

## Your manager career

1. Choose **Create Your Manager**, enter a name, select a portrait and coaching style, and sign the contract. The Knights begin after a fictional 2–10 season with a genuinely weak 47 OVR roster.
2. Rebuild from **Front Office → Draft Room / Trade Desk**. Draft picks replace a chosen player at no credit cost. Trades require an outgoing player plus club credits. Review the deal before confirming; the signed player's actual attributes immediately replace that roster slot.
3. Roster moves lock while a game is underway and reopen after the final out. Each completed game earns credits, wins earn extra, and career goals award one-time bonuses.
4. Complete twelve games and choose **Start Next Season**. Keep your manager, roster, and credits. Players develop toward their potential, the season enters your career log, and new draft picks and trade offers arrive.

**Scout:** three opening draft picks (two in later seasons). **Developer:** +4 offseason ratings instead of +2, capped by player potential. **Tactician:** six extra starting credits. New managers otherwise receive two picks and 14 credits.

Your manager, finances, roster, and game progress save together. Existing pre-career games can still be continued from the title screen. Replacing an existing career requires explicit confirmation.

## Controls

- **Pitch:** drag the crosshair near the batter to aim. Hold the gold button and release in the green meter zone. Aim outside the dotted strike zone to tempt a chase. Poor release adds target error; tired pitchers lose command.
- **Bat:** tap READY FOR PITCH, watch the ball move toward the batter on the left, then tap SWING when the meter reaches green. Timing directly controls contact quality. TAKE lets the ball pass. CONTACT favors putting the ball in play; POWER can send a well-timed swing out of the park.
- **Manage:** reorder the lineup before the first pitch; use SUBS for a fresh arm or pinch hitter. Replaced players cannot return in the same game. STEAL is available with a runner on first and second empty.
- **Quick games:** three innings by default, with extras for ties and walk-off wins. Choose three or nine innings when creating your manager. SIM HALF advances the current half inning.
- **Keyboard:** Space readies/swings, or hold/release Space to pitch. Arrow keys adjust aim; Escape pauses. Buttons also support native keyboard activation.

Gameplay pauses while a dialog is open or when backgrounded. Progress saves locally after each resolved play, when browser storage is available. Use the same browser and site address to resume; clearing site data removes the save. Careers use the existing v2 save format with validated career data; older v1 saves remain untouched.

## Verify

```sh
npm test
```

All 26 dependency-free engine tests cover baseball rules, manager creation, weak starting rosters, draft and trade eligibility, real player improvements, credits, save compatibility, and progression across complete careers. Mobile browser checks were also run in touch-enabled Chromium at 360×740, 390×844, 740×360, and 844×390, including timed touch batting, hold/release pitching, pause/resume, saved games, and offline reload. Career browser checks cover creation, appearance/style, transaction confirmation/cancellation, drafted/traded players joining the lineup, persistent saves, offseason training, and offline career continuation at phone, tablet, and desktop sizes. Physical Apple-device testing remains unverified.

## Files

`career-ui.js` and `career.css` provide the title, manager creator, and front office. `engine.js` contains baseball and career rules; `stadium.js` draws the original pixel-art field; `app.js` handles animation, touch/keyboard controls, and browser saves. `sw.js`, the manifest, and icons enable offline and home-screen support. There are no external asset, font, ad, or API dependencies. Runner advancement and fielding are intentionally simplified arcade rules.
