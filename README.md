# Word Warriors ⚔️

A multiplayer word battle game built entirely in the browser — **no external APIs required**.

Fight opponents by spelling words. Powerful letters, longer words, and special categories deal more damage. Heal yourself, raise shields, or unleash elemental fury!

---

## 🎮 Game Modes

| Mode | How to play |
|---|---|
| **Local 2-Player** | Pass the device; each player takes a turn forming words |
| **vs AI** | Battle the AI at Easy / Normal / Hard difficulty |
| **Online Multiplayer** | Real-time 1v1 via Socket.io — requires `server.js` |

---

## 🧩 Mechanics

### Letter Tiles
Each player draws **7 letter tiles** (like Scrabble).  
After playing a word, used tiles are replaced from the bag.  
A **★ Wild** tile can substitute any letter.

### Damage Formula
```
base   = sum of letter values in word
bonus  = (word_length - 2) × 2
damage = round(base + bonus) × category_multiplier
```

Letter values follow a Scrabble-like system — rare letters (Q, Z, X, J) score 8–10 pts; common vowels score 1 pt.

### Special Word Categories

| Category | Words | Effect |
|---|---|---|
| ⚔️ **WARRIOR** | sword, slash, blade, strike … | +50% damage |
| 💚 **HEAL** | heal, cure, mend, balm … | Restore HP (1.5× word value) |
| 🛡️ **SHIELD** | shield, guard, block, armor … | Gain shield (absorbs 50% of next hit) |
| 🔥 **FIRE** | fire, flame, blaze, scorch … | +25% damage + BURN (5 dmg/turn × 3) |
| ❄️ **ICE** | ice, frost, freeze, blizzard … | +25% damage + FREEZE (skip next turn) |
| ⚡ **LIGHTNING** | shock, bolt, thunder, zap … | +25% damage + STUN (50% dmg reduction) |
| ☠️ **POISON** | poison, venom, toxic, blight … | POISON (3 dmg/turn × 5 turns) |
| 🌑 **DARK** | death, doom, shadow, curse … | +25% damage + LIFESTEAL (25% returned) |
| 🌿 **NATURE** | leaf, vine, root, bloom … | Small heal + small attack |
| ✨ **ARCANE** | spell, rune, arcane, sigil … | +35% damage + Mana Drain (reduces shield) |

### ★ Wild Tiles
The `★` tile works as any letter. It has **0 point value** — using it is flexible but not powerful.

### Status Effects
- **🔥 BURN** — lose 5 HP per turn for 3 turns
- **❄️ FREEZE** — lose your next turn entirely
- **⚡ STUN** — your damage is halved for 1 turn
- **☠️ POISON** — lose 3 HP per turn for 5 turns (stacks!)
- **🩸 LIFESTEAL** — the attacker heals 25% of damage dealt

---

## 🚀 Running Locally (Static / vs AI)

No server needed for local or AI play:

```bash
# Just open in your browser
open index.html
# or use any static server:
npx serve .
```

---

## 🌐 Online Multiplayer Setup

### 1 — Install dependencies
```bash
npm install
```

### 2 — Start the server
```bash
node server.js
# Server starts at http://localhost:3000
```

### 3 — Play
1. Open `http://localhost:3000` in **two browser windows**  
2. Player 1: click **🌐 Online** → enter a name → **Create Room**  
3. Player 2: click **🌐 Online** → enter a name → paste the room code → **Join**  
4. Battle begins!

### Deploying online (so friends can play from anywhere)

Any Node.js-compatible host works. Popular free options:

| Platform | Notes |
|---|---|
| **Render** | Free tier; connect GitHub repo → auto-deploy |
| **Railway** | Generous free allowance; great DX |
| **Fly.io** | Free tier; great for persistent sockets |
| **Heroku** | Paid only now; still easy to configure |

Set the `PORT` environment variable if required by the host.  
The frontend auto-connects to the same origin (`io()` with no URL), so no config changes are needed.

---

## 🗺️ File Structure

```
word-warriors/
├── index.html          Main game page
├── style.css           Dark-fantasy UI styles
├── server.js           Node.js + Socket.io multiplayer server
├── package.json
├── js/
│   ├── wordBank.js     ~2200 word dictionary + combat categories
│   └── game.js         Game engine, AI, UI controller
└── README.md
```

---

## 📦 Word Bank

The game ships with an **internal word bank of ~2200 common English words** (2–8 letters) — no API calls, fully offline.

Special combat categories are a curated overlay on top of the base dictionary. Any word in a category is automatically valid.

---

## 🛣️ Roadmap / Ideas

- [ ] Ranked online matchmaking (requires auth + database)
- [ ] Animated spell effects / particle system
- [ ] More word categories (Holy, Chaos, Time, Void…)
- [ ] Bonus tiles (Double Letter, Double Word) on the rack
- [ ] Deck-building: unlock new tiles / abilities between rounds
- [ ] Spectator mode
- [ ] Mobile-friendly drag-and-drop tiles
