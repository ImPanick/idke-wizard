```
   _____ _____ _____ _____ _____    _____ ____  __    _____    _    _ _____ _____ _____ ____  ____
  |  _  |   __|     |     |     |  |     |    \|  |  |   __|  | |  | |     |__   |  _  |    \|    \
  |     |__   |   --|-   -|-   -|  |-   -|  |  |  |__|   __|  | |/\| |-   -|   __|     |  |  |  |  |
  |__|__|_____|_____|_____|_____|  |_____|____/|_____|_____|  |__/\__|_____|_____|__|__|____/|____/
```

# ASCII Idle Wizard

> **Single-file. Browser-native. Works where nothing else can.**

A complete idle / AFK dungeon-smasher game in **one HTML file**. No install, no
build step, no dependencies, no network calls after the page loads. Save it to
a USB stick, drop it on a locked-down work laptop, open it in whatever browser
IT left you with — it just runs.

Built for people stuck in tightly-controlled IT environments who still want
something to play. The whole game is `~210 KB` of HTML / CSS / vanilla JS in a
single file. No exe, no jar, no Steam, no launcher, no telemetry, no auto-
updater. The only thing it touches is `localStorage` (for your save).

---

## Why this exists

Most "browser games" ship with a server, a CDN, ads, analytics, or all four.
This one ships with **nothing**:

- **One file.** Open `ascii-idle-wizard.html` and play.
- **Zero network traffic.** After the page is in the browser cache, you can
  pull the ethernet cable and keep playing forever.
- **No external assets.** No fonts, no images, no audio, no `<script src=…>`.
  Everything is inline.
- **No install.** `file://` URL, intranet share, USB stick, GitHub Pages, your
  own domain — same file, same game.
- **No accounts.** No login, no email, no "connect with Google."
- **No tracking.** No cookies, no fingerprinting, no analytics endpoints. The
  only thing written to disk is your save, and the only thing read back is
  your save.
- **Save anywhere.** Export as a base64 string and paste it into Notes, an
  email draft, a Slack DM to yourself — anything that holds text.
- **One author, one file, no supply chain.** No `node_modules`, no third-party
  CSS framework, no transitively-pulled package. What you see in the file is
  what runs.

If your environment lets you open an HTML file in a browser, you can play.
That's the entire deployment story.

---

## What it is

ASCII Idle Wizard is a **post-Apprentice mage power fantasy** with the depth
of a real idle / RPG hybrid:

- **11 zones** from Verdant Meadow → Eldermyst, scaling level 1 → 130
- **8 elements** (Fire, Water, Earth, Air, Light, Shadow, Blood, plus
  Arcane unlocked via Awakening) with strong/weak matchups
- **47 spells** spanning damage, heal, buff, DoT, leech, true-damage,
  cooldown reduction, balanced-affinity, and ult tier
- **Per-spell mastery** that survives prestige (10h of casting per spell to max)
- **Generic gear system**: 5 slots × 6 tiers × 5 rarities, with gem
  sockets, set bonuses (2/3/4/5pc), forge consolidation, and a Tower for
  guaranteed-rarity crafts
- **8 unique Legendaries** at Archmage with bespoke effects
  (cooldown reduction, undead-piercing, per-element damage scaling, etc.)
- **6 passive elemental combos** — equip Light + Shadow for Eclipse, Fire +
  Water for Steam, Blood + Shadow for Bloodmoon, etc.
- **Wizard's Manor** — 11 upgradeable buildings
- **Golems** that mine dust / crystal / gem materials while you AFK
- **Familiars** — 8 types × 5 rarities, summoned via 4 tiers of gacha
- **Arcane Research** — 13 projects with auto-research at Magus rank
- **Ritual** — passive XP channel that forks across the elements of your
  equipped spells
- **Crusade** — timed expeditions from 30s to 8h
- **Pinnacle Trials** — endless boss tower yielding ◆ Essence (the
  cross-prestige currency)
- **Awakening** — full prestige loop with ✦ Spark, ascending difficulty
  tiers, and 19 nodes including permanent unlocks (keep gear / spells /
  familiars / research / starting level on Awaken)

Combat is fully automatic (auto-explore on by default), but everything is
clickable when you want hands-on control: WASD / arrow keys for movement,
keyboard-friendly tab navigation.

---

## Features

- **8 themes**: Dark Purple, Dark Blue, Dark Forest, Light Warm, Light Blue,
  Amber CRT, High Contrast — switch any time, persisted in your save.
- **Instant tooltips** — no 500ms native-title delay; hover any mob or chest
  on the map for live stats.
- **Gear comparison on hover** — hover any item in your inventory to see a
  side-by-side stat diff vs whatever's currently equipped in that slot.
- **Set bonuses** — six tiered sets (Apprentice → Void) with cumulative
  2/3/4/5-piece bonuses. Crafted Legendaries count toward their tier.
- **Spell mastery** — every cast counts, levels up forever, persists across
  Awakening cycles.
- **Idle catch-up** — close the tab for up to 12 hours, come back to
  accumulated golem yields.
- **Save anywhere** — export to clipboard / paste into anything.
  Unicode-safe base64. Imports tolerate whitespace, line wrapping, and
  URL-safe variants — paste survives email / chat / forum round-trips.

---

## How to play

1. **Get the file.** Clone the repo or download `ascii-idle-wizard.html`
   directly from GitHub.
2. **Open it.** Double-click. Drag onto a browser window. Open from a USB
   stick over `file://`. Host it on an intranet share. Whatever works in
   your environment.
3. **Cast a spell.** Auto-explore is on by default. Equipped spells fire on
   cooldown when an enemy is in range.
4. **Pick a tab.** World shows the map and your hero. Spellbook, Elements,
   Gear, Manor, etc. all live in their own tabs.
5. **Save survives reloads.** Your progress autosaves to `localStorage`. To
   move it elsewhere, hit **Export Save** — paste the base64 anywhere
   that holds text. Hit **Import Save** to restore.

### Keyboard

| Key | Action |
|---|---|
| `WASD` / arrows | Move the hero manually |
| `Tab` / `Shift+Tab` | Cycle focus across panels |
| Click any tab button | Switch tab |

---

## Footprint

| Resource | Cost |
|---|---|
| Disk | one HTML file (~210 KB) |
| Network | zero requests after initial load |
| Cookies | none |
| LocalStorage | one key (`ascii-idle-wizard` save data, base64 JSON) |
| Permissions requested | none |
| External services | none |
| Build step | none |
| Dependencies | none |

---

## Browser support

Anything modern. The game uses standard HTML5 / CSS3 / ES2018 features
(template literals, spread, optional chaining, `TextEncoder`, `localStorage`).
If your browser ran a chat app this decade, it'll run this.

Tested on:
- Chrome / Chromium-based browsers
- Firefox
- Safari
- Edge

---

## Saves & data

- Saves are written to `localStorage` under your browser's origin (or the
  `file://` pseudo-origin if you opened it directly).
- **Export Save** copies a base64-encoded JSON blob to your clipboard.
  Internally it's just `JSON → UTF-8 bytes → base64`. The decoder is robust
  to whitespace / line breaks / URL-safe variants — paste survives
  most clipboard round-trips.
- **Import Save** accepts both modern saves and pre-v5 legacy ones (legacy
  imports will reset your wardrobe and inventory because the gear schema
  changed, but everything else carries over).
- **Hard Reset** wipes the save and reloads the page. The button confirms
  twice. Don't worry about misclicks.

---

## Credits

By **Joseph Jeffrey**.

ASCII art and game design by the author. Single-file architecture inspired by
the long tradition of "one HTML, no excuses" web games — `notpron`, `Cookie
Clicker`'s early builds, every restricted-IT-environment mage who ever opened
View Source for entertainment.

---

## License

See repository for license terms.

---

```
   ⌬   ASCII IDLE WIZARD   ⌬
       Cast a spell. Slay something. AFK forever.
```
