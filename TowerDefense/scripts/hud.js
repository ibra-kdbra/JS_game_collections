// Page interface: HUD, build menu, tower inspector, wave preview, banners,
// level select, pause menu and end screens. Game state lives in sketch.js.

const MAP_LIST = [
    { id: 'spiral', title: 'Spiral', group: 'designed' },
    { id: 'loops', title: 'Loops', group: 'designed' },
    { id: 'branch', title: 'Branch', group: 'designed' },
    { id: 'branchAlt', title: 'Branch Alt', group: 'designed' },
    { id: 'fork', title: 'Fork', group: 'designed' },
    { id: 'walls', title: 'Walls', group: 'designed' },
    { id: 'city', title: 'City', group: 'designed' },
    { id: 'freeway', title: 'Freeway', group: 'designed' },
    { id: 'empty2', title: 'Empty', spawns: 2, cover: 0, group: 'random' },
    { id: 'sparse2', title: 'Sparse', spawns: 2, cover: 0.1, group: 'random' },
    { id: 'dense2', title: 'Dense', spawns: 2, cover: 0.2, group: 'random' },
    { id: 'solid2', title: 'Solid', spawns: 2, cover: 0.3, group: 'random' },
    { id: 'empty3', title: 'Empty', spawns: 3, cover: 0, group: 'random' },
    { id: 'sparse3', title: 'Sparse', spawns: 3, cover: 0.1, group: 'random' },
    { id: 'dense3', title: 'Dense', spawns: 3, cover: 0.2, group: 'random' },
    { id: 'solid3', title: 'Solid', spawns: 3, cover: 0.3, group: 'random' },
    { id: 'custom', title: 'Custom', group: 'custom' }
];

const TOWER_ORDER = ['gun', 'laser', 'slow', 'sniper', 'rocket', 'bomb', 'tesla'];

const TOWER_BLURBS = {
    gun: 'Cheap and quick. Good for building mazes.',
    laser: 'Short range beam that never stops.',
    slow: 'Halves the speed of everything close by.',
    sniper: 'Huge range. Shoots the toughest enemy.',
    rocket: 'Homing missiles with splash damage.',
    bomb: 'Short range, heavy splash damage.',
    tesla: 'Strong zaps at medium range.',
    machineGun: 'Sprays bullets at a very high rate.',
    beamEmitter: 'Damage grows the longer it stays on one target.',
    poison: 'Poisons enemies close by.',
    railgun: 'Piercing shot that blasts nearby enemies too.',
    missileSilo: 'Faster, stronger missiles with a bigger blast.',
    clusterBomb: 'Bombs split into three more blasts.',
    lightningStrike: 'Much stronger zaps at longer range.'
};

const ENEMY_INFO = {
    weak: { title: 'Weak', blurb: 'Slow and fragile.' },
    strong: { title: 'Strong', blurb: 'Twice as tough.' },
    fast: { title: 'Fast', blurb: 'Moves at double speed.', shape: 'arrow' },
    strongFast: { title: 'Strong fast', blurb: 'Fast and tougher.', shape: 'arrow' },
    medic: { title: 'Medic', blurb: 'Heals enemies around it.' },
    stronger: { title: 'Heavy', blurb: 'Lots of health.' },
    faster: { title: 'Racer', blurb: 'Very fast and shrugs off explosions.', shape: 'arrow' },
    tank: { title: 'Tank', blurb: 'Immune to slow and poison. Weak to explosions and snipers.', shape: 'square' },
    taunt: { title: 'Taunt', blurb: 'Draws every tower\'s fire. Huge health.', shape: 'square' },
    spawner: { title: 'Spawner', blurb: 'Opens a new spawn point where it dies.' }
};

const TYPE_NAMES = {
    physical: 'Physical',
    energy: 'Energy',
    slow: 'Slow',
    poison: 'Poison',
    explosion: 'Explosive',
    piercing: 'Piercing'
};

const rgb = (c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const esc = (str) => String(str).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const isTouch = () => lastPointer !== 'mouse';
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const swatch = (t) => `<span class="swatch" style="--c:${rgb(t.color)};--c2:${rgb(t.secondary || t.color)}"></span>`;

function mapInfo(id = mapId) {
    return MAP_LIST.find(m => m.id === id) || MAP_LIST[0];
}

function mapTitle(id = mapId) {
    const m = mapInfo(id);
    return m.spawns ? `${m.title} (${m.spawns} spawns)` : m.title;
}


// ---------- Build menu ----------

function buildStore() {
    const grid = $('store-grid');
    grid.innerHTML = TOWER_ORDER.map((name, i) => {
        const t = tower[name];
        return `<button type="button" class="tower-btn" data-tower="${name}" aria-label="${esc(t.title)}, $${t.cost} (key ${i + 1})">
            <kbd>${i + 1}</kbd>${swatch(t)}
            <span class="name">${esc(t.title.replace(' Tower', ''))}</span>
            <span class="cost">$${t.cost}</span>
            <span class="blurb">${esc(TOWER_BLURBS[name])}</span>
        </button>`;
    }).join('');
    grid.addEventListener('click', e => {
        const b = e.target.closest('[data-tower]');
        if (!b) return;
        setPlace(b.dataset.tower);
        b.blur();
    });
}


// ---------- Tower stats ----------

function towerStats(t) {
    const k = Math.max(1, (t.cooldownMin + t.cooldownMax) / 2);
    const rate = 60 / k;
    let damage = t.getDamage();
    let speedText = rate >= 30 ? 'Constant' : `${rate < 10 ? rate.toFixed(1) : Math.round(rate)}/s`;
    if (t.type === 'slow') damage = 'Slows 50%';
    if (t.type === 'poison') {
        damage = '60 over 1s';
        speedText = `${rate.toFixed(1)}/s`;
    }
    if (t.name === 'beamEmitter') damage = 'Ramps up';
    return {
        Damage: damage,
        Speed: speedText,
        Range: String(t.range),
        Type: TYPE_NAMES[t.type] || t.type
    };
}

function statGrid(t) {
    const st = towerStats(t);
    return `<dl class="statgrid">${Object.entries(st).map(([k, v]) =>
        `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
}

// What an upgrade changes, as a list of "Stat old -> new"
function upgradeDiff(t, u) {
    const next = Object.assign(Object.create(Object.getPrototypeOf(t)), t);
    next.upgrade(u);
    const a = towerStats(t);
    const b = towerStats(next);
    const rows = Object.keys(a).filter(k => a[k] !== b[k])
        .map(k => `<li><span>${k}</span> ${esc(a[k])} &rarr; <b>${esc(b[k])}</b></li>`);
    return { next, rows: rows.join('') };
}


// ---------- Inspector ----------

let lastSubject = null;
function updateInfo() {
    const placing = !!toPlace;
    const sel = !placing && selected && selected.alive ? selected : null;
    if (!sel) selected = placing ? null : selected && selected.alive ? selected : null;
    document.body.classList.toggle('is-placing', placing);
    document.body.classList.toggle('is-selected', !!sel);
    document.querySelectorAll('.tower-btn').forEach(b => {
        b.classList.toggle('active', placing && b.dataset.tower === towerType);
    });

    const el = $('inspector');
    // Start at the top when the inspector shows something new
    const subject = placing ? `place-${towerType}` : sel || 'idle';
    if (subject !== lastSubject) el.scrollTop = 0;
    lastSubject = subject;
    if (placing) el.innerHTML = placeHTML();
    else if (sel) el.innerHTML = selectedHTML(sel);
    else el.innerHTML = idleHTML();
    shown.afford = null;
    lastPlaceKey = null;
    updatePlaceStatus();
    refreshAffordability();
}

function clearInfo() {
    updateInfo();
}

function idleHTML() {
    const touch = isTouch();
    return `<div class="insp-head"><div><h2>Build &amp; defend</h2></div></div>
        <p class="hint">${touch
            ? 'Pick a tower, then tap a tile on the map. Tap a built tower to upgrade or sell it.'
            : 'Pick a tower (keys 1-7), then click the map. Click a built tower to upgrade or sell it.'}</p>
        <ul class="legend">
            <li><i style="background:#00e640"></i>Enemies come out here</li>
            <li><i style="background:#cf000f"></i>Your base: every enemy that reaches it costs lives</li>
            <li><i style="background:#336e7b"></i>Towers block the way, so build a maze to make the path longer</li>
        </ul>
        <p class="hint desk-only" style="margin-top:12px">Space start / pause &middot; T speed &middot; N send wave &middot; Esc menu</p>`;
}

function placeHTML() {
    const t = createTower(0, 0, tower[towerType]);
    return `<div class="insp-head">${swatch(t)}
            <div><h2>${esc(t.title)} <span style="color:var(--accent)">$${t.cost}</span></h2><p class="blurb">${esc(TOWER_BLURBS[towerType])}</p></div>
            <button type="button" class="icon-btn" data-act="cancel" aria-label="Stop building (Esc)">${icon('close')}</button>
        </div>
        ${statGrid(t)}
        <p class="place-status" id="place-status"></p>
        <div class="insp-actions">
            <button type="button" class="primary" data-act="build" id="build-btn">Build $${t.cost}</button>
            <button type="button" data-act="cancel">Cancel</button>
        </div>`;
}

function selectedHTML(t) {
    const level = (tower[baseName(t)]?.upgrades?.length || 0) + 1;
    const now = level - t.upgrades.length;
    let upgradeBlock;
    if (t.upgrades.length) {
        const u = t.upgrades[0];
        const { next, rows } = upgradeDiff(t, u);
        upgradeBlock = `<p class="insp-label">Upgrade</p>
            <div class="upgrade-card">
                <h3><span>${esc(next.title)}</span><span style="color:var(--accent)">$${u.cost}</span></h3>
                <ul>${rows}<li><span>${esc(TOWER_BLURBS[u.name] || '')}</span></li></ul>
                <button type="button" class="primary" data-act="upgrade" data-up>Upgrade $${u.cost}<span class="desk-only">&nbsp;(U)</span></button>
                <p class="need" id="up-need" hidden></p>
            </div>`;
    } else {
        upgradeBlock = `<div class="upgrade-card maxed" style="margin-top:10px">Fully upgraded</div>`;
    }
    const targeting = hasTargeting(t) ? `<p class="insp-label">Target <span class="desk-only" style="text-transform:none;font-weight:400">(C)</span></p>
        <div class="seg" role="group" aria-label="Target">${Object.entries(targetModes).map(([m, label]) =>
            `<button type="button" data-act="target" data-mode="${m}" aria-pressed="${t.targetMode === m}">${label}</button>`).join('')}</div>` : '';
    const quickUp = t.upgrades.length
        ? `<button type="button" class="primary" data-act="upgrade" data-up>Upgrade $${t.upgrades[0].cost}</button>`
        : '<button type="button" disabled>Max level</button>';
    return `<div class="insp-head">${swatch(t)}
            <div><h2>${esc(t.title)}</h2><p>Level ${now} of ${level}</p></div>
            <button type="button" class="icon-btn" data-act="cancel" aria-label="Deselect (Esc)">${icon('close')}</button>
        </div>
        <div class="insp-actions phone-only" style="margin:0 0 8px">${quickUp}
            <button type="button" class="sell" data-act="sell">Sell +$${t.sellPrice()}</button>
        </div>
        ${statGrid(t)}
        ${targeting}
        ${upgradeBlock}
        <div class="insp-actions full">
            <button type="button" class="sell" data-act="sell">Sell +$${t.sellPrice()}<span class="desk-only">&nbsp;(S)</span></button>
            <button type="button" data-act="cancel">Done</button>
        </div>`;
}

// The store entry a tower came from (towers keep their upgraded name)
function baseName(t) {
    return TOWER_ORDER.find(n => n === t.name || tower[n].upgrades.some(u => u.name === t.name)) || t.name;
}

// Placement hint: where, whether it can go there, and what it costs
function updatePlaceStatus() {
    const el = $('place-status');
    if (!toPlace || !el) return;
    const p = placementTile();
    const cost = tower[towerType].cost;
    const afford = godMode || cash >= cost;
    let text;
    let kind = '';
    if (!p) {
        text = isTouch() ? 'Tap a tile on the map to aim.' : 'Click a free tile to build. Right click or Esc to stop.';
        if (!afford) {
            text = `Need $${cost - cash} more gold.`;
            kind = 'bad';
        }
    } else {
        const reason = placeReason(p.x, p.y);
        if (reason) {
            text = reason;
            kind = 'bad';
        } else if (!afford) {
            text = `Need $${cost - cash} more gold.`;
            kind = 'bad';
        } else {
            text = ghost ? 'Good spot. Tap it again or press Build.' : 'Good spot.';
            kind = 'ok';
        }
    }
    el.textContent = text;
    el.className = `place-status ${kind}`;
    const build = $('build-btn');
    if (build) {
        build.hidden = !isTouch();
        build.disabled = !(ghost && kind === 'ok');
    }
}

function refreshAffordability() {
    const key = `${cash}|${godMode}|${selected ? selected.upgrades.length : -1}`;
    if (shown.afford === key) return;
    shown.afford = key;
    document.querySelectorAll('.tower-btn').forEach(b => {
        b.classList.toggle('poor', cash < tower[b.dataset.tower].cost && !godMode);
    });
    if (selected && selected.upgrades.length && $('up-need')) {
        const cost = selected.upgrades[0].cost;
        const poor = cash < cost && !godMode;
        document.querySelectorAll('[data-up]').forEach(up => { up.disabled = poor; });
        const need = $('up-need');
        need.hidden = !poor;
        need.textContent = poor ? `Need $${cost - cash} more gold` : '';
    }
    updatePlaceStatus();
}

$('inspector').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
        case 'cancel':
            cancelPlace();
            break;
        case 'build':
            confirmGhost();
            break;
        case 'upgrade':
            if (selected && selected.upgrades.length) upgrade(selected.upgrades[0]);
            break;
        case 'sell':
            if (selected) sell(selected);
            break;
        case 'target':
            setTarget(b.dataset.mode);
            break;
    }
});


// ---------- HUD, wave preview and controls ----------

const shown = {};
function setText(id, value) {
    if (shown[id] === value) return;
    shown[id] = value;
    $(id).textContent = value;
}

function setHTML(id, value) {
    if (shown[id] === value) return;
    shown[id] = value;
    $(id).innerHTML = value;
}

function updateControls() {
    const pauseBtn = $('pause');
    const label = gameOver ? 'Game over' : !started ? 'Start' : paused ? 'Resume' : 'Pause';
    setHTML('pause', `${icon(paused || gameOver ? 'play' : 'pause')}<span>${label}</span>`);
    pauseBtn.setAttribute('aria-label', `${label} (Space)`);
    pauseBtn.disabled = gameOver;
    pauseBtn.classList.toggle('primary', !started || paused);
    document.querySelectorAll('[data-speed]').forEach(b => {
        b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === speed));
    });
    const mute = $('mute');
    mute.innerHTML = icon(muteSounds ? 'mute' : 'sound');
    mute.setAttribute('aria-label', muteSounds ? 'Turn sound on (V)' : 'Mute sound (V)');
}

// Count enemies per type in a wave pattern (or a queue of names)
function countWave(pattern) {
    const counts = {};
    if (!pattern) return counts;
    pattern.slice(1).forEach(group => {
        const n = group[group.length - 1];
        group.slice(0, -1).forEach(name => { counts[name] = (counts[name] || 0) + n; });
    });
    return counts;
}

function countQueue(queue) {
    const counts = {};
    queue.forEach(name => { counts[name] = (counts[name] || 0) + 1; });
    return counts;
}

// Enemy types the campaign has not shown before wave number n (1-based)
function newInWave(n) {
    if (gameMode !== 'campaign' || n < 2) return [];
    const seen = new Set();
    campaignWaves.slice(0, n - 1).forEach(p => Object.keys(countWave(p)).forEach(k => seen.add(k)));
    return Object.keys(countWave(campaignWaves[n - 1])).filter(k => !seen.has(k));
}

function chipsHTML(counts, fresh = []) {
    const mult = spawnpoints.length || 1;
    const names = Object.keys(counts);
    if (!names.length) return '<span class="chip muted">No more waves</span>';
    return names.map(name => {
        const e = enemy[name];
        const info = ENEMY_INFO[name] || { title: name };
        const shape = info.shape ? ` ${info.shape}` : '';
        return `<span class="chip" title="${esc(info.title)}: ${esc(info.blurb || '')}">
            <i class="dot${shape}" style="--c:${rgb(e.color)}"></i>${esc(info.title)} <b>&times;${counts[name] * mult}</b>
            ${fresh.includes(name) ? '<span class="new">NEW</span>' : ''}</span>`;
    }).join('');
}

function updateStatus() {
    const total = gameMode === 'campaign' ? campaignWaves.length : 0;
    setText('wave', String(wave));
    setText('wave-total', total ? `/${total}` : '');
    setText('health', String(health));
    setText('cash', String(cash));
    $('lives-stat').classList.toggle('low', health <= maxHealth * 0.25);

    // Wave preview
    const key = `${wave}|${toWait}|${started}|${gameOver}|${spawnpoints.length}|${gameMode}`;
    if (shown.waveKey !== key) {
        shown.waveKey = key;
        let label;
        let counts;
        let fresh = [];
        if (gameOver) {
            label = 'Game over';
            counts = null;
        } else if (!started) {
            label = `First wave`;
            counts = countQueue(newEnemies);
            fresh = Object.keys(counts);
        } else if (toWait) {
            label = `Next: wave ${wave + 1}`;
            counts = countWave(upcoming);
            fresh = newInWave(wave + 1);
        } else {
            label = upcoming ? `Wave ${wave} · next up` : `Final wave`;
            counts = countWave(upcoming);
            fresh = newInWave(wave + 1);
        }
        setText('wave-label', label);
        setHTML('preview', counts ? chipsHTML(counts, fresh) : '<span class="chip muted">Play again or pick another map</span>');
    }

    // Countdown / enemies left
    let timer = '';
    if (toWait && !gameOver) timer = `${Math.ceil(wcd / 60)}s`;
    else if (started && !gameOver) timer = `${enemies.length + newEnemies.length * spawnpoints.length} left`;
    setText('wave-timer', timer);

    // Send next wave
    const nb = $('next-wave');
    const canCall = toWait && !gameOver && !!upcoming;
    nb.disabled = !canCall;
    const bonus = earlyCallBonus();
    setHTML('next-label', canCall
        ? `<span class="long">Send wave ${wave + 1} now </span><b>+$${bonus}</b>`
        : `<span class="long">${!started ? 'Next wave' : gameOver ? 'Next wave' : 'Wave in progress'}</span>`);
    $('next-fill').style.width = canCall ? `${100 * (1 - wcd / difficulty.waveCool)}%` : '0';
    nb.setAttribute('aria-label', canCall ? `Send wave ${wave + 1} now for $${bonus} (N)` : 'Send next wave (N)');

    // Tip over the map
    let tip = '';
    if (!gameOver) {
        if (toPlace) {
            if (isTouch()) tip = ghost ? 'Tap the same tile again to build' : 'Tap a tile to aim';
        } else if (!started) {
            tip = isTouch() ? 'Build some towers, then press ▶' : 'Build some towers, then press Start (Space)';
        } else if (paused) {
            tip = isTouch() ? 'Paused' : 'Paused · Space to resume';
        }
    }
    setText('map-tip', tip);

    refreshAffordability();
}

function flashLives() {
    const el = $('lives-stat');
    el.classList.remove('hurt');
    void el.offsetWidth;
    el.classList.add('hurt');
}

function toggleMute() {
    muteSounds = !muteSounds;
    savePrefs();
    updateControls();
    if (!muteSounds) {
        startAudio();
        sfx('click');
    }
}

$('pause').addEventListener('click', e => {
    pause();
    e.currentTarget.blur();
});
document.querySelectorAll('[data-speed]').forEach(b => {
    b.addEventListener('click', () => {
        setSpeed(Number(b.dataset.speed));
        b.blur();
    });
});
$('next-wave').addEventListener('click', e => {
    callNextWave();
    e.currentTarget.blur();
});
$('mute').addEventListener('click', e => {
    toggleMute();
    e.currentTarget.blur();
});
$('menu-btn').addEventListener('click', e => {
    openMenu();
    e.currentTarget.blur();
});


// ---------- Banners ----------

let bannerTimer = 0;
function showBanner(title, sub = '', kind = '') {
    const el = $('banner');
    el.className = `banner ${kind}`;
    el.innerHTML = `<strong>${esc(title)}</strong>${sub ? `<span>${esc(sub)}</span>` : ''}`;
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function announceWave() {
    sfx('wave');
    const total = gameMode === 'campaign' ? ` of ${campaignWaves.length}` : '';
    const fresh = newInWave(wave);
    let sub = '';
    if (fresh.length) sub = `New: ${fresh.map(n => `${ENEMY_INFO[n].title} - ${ENEMY_INFO[n].blurb}`).join(' ')}`;
    else if (gameMode === 'campaign' && wave === campaignWaves.length) sub = 'Final wave!';
    if (earlyBonus > 0) sub = `+$${earlyBonus} early bonus${sub ? ' · ' + sub : ''}`;
    earlyBonus = 0;
    showBanner(`Wave ${wave}${total}`, sub);
}

function waveCleared() {
    sfx('cleared');
    const next = skipToNext ? '' : `Next wave in ${Math.ceil(wcd / 60)}s · send it early for bonus gold`;
    showBanner(`Wave ${wave} cleared`, next, 'good');
}


// ---------- Overlays ----------

const overlayStack = [];
let menuResume = false;

function openOverlay(id) {
    const el = $(id);
    if (!el.hidden) return;
    el.hidden = false;
    el.scrollTop = 0;
    el.querySelector('.panel').scrollTop = 0;
    overlayStack.push(id);
    const focus = el.querySelector('.primary, button');
    if (focus && lastPointer === 'mouse') focus.focus({ preventScroll: true });
}

function closeOverlay(id) {
    const el = $(id);
    if (!el || el.hidden) return;
    el.hidden = true;
    const i = overlayStack.indexOf(id);
    if (i >= 0) overlayStack.splice(i, 1);
    if (id === 'menu' && menuResume) {
        menuResume = false;
        if (paused && !gameOver) pause();
    }
}

const openOverlayId = () => overlayStack[overlayStack.length - 1] || null;
const closeTopOverlay = () => {
    const id = openOverlayId();
    if (id) closeOverlay(id);
};

document.querySelectorAll('.overlay').forEach(o => {
    o.addEventListener('click', e => {
        if (e.target === o && o.id !== 'end') closeOverlay(o.id);
        if (e.target.closest('[data-close]')) closeOverlay(o.id);
    });
});


// ---------- Pause menu and settings ----------

function openMenu() {
    menuResume = !paused && !gameOver;
    if (menuResume) pause();
    setText('menu-title', !started || gameOver ? 'Menu' : 'Paused');
    const best = GameKit.readBests(SLUG)[bestMode()];
    $('menu-where').textContent = `${mapTitle()} · ${gameMode === 'campaign' ? 'Campaign' : 'Endless'} · ${difficulty.title} · wave ${wave}` +
        (best ? ` · best ${best.value} waves` : '');
    syncSettings();
    openOverlay('menu');
}

function syncSettings() {
    $('set-sound').checked = !muteSounds;
    $('set-numbers').checked = damageNumbers;
    $('set-bars').checked = healthBar;
    $('set-effects').checked = showEffects;
    $('set-autosend').checked = skipToNext;
}

$('set-sound').addEventListener('change', e => {
    if (e.target.checked === muteSounds) toggleMute();
});
$('set-numbers').addEventListener('change', e => {
    damageNumbers = e.target.checked;
    savePrefs();
});
$('set-bars').addEventListener('change', e => {
    healthBar = e.target.checked;
    savePrefs();
});
$('set-effects').addEventListener('change', e => {
    showEffects = e.target.checked;
    if (!showEffects) systems = [];
    savePrefs();
});
$('set-autosend').addEventListener('change', e => {
    skipToNext = e.target.checked;
    savePrefs();
});
$('restart').addEventListener('click', () => {
    menuResume = false;
    closeOverlay('menu');
    resetGame();
});
$('open-levels').addEventListener('click', () => {
    menuResume = false;
    closeOverlay('menu');
    openLevels();
});
$('export').addEventListener('click', showExportMap);


// ---------- Level select ----------

let pickMode;
let pickDiff;

function progressKey(id, mode, diff) {
    return `${id}-${mode}-${diff}`;
}

function openLevels() {
    pickMode = modeId;
    pickDiff = diffId;
    renderLevels();
    openOverlay('levels');
}

function renderLevels() {
    document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === pickMode)));
    document.querySelectorAll('[data-diff]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.diff === pickDiff)));
    const d = difficulties[pickDiff];
    const hp = d.hp === 1 ? 'normal enemies' : d.hp < 1 ? 'weaker enemies' : 'tougher enemies';
    $('diff-note').textContent = `${d.title}: ${d.health} lives, $${d.cash} to start, ${hp}. ` +
        (pickMode === 'campaign' ? 'Hold all 30 waves to win; keep more lives for more stars.' : 'Waves never stop. How far can you get?');

    const bests = GameKit.readBests(SLUG);
    const stars = store.get('stars', {});
    ['designed', 'random', 'custom'].forEach(group => {
        const holder = $(`maps-${group}`);
        holder.innerHTML = '';
        MAP_LIST.filter(m => m.group === group).forEach(m => {
            const disabled = m.id === 'custom' && !custom;
            const key = progressKey(m.id, pickMode, pickDiff);
            const best = bests[key];
            const st = stars[key] || 0;
            let sub;
            if (disabled) sub = 'Import a map or make one in the editor';
            else if (pickMode === 'campaign' && st) sub = 'Cleared';
            else if (best) sub = `Best: ${best.value} wave${best.value === 1 ? '' : 's'}`;
            else sub = m.spawns ? `${m.spawns} spawn points` : 'Not played yet';
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'map-card' + (m.id === mapId && pickMode === modeId && pickDiff === diffId ? ' current' : '');
            b.disabled = disabled;
            b.dataset.map = m.id;
            const starHTML = pickMode === 'campaign' && !disabled
                ? `<span class="mini-stars" aria-label="${st} of 3 stars">${[1, 2, 3].map(i => `<span class="${i <= st ? 'on' : ''}">${icon('star')}</span>`).join('')}</span>`
                : '';
            b.innerHTML = `<canvas width="320" height="200" aria-hidden="true"></canvas>
                <span class="title"><span>${esc(m.spawns ? `${m.title} ×${m.spawns}` : m.title)}</span>${starHTML}</span>
                <span class="sub">${esc(sub)}</span>`;
            holder.append(b);
            drawThumb(b.querySelector('canvas'), m);
        });
    });
}

// Small picture of a map for the level select
function drawThumb(cv, m) {
    const ctx = cv.getContext('2d');
    const W = cv.width;
    const H = cv.height;
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, W, H);
    let data = m.group === 'designed' ? maps[m.id] : m.group === 'custom' ? custom : null;
    if (m.group === 'random') data = fakeRandomMap(m);
    if (!data) return;
    const s = Math.min(W / data.cols, H / data.rows);
    const ox = (W - s * data.cols) / 2;
    const oy = (H - s * data.rows) / 2;
    const bgc = Array.isArray(data.bg) ? data.bg : [0, 0, 0];
    for (let x = 0; x < data.cols; x++) {
        for (let y = 0; y < data.rows; y++) {
            const d = data.display ? tiles[data.display[x][y]] : null;
            let c = Array.isArray(d) ? d : null;
            if (!c) c = data.grid[x][y] === 1 ? [1, 50, 67] : data.grid[x][y] === 3 ? [51, 110, 123] : bgc;
            ctx.fillStyle = rgb(c);
            ctx.fillRect(ox + x * s, oy + y * s, Math.ceil(s), Math.ceil(s));
        }
    }
    ctx.fillStyle = '#00e640';
    data.spawnpoints.forEach(([x, y]) => ctx.fillRect(ox + x * s, oy + y * s, Math.ceil(s), Math.ceil(s)));
    ctx.fillStyle = '#cf000f';
    ctx.fillRect(ox + data.exit[0] * s, oy + data.exit[1] * s, Math.ceil(s), Math.ceil(s));
}

// A stand-in picture for random maps (the real layout is rolled at the start)
function fakeRandomMap(m) {
    let seed = [...m.id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const cols = 24;
    const rows = 15;
    const grid = Array.from({ length: cols }, () => Array.from({ length: rows }, () => rnd() < m.cover ? 1 : 0));
    const spawnpoints = [[2, 2], [2, 12], [12, 1]].slice(0, m.spawns);
    spawnpoints.forEach(([x, y]) => { grid[x][y] = 0; });
    grid[20][8] = 0;
    return { cols, rows, grid, spawnpoints, exit: [20, 8], bg: [0, 0, 0] };
}

$('levels').addEventListener('click', e => {
    const mode = e.target.closest('[data-mode]');
    const diff = e.target.closest('[data-diff]');
    const card = e.target.closest('[data-map]');
    if (mode) {
        pickMode = mode.dataset.mode;
        renderLevels();
    } else if (diff) {
        pickDiff = diff.dataset.diff;
        renderLevels();
    } else if (card && !card.disabled) {
        mapId = card.dataset.map;
        modeId = pickMode;
        diffId = pickDiff;
        savePrefs();
        sfx('click');
        closeOverlay('levels');
        resetGame();
    }
});
$('import').addEventListener('click', () => {
    closeOverlay('levels');
    showImportMapPrompt();
});


// ---------- Results ----------

const bestMode = () => progressKey(mapId, gameMode, diffId);

function recordWave(cleared) {
    if (cleared < 1) return false;
    return GameKit.recordBest(SLUG, cleared, {
        mode: bestMode(),
        label: `Wave ${cleared} on ${mapTitle()} (${difficulty.title})`
    }).isNew;
}

// Best result on this setup before the current game, for "new best" on the end screen
let bestAtStart = 0;
function updateBest() {
    bestAtStart = GameKit.readBests(SLUG)[bestMode()]?.value || 0;
}

function endGame(won) {
    gameOver = true;
    paused = true;
    const cleared = won ? wave : wave - 1;
    recordWave(cleared);
    const isNew = cleared > bestAtStart && cleared > 0;
    const left = health / maxHealth;
    const starCount = won ? (left >= 0.9 ? 3 : left >= 0.5 ? 2 : 1) : 0;
    if (won && gameMode === 'campaign') {
        const all = store.get('stars', {});
        all[bestMode()] = Math.max(all[bestMode()] || 0, starCount);
        store.set('stars', all);
    }
    sfx(won ? 'victory' : 'defeat');

    $('end').querySelector('.panel').classList.toggle('lost', !won);
    $('end-kicker').textContent = `${mapTitle()} · ${difficulty.title}`;
    $('end-title').textContent = won ? 'Victory' : 'Defeat';
    $('end-stars').innerHTML = won ? [1, 2, 3].map(i => `<span class="${i <= starCount ? 'on' : ''}">${icon('star')}</span>`).join('') : '';
    $('end-stars').setAttribute('aria-label', won ? `${starCount} of 3 stars` : '');
    const best = GameKit.readBests(SLUG)[bestMode()];
    $('end-text').textContent = won
        ? `All ${campaignWaves.length} waves held with ${health} of ${maxHealth} lives left.` +
            (starCount < 3 ? ` Keep ${Math.ceil(maxHealth * (starCount === 1 ? 0.5 : 0.9))} lives for ${starCount + 1} stars.` : '')
        : `The base fell during wave ${wave}. ` + (isNew ? 'New personal best!' : best ? `Your best here: ${best.value} waves.` : '');
    const rows = [
        ['Waves held', cleared],
        ['Defeated', stats.kills],
        ['Lives lost', stats.leaked],
        ['Towers built', stats.built],
        ['Upgrades', stats.upgrades],
        ['Gold earned', `$${stats.earned}`]
    ];
    $('end-stats').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

    const designed = MAP_LIST.filter(m => m.group === 'designed');
    const i = designed.findIndex(m => m.id === mapId);
    const next = won && i >= 0 && i < designed.length - 1 ? designed[i + 1] : null;
    const nextBtn = $('end-next');
    nextBtn.hidden = !next;
    nextBtn.textContent = next ? `Next map: ${next.title}` : '';
    nextBtn.dataset.map = next ? next.id : '';
    $('end-retry').classList.toggle('primary', !next);

    flashes = [];
    floaters = [];
    cancelPlace();
    openOverlay('end');
    updateControls();
}

$('end-next').addEventListener('click', e => {
    mapId = e.currentTarget.dataset.map;
    savePrefs();
    resetGame();
});
$('end-retry').addEventListener('click', () => resetGame());
$('end-levels').addEventListener('click', () => {
    closeOverlay('end');
    openLevels();
});


// ---------- Start ----------

buildStore();
