# Cha Chaan Teng Rush

A top-down Overcooked-style Hong Kong diner kitchen arcade game built with vanilla HTML, CSS, and JavaScript — no frameworks, no dependencies, no build step.

## Play

Just open `index.html` in any modern browser, or visit the live site (see deployment below).

## Controls

| Key | Action |
|---|---|
| W A S D / Arrow Keys | Move chef |
| SHIFT (hold) | Sprint / Run (2× speed) |
| SPACE / E | Interact (Pick up / Place / Serve / Trash) |
| Mobile | D-Pad to move · SPRINT button to run · INTERACT to act |

## Recipes

Assemble ingredients on the Assembly Table in any order — if the tray matches a recipe, it auto-assembles into a dish!

| Dish | Ingredients |
|---|---|
| 🧋 HK Milk Tea | Tea + Evaporated Milk |
| 🍍 Pineapple Bun | Bun + Butter |
| 🍜 Satay Beef Noodles | Instant Noodles + Satay Beef + Egg |
| 🍞 HK French Toast | Toast + Peanut Butter + Syrup |

## How It Works

- **Top-down kitchen** with ingredient stations, an assembly table, trash can, and three delivery counters.
- **Carry up to 3 ingredients** at once — they stack above the chef's head. Drop them all onto the assembly tray with a single INTERACT press.
- **Assemble dishes** by matching ingredients to a recipe. Pick up the finished dish and serve it to the matching customer at the delivery counter.
- **Customer patience** — each customer has a patience bar that depletes over time. Serve them before it runs out!
- **3-phase difficulty** — the lunch rush escalates: Phase 1 (Relaxed, 22s patience, 2 customers) → Phase 2 (Medium Rush, 21s, 3 customers) → Phase 3 (Rush Hour!, 20s, 3 customers).
- **Scoring** — +$50 for a correct serve with +2s bonus time. -$20 for a wrong dish or expired patience. Screen shake on failure.
- **Ranks** — Trainee Waiter (<$200), Experienced Captain ($200–500), Legendary Master Chef (>$500).
- **60-second shift** — the final 10 seconds tick audibly.
- **Web Audio** — synthesized background music (Canto-pop-inspired chiptune at 130 BPM) and SFX, no external audio files.
- **Interactive tutorial** — 5-step guided walkthrough using the Milk Tea recipe.
- **High score** saved to localStorage.

## Deploy to GitHub Pages

1. **Create a new repository** on GitHub (e.g., `cha-chaan-teng-rush`).

2. **Push the files** to your repo:

   ```bash
   git init
   git add .
   git commit -m "Initial commit: Cha Chaan Teng Rush game"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/cha-chaan-teng-rush.git
   git push -u origin main
   ```

3. **Enable GitHub Pages**:
   - Go to your repo on GitHub → **Settings** → **Pages**.
   - Under **Source**, select **Deploy from a branch**.
   - Choose **main** branch and **/ (root)** folder.
   - Click **Save**.

4. **Wait ~1 minute**, then visit:
   ```
   https://YOUR_USERNAME.github.io/cha-chaan-teng-rush/
   ```

That's it — your game is live and anyone can play it.

## Files

| File | Description |
|---|---|
| `index.html` | Page structure |
| `style.css` | All styling (HUD, canvas, controls, overlays, title screen) |
| `game.js` | Game logic (movement, collision, stations, customers, recipes, BGM, SFX, tutorial, rendering) |

## License

MIT — do whatever you want with it.
