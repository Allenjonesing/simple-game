/**
 * Word Warriors — Main Game Engine
 * Handles: letter tiles, game state, turn engine, AI, damage/effects, UI.
 */

// ─────────────────────────────────────────────────────────────────────────────
// LETTER SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
const LETTER_VALUES = {
  A:1, E:1, I:1, O:1, U:1, N:1, R:1, S:1, T:1, L:1,
  D:2, G:2,
  B:3, C:3, M:3, P:3,
  F:4, H:4, V:4, W:4, Y:4,
  K:5,
  J:8, X:8,
  Q:10, Z:10,
  '★':0,
};

// Tile bag (like Scrabble but slightly more vowels for playability)
const TILE_BAG_TEMPLATE = {
  A:9, B:2, C:2, D:4, E:12, F:2, G:3, H:2, I:9, J:1,
  K:1, L:4, M:2, N:6, O:8, P:2, Q:1, R:6, S:4, T:6,
  U:4, V:2, W:2, X:1, Y:2, Z:1, '★':2,
};

// Build a shuffled tile bag array
function buildTileBag() {
  const bag = [];
  for (const [letter, count] of Object.entries(TILE_BAG_TEMPLATE)) {
    for (let i = 0; i < count; i++) bag.push(letter);
  }
  return shuffle(bag);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const MAX_HP = 100;
const RACK_SIZE = 7;
const BURN_DMG = 5;
const POISON_DMG = 3;
const BURN_TURNS = 3;
const POISON_TURNS = 5;
const SHIELD_ABSORB = 0.5;   // shield absorbs 50% of incoming damage

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────────────────────────────────────────
const GameState = {
  mode: null,           // 'local' | 'ai' | 'online'
  turn: 0,              // 0 = player1, 1 = player2/AI
  players: [],          // [player1Data, player2Data]
  tileBag: [],
  log: [],              // battle log entries
  phase: 'MENU',        // MENU | PLAYING | GAMEOVER
  socket: null,         // Socket.io socket (online mode)
  roomCode: null,
  myPlayerIndex: 0,
  aiDifficulty: 'normal', // 'easy' | 'normal' | 'hard'
};

function createPlayer(name, index) {
  return {
    name,
    index,
    hp: MAX_HP,
    shield: 0,
    status: [],           // [{type, turnsLeft, value}]
    rack: [],             // current tile letters
    selectedWord: [],     // [{letter, rackIdx}]
    score: 0,
    wordsPlayed: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TILE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
function drawTiles(player, count) {
  let safety = 0;
  while (player.rack.length < RACK_SIZE && count > 0 && safety++ < 200) {
    if (GameState.tileBag.length === 0) {
      GameState.tileBag = buildTileBag();
    }
    player.rack.push(GameState.tileBag.pop());
    count--;
  }
}

function rackAfterWord(rack, selectedWord) {
  const remaining = [...rack];
  // Remove used tiles (by index, highest first to avoid shifting issues)
  const usedIndices = selectedWord.map(s => s.rackIdx).sort((a, b) => b - a);
  for (const idx of usedIndices) remaining.splice(idx, 1);
  return remaining;
}

// ─────────────────────────────────────────────────────────────────────────────
// DAMAGE & EFFECTS CALCULATION
// ─────────────────────────────────────────────────────────────────────────────
function calcWordScore(word) {
  let pts = 0;
  for (const ch of word.toUpperCase()) {
    pts += LETTER_VALUES[ch] || 0;
  }
  return pts;
}

function calcDamage(word, categoryKey, attacker, defender) {
  const letterScore = calcWordScore(word);
  const lengthBonus = Math.max(0, word.length - 2) * 2;
  let base = letterScore + lengthBonus;

  const cat = categoryKey ? getCategoryData(categoryKey) : null;
  const multiplier = cat ? (cat.multiplier || 1.0) : 1.0;
  let damage = Math.round(base * multiplier);

  // Stun reduces attacker's damage by 50% this turn
  if (hasStatus(attacker, 'STUN')) damage = Math.round(damage * 0.5);

  // Apply shield absorption to defender
  let absorbed = 0;
  if (defender.shield > 0) {
    absorbed = Math.min(defender.shield, Math.round(damage * SHIELD_ABSORB));
    damage = Math.max(0, damage - absorbed);
  }
  return { damage, absorbed, letterScore, lengthBonus, multiplier };
}

function hasStatus(player, type) {
  return player.status.some(s => s.type === type);
}

function addStatus(player, type, turnsLeft, value = 0) {
  // Remove old of same type, then add new (no stacking by default except POISON)
  if (type !== 'POISON') {
    player.status = player.status.filter(s => s.type !== type);
  }
  player.status.push({ type, turnsLeft, value });
}

function processStatusEffects(player) {
  const msgs = [];
  const nextStatus = [];
  for (const s of player.status) {
    if (s.type === 'BURN') {
      player.hp = Math.max(0, player.hp - BURN_DMG);
      msgs.push(`🔥 ${player.name} burns for ${BURN_DMG} damage!`);
    } else if (s.type === 'POISON') {
      player.hp = Math.max(0, player.hp - POISON_DMG);
      msgs.push(`☠️ ${player.name} is poisoned for ${POISON_DMG} damage!`);
    }
    // STUN and FREEZE are handled in turn logic, just decrement
    const remaining = s.turnsLeft - 1;
    if (remaining > 0) nextStatus.push({ ...s, turnsLeft: remaining });
    else if (s.type === 'STUN') msgs.push(`⚡ ${player.name}'s stun fades.`);
    // FREEZE expiry is announced by nextTurn when the frozen turn is skipped
  }
  player.status = nextStatus;
  return msgs;
}

// ─────────────────────────────────────────────────────────────────────────────
// WORD SUBMISSION — applies effects to game state
// ─────────────────────────────────────────────────────────────────────────────
function submitWord(playerIndex, word, selectedWord) {
  const attacker = GameState.players[playerIndex];
  const defenderIndex = playerIndex === 0 ? 1 : 0;
  const defender = GameState.players[defenderIndex];

  const categoryKey = getWordCategory(word);
  const cat = categoryKey ? getCategoryData(categoryKey) : null;
  const { damage, absorbed, letterScore, lengthBonus, multiplier } = calcDamage(word, categoryKey, attacker, defender);

  let logEntries = [];
  let healAmt = 0;
  let shieldAmt = 0;

  if (categoryKey === 'HEAL') {
    // Heals the attacker; no damage
    healAmt = Math.round((letterScore + lengthBonus) * 1.5);
    attacker.hp = Math.min(MAX_HP, attacker.hp + healAmt);
    logEntries.push(`💚 <b>${attacker.name}</b> used <em>${word.toUpperCase()}</em> — healed <b>${healAmt} HP</b>!`);
  } else if (categoryKey === 'SHIELD') {
    // Adds shield to attacker; no damage
    shieldAmt = letterScore + lengthBonus;
    attacker.shield += shieldAmt;
    logEntries.push(`🛡️ <b>${attacker.name}</b> used <em>${word.toUpperCase()}</em> — gained <b>${shieldAmt} Shield</b>!`);
  } else if (categoryKey === 'NATURE') {
    // Small heal + small damage
    healAmt = Math.round((letterScore + lengthBonus) * 0.5);
    attacker.hp = Math.min(MAX_HP, attacker.hp + healAmt);
    defender.hp = Math.max(0, defender.hp - damage);
    logEntries.push(`🌿 <b>${attacker.name}</b> used <em>${word.toUpperCase()}</em> — healed <b>${healAmt}</b> and dealt <b>${damage} dmg</b> to ${defender.name}!`);
    if (absorbed > 0) logEntries.push(`🛡️ ${defender.name}'s shield absorbed ${absorbed} damage.`);
  } else {
    // Standard attack
    defender.hp = Math.max(0, defender.hp - damage);
    const catLabel = cat ? ` ${cat.label}` : '';
    logEntries.push(`⚔️ <b>${attacker.name}</b> played <em>${word.toUpperCase()}</em>${catLabel} — dealt <b>${damage} dmg</b> to ${defender.name}!`);
    if (absorbed > 0) logEntries.push(`🛡️ ${defender.name}'s shield absorbed ${absorbed} damage.`);
    if (multiplier > 1) logEntries.push(`✨ ${cat.description}`);

    // Apply status effects
    if (categoryKey === 'FIRE') {
      addStatus(defender, 'BURN', BURN_TURNS);
      logEntries.push(`🔥 ${defender.name} is now BURNING!`);
    } else if (categoryKey === 'ICE') {
      addStatus(defender, 'FREEZE', 1);
      logEntries.push(`❄️ ${defender.name} is FROZEN! Loses next turn.`);
    } else if (categoryKey === 'LIGHTNING') {
      addStatus(defender, 'STUN', 1);
      logEntries.push(`⚡ ${defender.name} is STUNNED! 50% damage reduction next turn.`);
    } else if (categoryKey === 'POISON') {
      addStatus(defender, 'POISON', POISON_TURNS);
      logEntries.push(`☠️ ${defender.name} is POISONED!`);
    } else if (categoryKey === 'DARK') {
      const steal = Math.round(damage * 0.25);
      attacker.hp = Math.min(MAX_HP, attacker.hp + steal);
      logEntries.push(`🌑 ${attacker.name} lifesteals ${steal} HP!`);
    } else if (categoryKey === 'ARCANE') {
      // Drain 5 shield from defender as "mana drain"
      const drained = Math.min(defender.shield, 5);
      defender.shield = Math.max(0, defender.shield - drained);
      if (drained > 0) logEntries.push(`✨ ${defender.name}'s shield drained by ${drained}!`);
    }
  }

  // Update score
  attacker.score += damage + healAmt + shieldAmt;
  attacker.wordsPlayed++;

  // Remove used tiles and draw new ones
  attacker.rack = rackAfterWord(attacker.rack, selectedWord);
  drawTiles(attacker, RACK_SIZE - attacker.rack.length);
  attacker.selectedWord = [];

  addLog(logEntries, categoryKey);

  return { damage, healAmt, shieldAmt, categoryKey, logEntries };
}

function addLog(entries, categoryKey) {
  const cat = categoryKey ? getCategoryData(categoryKey) : null;
  for (const entry of entries) {
    GameState.log.unshift({ html: entry, color: cat ? cat.color : '#ddd' });
  }
  if (GameState.log.length > 20) GameState.log.length = 20;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI OPPONENT
// ─────────────────────────────────────────────────────────────────────────────
function findBestAIWord(rack) {
  const letters = rack.map(l => l.toUpperCase());
  const candidates = [];

  for (const word of VALID_WORDS) {
    if (word.length < 2 || word.length > RACK_SIZE) continue;
    if (!canFormWord(word, letters)) continue;
    const score = calcWordScore(word) + Math.max(0, word.length - 2) * 2;
    const catKey = getWordCategory(word);
    const cat = catKey ? getCategoryData(catKey) : null;
    const bonus = cat ? (cat.multiplier || 1) : 1;
    candidates.push({ word, score: Math.round(score * bonus), catKey });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);

  const diff = GameState.aiDifficulty;
  let pick;
  if (diff === 'easy') {
    // Pick randomly from bottom 50%
    const pool = candidates.slice(Math.floor(candidates.length / 2));
    pick = pool[Math.floor(Math.random() * pool.length)];
  } else if (diff === 'hard') {
    // Always best
    pick = candidates[0];
  } else {
    // Normal: pick from top 30%
    const pool = candidates.slice(0, Math.max(1, Math.floor(candidates.length * 0.3)));
    pick = pool[Math.floor(Math.random() * pool.length)];
  }
  return pick;
}

function buildSelectedWordFromRack(word, rack) {
  const available = rack.map((l, i) => ({ letter: l, rackIdx: i, used: false }));
  const selected = [];
  for (const ch of word.toUpperCase()) {
    let tile = available.find(t => !t.used && t.letter === ch);
    if (!tile) tile = available.find(t => !t.used && t.letter === '★');
    if (!tile) return null;
    tile.used = true;
    selected.push({ letter: tile.letter, rackIdx: tile.rackIdx });
  }
  return selected;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function setScreen(name) {
  for (const el of $$('.screen')) el.classList.remove('active');
  const el = $(`screen-${name}`);
  if (el) el.classList.add('active');
}

function hpColor(pct) {
  if (pct > 0.5) return '#44ff88';
  if (pct > 0.25) return '#ffdd44';
  return '#ff4444';
}

function statusIcons(player) {
  return player.status.map(s => {
    if (s.type === 'BURN') return `🔥(${s.turnsLeft})`;
    if (s.type === 'POISON') return `☠️(${s.turnsLeft})`;
    if (s.type === 'FREEZE') return `❄️`;
    if (s.type === 'STUN') return `⚡(${s.turnsLeft})`;
    return '';
  }).join(' ');
}

function renderPlayerPanel(player) {
  const panel = $(`player${player.index + 1}-panel`);
  if (!panel) return;
  panel.querySelector('.player-name').textContent = player.name;
  const hpPct = player.hp / MAX_HP;
  panel.querySelector('.hp-fill').style.width = `${Math.round(hpPct * 100)}%`;
  panel.querySelector('.hp-fill').style.background = hpColor(hpPct);
  panel.querySelector('.hp-text').textContent = `${player.hp}/${MAX_HP}`;
  panel.querySelector('.shield-text').textContent = player.shield > 0 ? `🛡️ ${player.shield}` : '';
  panel.querySelector('.status-text').textContent = statusIcons(player);
  panel.querySelector('.score-text').textContent = `Score: ${player.score}`;
}

function renderBattleLog() {
  const log = $('battle-log');
  if (!log) return;
  log.innerHTML = GameState.log.map(e =>
    `<div class="log-entry" style="color:${e.color}">${e.html}</div>`
  ).join('');
}

function renderRack(playerIndex) {
  const player = GameState.players[playerIndex];
  const rackEl = $('rack-tiles');
  if (!rackEl) return;
  rackEl.innerHTML = '';
  player.rack.forEach((letter, idx) => {
    const isUsed = player.selectedWord.some(s => s.rackIdx === idx);
    const tile = document.createElement('div');
    tile.className = `tile${isUsed ? ' used' : ''}`;
    tile.dataset.idx = idx;
    const val = LETTER_VALUES[letter] !== undefined ? LETTER_VALUES[letter] : '';
    tile.innerHTML = `<span class="tile-letter">${letter}</span><span class="tile-val">${val}</span>`;
    if (!isUsed) {
      tile.addEventListener('click', () => onTileClick(idx));
    }
    rackEl.appendChild(tile);
  });
}

function renderWordArea() {
  const player = GameState.players[GameState.turn];
  const wordEl = $('current-word');
  if (!wordEl) return;
  wordEl.innerHTML = '';
  player.selectedWord.forEach((s, pos) => {
    const tile = document.createElement('div');
    tile.className = 'tile word-tile';
    const val = LETTER_VALUES[s.letter] !== undefined ? LETTER_VALUES[s.letter] : '';
    tile.innerHTML = `<span class="tile-letter">${s.letter}</span><span class="tile-val">${val}</span>`;
    tile.addEventListener('click', () => onWordTileClick(pos));
    wordEl.appendChild(tile);
  });

  // Show word preview (score + category)
  const word = player.selectedWord.map(s => s.letter).join('').toLowerCase();
  const preview = $('word-preview');
  if (preview) {
    if (word.length === 0) {
      preview.textContent = '';
      preview.className = 'word-preview';
    } else {
      const catKey = getWordCategory(word);
      const cat = catKey ? getCategoryData(catKey) : null;
      const score = calcWordScore(word) + Math.max(0, word.length - 2) * 2;
      const valid = isValidWord(word) && canFormWord(word, player.rack);
      preview.className = `word-preview ${valid ? 'valid' : 'invalid'}`;
      let text = valid
        ? `✔ "${word.toUpperCase()}"  ·  ${score} pts`
        : `✘ "${word.toUpperCase()}"  (not a valid word)`;
      if (cat) text += `  ·  ${cat.label} ${cat.description}`;
      preview.textContent = text;
      if (cat) preview.style.color = cat.color;
      else preview.style.color = valid ? '#44ff88' : '#ff5555';
    }
  }
}

function renderTurnBanner() {
  const banner = $('turn-banner');
  if (!banner) return;
  const player = GameState.players[GameState.turn];
  banner.textContent = `✨ ${player.name.toUpperCase()}'S TURN ✨`;

  // Show/hide action buttons based on mode and turn
  const isMyTurn = GameState.mode === 'online'
    ? GameState.turn === GameState.myPlayerIndex
    : true;
  const actionArea = $('action-area');
  if (actionArea) {
    actionArea.style.display = isMyTurn ? 'flex' : 'none';
    const waitMsg = $('wait-message');
    if (waitMsg) waitMsg.style.display = isMyTurn ? 'none' : 'block';
  }
}

function renderAll() {
  for (const p of GameState.players) renderPlayerPanel(p);
  renderBattleLog();
  renderRack(GameState.turn);
  renderWordArea();
  renderTurnBanner();
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTION HANDLERS
// ─────────────────────────────────────────────────────────────────────────────
function onTileClick(rackIdx) {
  if (GameState.phase !== 'PLAYING') return;
  const player = GameState.players[GameState.turn];
  // In online mode, only your turn
  if (GameState.mode === 'online' && GameState.turn !== GameState.myPlayerIndex) return;
  player.selectedWord.push({ letter: player.rack[rackIdx], rackIdx });
  renderRack(GameState.turn);
  renderWordArea();
}

function onWordTileClick(pos) {
  if (GameState.phase !== 'PLAYING') return;
  const player = GameState.players[GameState.turn];
  player.selectedWord.splice(pos, 1);
  renderRack(GameState.turn);
  renderWordArea();
}

function onSubmit() {
  if (GameState.phase !== 'PLAYING') return;
  const player = GameState.players[GameState.turn];
  const word = player.selectedWord.map(s => s.letter).join('').toLowerCase();

  if (word.length < 2) {
    flashMessage('Word must be at least 2 letters!', '#ff5555');
    return;
  }
  if (!isValidWord(word)) {
    flashMessage(`"${word.toUpperCase()}" is not a valid word!`, '#ff5555');
    return;
  }
  if (!canFormWord(word, player.rack)) {
    flashMessage('Cannot form this word from your tiles!', '#ff5555');
    return;
  }

  // Online mode: send to server
  if (GameState.mode === 'online' && GameState.socket) {
    GameState.socket.emit('playWord', { word, selectedWord: player.selectedWord, room: GameState.roomCode });
    return;
  }

  executeWordPlay(GameState.turn, word, player.selectedWord);
}

function onPass() {
  if (GameState.phase !== 'PLAYING') return;
  const player = GameState.players[GameState.turn];
  player.selectedWord = [];
  // Give 3 new tiles (discard 3 worst)
  const discardCount = Math.min(3, player.rack.length);
  player.rack.splice(0, discardCount);
  drawTiles(player, RACK_SIZE - player.rack.length);
  addLog([`⏭️ <b>${player.name}</b> passed and refreshed ${discardCount} tiles.`], null);
  nextTurn();
}

function onClear() {
  const player = GameState.players[GameState.turn];
  player.selectedWord = [];
  renderRack(GameState.turn);
  renderWordArea();
}

// ─────────────────────────────────────────────────────────────────────────────
// TURN ENGINE
// ─────────────────────────────────────────────────────────────────────────────
function executeWordPlay(playerIndex, word, selectedWord) {
  const result = submitWord(playerIndex, word, selectedWord);

  // Animate damage flash
  const defIdx = playerIndex === 0 ? 1 : 0;
  flashPanel(defIdx, result.categoryKey);
  if (result.healAmt > 0) flashHeal(playerIndex);

  renderAll();
  checkWinCondition();
  if (GameState.phase === 'PLAYING') nextTurn();
}

function nextTurn() {
  // Flip turn
  GameState.turn = GameState.turn === 0 ? 1 : 0;

  const current = GameState.players[GameState.turn];

  // Check FREEZE before decrementing so we can detect and skip the turn
  const wasFrozen = hasStatus(current, 'FREEZE');

  // Process status effects (DOTs fire, statuses decrement)
  const statusMsgs = processStatusEffects(current);
  if (statusMsgs.length) addLog(statusMsgs, null);

  renderAll();
  checkWinCondition();
  if (GameState.phase !== 'PLAYING') return;

  // If the player was frozen this turn, skip their action
  if (wasFrozen) {
    addLog([`❄️ <b>${current.name}</b> is FROZEN and loses their turn!`], null);
    renderAll();
    setTimeout(() => nextTurn(), 1200);
    return;
  }

  // If it's now the AI's turn
  if (GameState.mode === 'ai' && GameState.turn === 1) {
    setTimeout(runAITurn, 1200);
  }
}

function runAITurn() {
  if (GameState.phase !== 'PLAYING') return;
  const ai = GameState.players[1];

  const best = findBestAIWord(ai.rack);
  if (!best) {
    // AI passes
    const discardCount = Math.min(3, ai.rack.length);
    ai.rack.splice(0, discardCount);
    drawTiles(ai, RACK_SIZE - ai.rack.length);
    addLog([`⏭️ <b>${ai.name}</b> couldn't form a word and refreshed tiles.`], null);
    renderAll();
    setTimeout(() => nextTurn(), 600);
    return;
  }

  const selected = buildSelectedWordFromRack(best.word, ai.rack);
  if (!selected) {
    addLog([`⏭️ <b>${ai.name}</b> passed.`], null);
    renderAll();
    setTimeout(() => nextTurn(), 600);
    return;
  }

  // Show AI typing effect
  addLog([`🤖 <b>${ai.name}</b> is thinking…`], null);
  renderAll();
  setTimeout(() => {
    executeWordPlay(1, best.word, selected);
  }, 800);
}

function checkWinCondition() {
  const [p1, p2] = GameState.players;
  if (p1.hp <= 0 || p2.hp <= 0) {
    GameState.phase = 'GAMEOVER';
    const winner = p1.hp > 0 ? p1 : p2;
    const loser = p1.hp <= 0 ? p1 : p2;
    showGameOver(winner, loser);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VISUAL FEEDBACK
// ─────────────────────────────────────────────────────────────────────────────
function flashPanel(playerIndex, categoryKey) {
  const panel = $(`player${playerIndex + 1}-panel`);
  if (!panel) return;
  const cat = categoryKey ? getCategoryData(categoryKey) : null;
  const color = cat ? cat.color : '#ff4444';
  panel.style.boxShadow = `0 0 30px ${color}, 0 0 60px ${color}`;
  setTimeout(() => { panel.style.boxShadow = ''; }, 500);
}

function flashHeal(playerIndex) {
  const panel = $(`player${playerIndex + 1}-panel`);
  if (!panel) return;
  panel.style.boxShadow = '0 0 30px #44ff88, 0 0 60px #44ff88';
  setTimeout(() => { panel.style.boxShadow = ''; }, 500);
}

function flashMessage(msg, color) {
  const el = $('flash-message');
  if (!el) return;
  el.textContent = msg;
  el.style.color = color;
  el.style.opacity = '1';
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => { el.style.opacity = '0'; }, 2000);
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME OVER
// ─────────────────────────────────────────────────────────────────────────────
function showGameOver(winner, loser) {
  setScreen('gameover');
  const title = $('gameover-title');
  const stats = $('gameover-stats');
  if (title) title.textContent = `🏆 ${winner.name} WINS! 🏆`;
  if (stats) {
    stats.innerHTML = `
      <div class="stat-row"><b>${winner.name}</b>: ${winner.wordsPlayed} words · Score ${winner.score} · ${winner.hp} HP remaining</div>
      <div class="stat-row"><b>${loser.name}</b>: ${loser.wordsPlayed} words · Score ${loser.score}</div>
      <div class="log-replay">
        ${GameState.log.slice(0, 10).map(e => `<div class="log-entry" style="color:${e.color}">${e.html}</div>`).join('')}
      </div>
    `;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────
function startGame(p1Name, p2Name, mode, aiDiff = 'normal') {
  GameState.mode = mode;
  GameState.turn = 0;
  GameState.log = [];
  GameState.phase = 'PLAYING';
  GameState.tileBag = buildTileBag();
  GameState.aiDifficulty = aiDiff;

  const p1 = createPlayer(p1Name || 'Hero', 0);
  const p2 = createPlayer(p2Name || (mode === 'ai' ? 'Dark Mage' : 'Challenger'), 1);
  GameState.players = [p1, p2];

  drawTiles(p1, RACK_SIZE);
  drawTiles(p2, RACK_SIZE);

  addLog([`⚔️ <b>${p1.name}</b> vs <b>${p2.name}</b> — Battle begins!`], null);

  setScreen('game');
  renderAll();
}

// ─────────────────────────────────────────────────────────────────────────────
// MENU HANDLERS
// ─────────────────────────────────────────────────────────────────────────────
function onStartLocal() {
  const p1 = ($('input-p1-name').value.trim() || 'Player 1').slice(0, 20);
  const p2 = ($('input-p2-name').value.trim() || 'Player 2').slice(0, 20);
  startGame(p1, p2, 'local');
}

function onStartAI() {
  const p1 = ($('input-ai-name').value.trim() || 'Hero').slice(0, 20);
  const diffEl = $('ai-difficulty');
  const diff = diffEl ? diffEl.value : 'normal';
  const aiNames = { easy: 'Goblin Shaman', normal: 'Dark Mage', hard: 'Arch Lich' };
  startGame(p1, aiNames[diff] || 'Dark Mage', 'ai', diff);
}

function showTab(tabId) {
  for (const el of $$('.menu-tab-content')) el.classList.remove('active');
  for (const btn of $$('.tab-btn')) btn.classList.remove('active');
  const tab = $(tabId);
  if (tab) tab.classList.add('active');
  const btn = $(`btn-${tabId}`);
  if (btn) btn.classList.add('active');
}

function onPlayAgain() {
  setScreen('menu');
  showTab('tab-local');
}

// ─────────────────────────────────────────────────────────────────────────────
// ONLINE MULTIPLAYER (Socket.io) — requires server.js to be running
// ─────────────────────────────────────────────────────────────────────────────
function initOnlineMultiplayer() {
  if (typeof io === 'undefined') {
    flashMessage('Server not available. Play locally or vs AI.', '#ff8844');
    showTab('tab-local');
    return;
  }

  const socket = io();
  GameState.socket = socket;

  socket.on('connect', () => {
    $('online-status').textContent = '🟢 Connected to server';
  });

  socket.on('disconnect', () => {
    $('online-status').textContent = '🔴 Disconnected';
  });

  socket.on('roomCreated', ({ roomCode, playerIndex }) => {
    GameState.roomCode = roomCode;
    GameState.myPlayerIndex = playerIndex;
    $('room-code-display').textContent = `Room Code: ${roomCode}`;
    $('online-status').textContent = '⏳ Waiting for opponent…';
  });

  socket.on('gameStart', ({ players, turnOrder }) => {
    $('online-status').textContent = '⚔️ Battle started!';
    const myName = players[GameState.myPlayerIndex].name;
    const oppName = players[1 - GameState.myPlayerIndex].name;
    startGame(myName, oppName, 'online');
    GameState.turn = turnOrder;
    // Overwrite racks with server-assigned tiles
    players.forEach((p, i) => {
      GameState.players[i].rack = p.rack;
    });
    renderAll();
  });

  socket.on('wordPlayed', ({ playerIndex, word, newRack }) => {
    // Server already removed used tiles and drew replacements.
    // Set the rack to the final server-authoritative rack, then apply effects
    // with an empty selectedWord so submitWord() won't try to remove tiles again.
    GameState.players[playerIndex].rack = newRack;
    executeWordPlay(playerIndex, word, []);
  });

  socket.on('opponentPassed', ({ playerIndex, newRack }) => {
    GameState.players[playerIndex].rack = newRack;
    addLog([`⏭️ <b>${GameState.players[playerIndex].name}</b> passed.`], null);
    renderAll();
    nextTurn();
  });

  socket.on('error', ({ message }) => {
    flashMessage(message, '#ff5555');
  });
}

function onCreateRoom() {
  if (!GameState.socket) { flashMessage('Not connected to server.', '#ff5555'); return; }
  const name = ($('input-online-name').value.trim() || 'Warrior').slice(0, 20);
  GameState.socket.emit('createRoom', { name });
}

function onJoinRoom() {
  if (!GameState.socket) { flashMessage('Not connected to server.', '#ff5555'); return; }
  const name = ($('input-online-name').value.trim() || 'Warrior').slice(0, 20);
  const code = $('input-room-code').value.trim().toUpperCase();
  if (!code) { flashMessage('Enter a room code!', '#ff5555'); return; }
  GameState.socket.emit('joinRoom', { name, roomCode: code });
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  setScreen('menu');
  showTab('tab-local');

  // Button wiring
  $('btn-tab-local').addEventListener('click', () => showTab('tab-local'));
  $('btn-tab-ai').addEventListener('click', () => showTab('tab-ai'));
  $('btn-tab-online').addEventListener('click', () => { showTab('tab-online'); initOnlineMultiplayer(); });

  $('btn-start-local').addEventListener('click', onStartLocal);
  $('btn-start-ai').addEventListener('click', onStartAI);
  $('btn-create-room').addEventListener('click', onCreateRoom);
  $('btn-join-room').addEventListener('click', onJoinRoom);
  $('btn-submit').addEventListener('click', onSubmit);
  $('btn-pass').addEventListener('click', onPass);
  $('btn-clear').addEventListener('click', onClear);
  $('btn-play-again').addEventListener('click', onPlayAgain);

  // Keyboard shortcut: Enter = submit
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && GameState.phase === 'PLAYING') onSubmit();
    if (e.key === 'Escape' && GameState.phase === 'PLAYING') onClear();
  });
});
