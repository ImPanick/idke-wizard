```text
      /\
     /.*\        ASCII IDLE WIZARD
    /_.._\       [ explore · study · become ]
      ||
    __||__
```

# ASCII Idle Wizard

A complete ASCII idle RPG in **one HTML file**. Open it in a current browser
and play. No installation, build step, dependencies, external assets, accounts,
telemetry, or browser storage. The game makes no network calls.

The whole adventure is under **400 KiB** of HTML, CSS, and vanilla JavaScript.
Keep it on a USB stick, open it locally, or host the same file wherever you like.
Your progress lives in memory. **You decide when to export it and where to keep it.**

## Start playing

1. Download [ascii-idle-wizard.html](ascii-idle-wizard.html) and open it in a browser.
2. Your wizard explores and fights automatically. Use **WASD** or the **arrow keys**
   to move manually. Hover over enemies, chests, and equipment for details.
3. Learn spells in **Wizard → Elements**, arrange their priority in **Spellbook**,
   and equip your finds in **Equipment**. Spells cast in equipped order when ready.
4. Defeat a zone's dragon to open the next path. New ranks unlock more of your
   sanctum; milestones appear in the live field notes.
5. Before leaving, choose **Export save** and keep the code or download its text
   file. Choose **Import save** to continue later, including on another device.

There is **no autosave**. Closing or reloading the page discards progress made
since your last exported snapshot.

## Find your way around

The interface keeps the ASCII map central, groups related systems into chapters,
and adapts the navigation for smaller screens. Equipment crafting, gems, and
detailed character attributes fold away when you do not need them.

| Chapter | Contents |
|---|---|
| Adventure | World map and atlas, Pinnacle Trials, Crusade expeditions |
| Wizard | Spellbook, elemental study, equipment, inventory, gem sockets, gear combining |
| Sanctum | Manor, Research, Magic Tower, Legendary Forge, Alchemy, Golems, Familiars, Ritual |
| Legacy | Awakening preview and permanent upgrades |

Field notes show your next milestones, current encounter, recent earning and
damage rates, and the adventure chronicle. Export and import stay at the top.
Appearance and density controls live under **Settings**.

There are **7 palettes**: Field Grimoire (default), Dark Blue, Dark Forest,
Light Warm, Light Blue, Amber CRT, and High Contrast. Your exported save includes
the selected palette and density. Reduced motion follows your system preference.

All built-in art, icons, labels, and messages use **printable ASCII**. Map glyphs
occupy one character each, and font ligatures are disabled. There are no emoji,
box-drawing characters, icon fonts, or downloaded fonts. Imported names keep their
original text in saves; their display uses ASCII letters where possible and
`[U+XXXX]` notation for other characters. This avoids requiring those glyphs in
the device's fonts; the game itself still requires a current browser.

| Key | Action |
|---|---|
| `WASD` / arrows | Move the wizard |
| `Tab` / `Shift+Tab` | Move between controls |
| `Enter` / `Space` | Activate a focused button or disclosure |
| `Escape` | Close an export/import dialog |

## A world inside the file

- **10 zones**, from Verdant Meadow to Eldermyst, plus treasure dungeons.
- **8 elements and 52 spells**: damage, healing, buffs, damage over time,
  lifesteal, true damage, and elemental synergies. Arcane unlocks after Awakening.
- **6 passive elemental combinations**, including Eclipse, Steam, and Bloodmoon.
- **Spell mastery** grows with successful casts, up to level 10 at 20,000 casts.
  Each mastery level improves a spell's effect by 5%; mastery survives Awakening.
- **5 equipment slots, 6 tiers, and 5 rarities**, with sockets, cumulative set
  bonuses, gear combining, guaranteed-rarity crafts, and **8 unique legendaries**.
- **11 manor buildings**, material-gathering golems, and **8 familiar types**.
- **13 research projects**, a passive XP ritual, and alchemy with potion quality,
  brewing queues, and configurable automatic use.
- **Crusade expeditions** and **Pinnacle Trials**, an endless boss tower whose
  Essence upgrades persist across Awakening.
- **19 Awakening upgrades**, including permanent unlocks and options to retain
  equipment, spells, familiars, and research between journeys.

## Progression and time

Level requirements follow the world's reward curve, so later regions remain
reachable without the old runaway exponential XP requirement. Trials use a
steadier difficulty curve. Healing scales with a developed wizard, repeated
damage effects refresh sensibly, and familiar gains have diminishing returns.
The damage meter counts damage actually dealt, including staff attacks and
damage over time; overkill does not inflate it.

Awakening requires **level 24 and defeating Ember Drake in the current journey**.
The preview shows the Spark you will earn from your level and deepest unlocked
region. Each Awakening increases both difficulty and rewards.

The simulation uses elapsed time with 250 ms steps. Short timer delays are
processed when the browser runs the game again. Spell cooldowns recover during
travel and while automatic exploration is disabled.

For gaps longer than a minute, or when importing an older snapshot, the game
estimates up to **12 hours** of idle progress. Estimated combat rewards account
for your loadout and survivability and require Auto-Explore to be enabled.
Passive income, golem production, rituals, paid research, and brewing can also
advance. This estimate does not replay each encounter or award boss clears and
gear drops. Long interruptions end an active dungeon or Trial run.

## Your save belongs to you

**Export save** opens a snapshot of the current journey. Copy the code, select it
for manual copying, or download a `.txt` file. Opening the dialog alone does not
store a copy anywhere. Paste the code into anything that holds text and keep it
where you choose.

**Import save** accepts pasted codes or local text files. Importing replaces the
current journey. Invalid saves are rejected without partially overwriting your
character. Codes support Unicode, whitespace, line wrapping, and URL-safe base64.

The current save format is **v27**: UTF-8 JSON encoded as base64. It includes
active research, brewing progress, spell cooldowns, mastery, equipment, and UI
preferences. Older saves migrate to the new XP curve while preserving the hero's
level and fraction of progress toward the next level. Pre-v5 saves retain the
legacy migration that resets incompatible equipment, gems, and legendaries.

Maps and active encounters are regenerated when a save is imported. Previously
exported codes remain usable, and **Settings → Start over** only resets the
current in-memory journey.

## Footprint and development

| Resource | Game requirement |
|---|---|
| Files | One HTML file, under 400 KiB |
| External assets / services | None |
| Cookies / browser storage | None |
| Build step / dependencies | None |
| Persistence | Only the save codes or files you choose to keep |
| Clipboard / downloads | Used when you select the corresponding export action |

Use a current browser: the interface uses modern CSS features such as
`color-mix()` and `:has()`, as well as optional chaining and `TextEncoder`.

The optional regression suite uses Node's built-in test runner. No package
installation is needed; from the repository root, run:

```sh
node --test tests/*.test.cjs
```

Tests cover progression, Trial rewards, generated-map connectivity, damage and
healing, cooldowns, elapsed time, manual save round trips, older-save migration,
invalid-save rejection, and idle project completion. These are mechanics tests;
they do not claim browser layout or cross-browser coverage.

## Credits

By **Joseph Jeffrey**, in collaboration with Claude.

ASCII art and game design by the author. Inspired by the tradition of games
that fit in a single HTML file: a small, portable world you can open, inspect,
and carry with you.

## License

See repository for license terms.
