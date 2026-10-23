// Page interface: HUD, build menu, tower inspector, wave preview, banners,
// first-game tips, level select, pause menu and end screens. Game state lives
// in sketch.js; pictures of towers, enemies and maps come from art.js and
// terrain.js.

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

const TOWER_TAGS = {
    gun: ['Single target'], machineGun: ['Rapid fire'],
    laser: ['Beam', 'Energy'], beamEmitter: ['Beam', 'Ramps up'],
    slow: ['Area', 'Slows'], poison: ['Area', 'Poison'],
    sniper: ['Long range'], railgun: ['Piercing', 'Splash'],
    rocket: ['Homing', 'Splash'], missileSilo: ['Homing', 'Big splash'],
    bomb: ['Splash'], clusterBomb: ['4 blasts'],
    tesla: ['Zap'], lightningStrike: ['Zap', 'Long range']
};

const ENEMY_INFO = {
    weak: { title: 'Slime', blurb: 'Slow and fragile.' },
    strong: { title: 'Beetle', blurb: 'Twice as tough.' },
    fast: { title: 'Dart', blurb: 'Moves at double speed.' },
    strongFast: { title: 'Glider', blurb: 'Fast and tougher.' },
    medic: { title: 'Medic', blurb: 'Heals enemies around it.' },
    stronger: { title: 'Golem', blurb: 'Lots of health.' },
    faster: { title: 'Racer', blurb: 'Very fast and shrugs off explosions.' },
    tank: { title: 'Tank', blurb: 'Immune to slow and poison. Weak to explosions and snipers.' },
    taunt: { title: 'Taunt', blurb: 'Boss. Draws every tower\'s fire. Huge health.' },
    spawner: { title: 'Hive', blurb: 'Boss. Opens a new portal where it dies.' }
};

const TYPE_NAMES = {
    physical: 'Physical',
    energy: 'Energy',
    slow: 'Slow',
    poison: 'Poison',
    explosion: 'Explosive',
    piercing: 'Piercing'
};

const esc = (str) => String(str).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const isTouch = () => lastPointer !== 'mouse';
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const towerPic = (name, size = 64) => `<img class="pic" src="${Art.towerPortrait(name, size)}" alt="" width="${size}" height="${size}">`;
const enemyPic = (name, size = 48) => `<img src="${Art.enemyPortrait(name, size)}" alt="" width="${size}" height="${size}">`;

function mapInfo(id = mapId) {
    return MAP_LIST.find(m => m.id === id) || MAP_LIST[0];
}

function mapTitle(id = mapId) {
    const m = mapInfo(id);
    return m.spawns ? `${m.title} (${m.spawns} spawns)` : m.title;
}


// ---------- Tower numbers ----------

// Hits per second, average damage per hit and damage per second
function towerNumbers(t) {
    const cd = Math.max(1, (t.cooldownMin + t.cooldownMax) / 2);
    const rate = 60 / cd;
    let hit = (t.damageMin + t.damageMax) / 2;
    if (t.name === 'tesla' || t.name === 'lightningStrike') hit *= 2;     // zap plus the extra hit
    if (t.name === 'clusterBomb') hit *= 4;                                 // main blast and three more
    let dps = hit * rate;
    if (t.name === 'beamEmitter') dps = 400;                                // ramps up on one target
    if (t.type === 'poison') dps = 60;
    if (t.type === 'slow') dps = 0;
    return { rate, hit, dps };
}

// 0..1 values for the comparison bars
function towerBars(t) {
    const n = towerNumbers(t);
    return {
        power: Math.min(1, Math.sqrt(n.dps / 400)),
        range: Math.min(1, (t.range + 1) / 12),
        rate: Math.min(1, Math.log(1 + n.rate) / Math.log(61))
    };
}

function barsHTML(t, next = null) {
    const a = towerBars(t);
    const b = next ? towerBars(next) : null;
    const n = towerNumbers(t);
    const row = (key, label, title) => {
        const v = Math.round(a[key] * 100);
        const g = b ? Math.round(b[key] * 100) : 0;
        const up = b && g > v;
        return `<span class="bar${up ? ' up' : ''}" title="${esc(title)}">${label}<i style="--v:${v}%">${up ? `<span class="ghost" style="--g:${g}%"></span>` : ''}</i></span>`;
    };
    const power = t.type === 'slow' ? 'Slows enemies, no damage' : `About ${Math.round(n.dps)} damage per second`;
    return row('power', 'Power', power) + row('range', 'Range', `Range ${t.range}`) + row('rate', 'Rate', `${n.rate >= 30 ? 'Constant' : n.rate.toFixed(1) + ' shots per second'}`);
}

function towerStats(t) {
    const { rate } = towerNumbers(t);
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
        `<div><dt>${k}</dt><dd title="${esc(v)}">${esc(v)}</dd></div>`).join('')}</dl>`;
}

const tagsHTML = (name) => (TOWER_TAGS[name] || []).join(' · ');

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


// ---------- Build menu ----------

function buildStore() {
    const grid = $('store-grid');
    grid.innerHTML = TOWER_ORDER.map((name, i) => {
        const t = createTower(0, 0, tower[name]);
        return `<button type="button" class="tower-btn" data-tower="${name}" aria-label="${esc(t.title)}, $${t.cost} (key ${i + 1})" title="${esc(TOWER_BLURBS[name])}">
            <kbd>${i + 1}</kbd>${towerPic(name, 64)}
            <span class="name">${esc(t.title.replace(' Tower', ''))}</span>
            <span class="cost">$${t.cost}</span>
            <span class="bars">${barsHTML(t)}</span>
        </button>`;
    }).join('');
    grid.addEventListener('click', e => {
        const b = e.target.closest('[data-tower]');
        if (!b) return;
        setPlace(b.dataset.tower);
        b.blur();
    });
}


// ---------- Inspector ----------

let lastSubject = null;
function updateInfo() {
    const placing = !!toPlace;
    const sel = !placing && selected && selected.alive ? selected : null;
    if (!sel) selected = placing ? null : selected && selected.alive ? selected : null;
    document.body.classList.toggle('is-placing', placing);
    document.body.classList.toggle('touch', isTouch());
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
    // Touch has no hover: show the upgraded range while a tower is selected
    Renderer.upgradeRange = sel && sel.upgrades.length && isTouch() ? upgradedRange(sel) : 0;
    if (sel) Renderer.reveal(sel.pos.x, sel.pos.y);
    shown.afford = null;
    lastPlaceKey = null;
    updatePlaceStatus();
    refreshAffordability();
}

function upgradedRange(t) {
    return t.upgrades.length && t.upgrades[0].range ? t.upgrades[0].range : t.range;
}

function clearInfo() {
    updateInfo();
}

function idleHTML() {
    const touch = isTouch();
    return `<div class="insp-head"><div><h2>Build &amp; defend</h2></div></div>
        <p class="hint">${touch
            ? 'Pick a tower, then tap a tile on the map. Tap a built tower to upgrade or sell it. Pinch to zoom.'
            : 'Pick a tower (keys 1-7), then click the map. Click a built tower to upgrade or sell it. Scroll to zoom.'}</p>
        <ul class="legend">
            <li>${portalPic()}Enemies come out of the portals</li>
            <li>${gatePic()}Your gate: every enemy that reaches it costs lives</li>
            <li>${chevronPic()}Arrows show their way. On open ground towers block it, so build a maze</li>
        </ul>
        <p class="hint desk-only" style="margin-top:12px">Space start / pause &middot; T speed &middot; N send wave &middot; Esc menu</p>`;
}

function placeHTML() {
    const t = createTower(0, 0, tower[towerType]);
    return `<div class="insp-head">${towerPic(towerType, 64)}
            <div><h2>${esc(t.title)} <span style="color:var(--accent)">$${t.cost}</span></h2><p class="blurb">${esc(TOWER_BLURBS[towerType])}</p><p>${tagsHTML(towerType)}</p></div>
            <button type="button" class="icon-btn" data-act="cancel" aria-label="Stop building (Esc)">${icon('close')}</button>
        </div>
        ${statGrid(t)}
        <p class="stat-line phone-only">${Object.entries(towerStats(t)).map(([k, v]) => `${k} <b>${esc(v)}</b>`).join(' · ')}</p>
        <div class="insp-bars">${barsHTML(t)}</div>
        <div class="switch phone-only" role="group" aria-label="Switch tower">${TOWER_ORDER.map(n =>
            `<button type="button" data-act="switch" data-tower="${n}" aria-label="${esc(tower[n].title)} $${tower[n].cost}" aria-pressed="${n === towerType}"${!godMode && cash < tower[n].cost ? ' class="poor"' : ''}>${towerPic(n, 64)}</button>`).join('')}</div>
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
    let nextT = null;
    if (t.upgrades.length) {
        const u = t.upgrades[0];
        const { next, rows } = upgradeDiff(t, u);
        nextT = next;
        upgradeBlock = `<p class="insp-label">Upgrade</p>
            <div class="upgrade-card">
                <h3>${towerPic(u.name, 48)}<span>${esc(next.title)}</span><span class="price">$${u.cost}</span></h3>
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
    return `<div class="insp-head">${towerPic(t.name, 64)}
            <div><h2>${esc(t.title)}</h2><p>Level ${now} of ${level} &middot; ${tagsHTML(t.name)}</p></div>
            <button type="button" class="icon-btn" data-act="cancel" aria-label="Deselect (Esc)">${icon('close')}</button>
        </div>
        <div class="insp-actions phone-only" style="margin:0 0 8px">${quickUp}
            <button type="button" class="sell" data-act="sell">Sell +$${t.sellPrice()}</button>
        </div>
        ${statGrid(t)}
        <div class="insp-bars">${barsHTML(t, nextT)}</div>
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
        const reason = placeReasonCached(p.x, p.y);
        if (reason) {
            text = reason;
            kind = 'bad';
        } else if (!afford) {
            text = `Need $${cost - cash} more gold.`;
            kind = 'bad';
        } else {
            text = ghost ? 'Good spot. Tap it again or press Build.' : 'Good spot.';
            if (grid[p.x][p.y] === 0) text += ' Yellow arrows show the new way.';
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
        case 'switch':
            if (b.dataset.tower !== towerType) setPlace(b.dataset.tower);
            break;
    }
});

// Hovering or focusing an upgrade button shows the upgraded range on the map
['pointerover', 'focusin'].forEach(type => $('inspector').addEventListener(type, e => {
    if (e.target.closest('[data-up]') && selected) Renderer.upgradeRange = upgradedRange(selected);
}));
['pointerout', 'focusout'].forEach(type => $('inspector').addEventListener(type, e => {
    if (e.target.closest('[data-up]') && !isTouch()) Renderer.upgradeRange = 0;
}));


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
        const info = ENEMY_INFO[name] || { title: name };
        const boss = Art.ENEMY_ART[name] && Art.ENEMY_ART[name].boss;
        return `<span class="chip${boss ? ' boss' : ''}" data-enemy="${name}" title="${esc(info.title)}: ${esc(info.blurb || '')}">
            ${enemyPic(name, 52)}${esc(info.title)} <b>&times;${counts[name] * mult}</b>
            ${fresh.includes(name) ? '<span class="new">NEW</span>' : ''}</span>`;
    }).join('');
}

// Tapping an enemy in the preview explains it (there is no hover on phones)
$('preview').addEventListener('click', e => {
    const c = e.target.closest('[data-enemy]');
    if (!c) return;
    const info = ENEMY_INFO[c.dataset.enemy];
    if (info) toast(`${info.title}: ${info.blurb}`, 'info');
});

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
    if (!gameOver && !coachOn()) {
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


// ---------- Small pictures for the legend ----------

function smallCanvas(size, draw) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    g.scale(size, size);
    draw(g);
    return c.toDataURL();
}

let legendPics = null;
function legend() {
    if (legendPics) return legendPics;
    legendPics = {
        portal: smallCanvas(60, g => {
            g.fillStyle = '#3b1d7a';
            g.beginPath();
            g.arc(0, 0, 0.42, 0, Math.PI * 2);
            g.fill();
            g.strokeStyle = '#c38bff';
            g.lineWidth = 0.08;
            for (let i = 0; i < 3; i++) {
                g.beginPath();
                g.arc(0, 0, 0.32, i * 2.1, i * 2.1 + 1.4);
                g.stroke();
            }
        }),
        gate: smallCanvas(60, g => Art.drawGate(g)),
        chevron: smallCanvas(60, g => {
            g.fillStyle = '#c9a46b';
            g.fillRect(-0.5, -0.3, 1, 0.6);
            g.fillStyle = '#ffffff';
            [-0.22, 0.12].forEach(x => {
                g.beginPath();
                g.moveTo(x - 0.1, -0.16);
                g.lineTo(x + 0.08, 0);
                g.lineTo(x - 0.1, 0.16);
                g.lineTo(x - 0.02, 0.16);
                g.lineTo(x + 0.16, 0);
                g.lineTo(x - 0.02, -0.16);
                g.fill();
            });
        })
    };
    return legendPics;
}
const portalPic = () => `<img class="pic" src="${legend().portal}" alt="">`;
const gatePic = () => `<img class="pic" src="${legend().gate}" alt="">`;
const chevronPic = () => `<img class="pic" src="${legend().chevron}" alt="">`;


// ---------- Banners ----------

let bannerTimer = 0;
function showBanner(title, sub = '', kind = '', faces = []) {
    const el = $('banner');
    el.className = `banner ${kind}`;
    el.innerHTML = `<strong>${esc(title)}</strong>${sub ? `<span>${esc(sub)}</span>` : ''}` +
        (faces.length ? `<div class="faces">${faces.map(n => enemyPic(n, 68)).join('')}</div>` : '');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove('show'), faces.length ? 3200 : 2400);
}

function announceWave() {
    sfx('wave');
    FX.buzz(25);
    const total = gameMode === 'campaign' ? ` of ${campaignWaves.length}` : '';
    const fresh = newInWave(wave);
    let sub = '';
    if (fresh.length) sub = `New: ${fresh.map(n => `${ENEMY_INFO[n].title} - ${ENEMY_INFO[n].blurb}`).join(' ')}`;
    else if (gameMode === 'campaign' && wave === campaignWaves.length) sub = 'Final wave!';
    if (earlyBonus > 0) sub = `+$${earlyBonus} early bonus${sub ? ' · ' + sub : ''}`;
    earlyBonus = 0;
    showBanner(`Wave ${wave}${total}`, sub, '', fresh);
    tipEvent('started');
}

function waveCleared() {
    sfx('cleared');
    const next = skipToNext ? '' : `Next wave in ${Math.ceil(wcd / 60)}s · send it early for bonus gold`;
    showBanner(`Wave ${wave} cleared`, next, 'good');
    tipEvent('cleared');
}


// ---------- First-game tips ----------
// A few short steps the first time someone plays. Each waits for the player
// to do the thing it describes, then the next appears. Stored once finished.

const TIPS = [
    { text: () => 'Enemies come out of the <b>purple portals</b> and walk to your <b>golden gate</b>. The arrows show their way. Each one that gets through costs lives.', until: 'next' },
    { text: () => 'Pick a tower in the <b>build menu</b>. The bars compare power, range and rate.', until: 'placing', target: '#store' },
    { text: () => isTouch() ? 'Tap a free tile near the enemies\' way to aim, then tap it again (or press <b>Build</b>).' : 'Click a free tile near the enemies\' way to build it. Right click or Esc stops building.', until: 'built' },
    { text: () => 'Press <b>Start</b> when you are ready. You can keep building during waves.', until: 'started', target: '#pause' },
    { text: () => isTouch() ? 'Wave cleared. <b>Tap a tower</b> to upgrade it, sell it or choose what it shoots.' : 'Wave cleared. <b>Click a tower</b> to upgrade it, sell it or choose what it shoots.', until: 'selected', waitFor: 'cleared' }
];

let tipStep = -1;
let tipWaiting = false;

const coachOn = () => tipStep >= 0 && !tipWaiting;

function maybeStartTips() {
    if (store.get('tipsDone', false) || tipStep >= 0) return;
    tipStep = 0;
    tipWaiting = false;
    showTip();
}

function showTip() {
    document.querySelectorAll('.coach-target').forEach(el => el.classList.remove('coach-target'));
    const tip = TIPS[tipStep];
    if (!tip || tipWaiting) {
        $('coach').hidden = true;
        return;
    }
    $('coach-text').innerHTML = tip.text();
    $('coach-next').hidden = tip.until !== 'next';
    $('coach').hidden = false;
    if (tip.target) {
        const el = document.querySelector(tip.target);
        if (el) el.classList.add('coach-target');
    }
}

function tipEvent(name) {
    if (tipStep < 0) return;
    const tip = TIPS[tipStep];
    if (!tip) return;
    if (tipWaiting) {
        if (tip.waitFor === name) {
            tipWaiting = false;
            showTip();
        }
        return;
    }
    // Doing a later step early skips ahead to it
    const at = TIPS.findIndex((t, i) => i >= tipStep && t.until === name);
    if (at < 0) return;
    nextTip(at + 1);
}

function nextTip(step = tipStep + 1) {
    tipStep = step;
    if (tipStep >= TIPS.length) {
        endTips();
        return;
    }
    tipWaiting = !!TIPS[tipStep].waitFor;
    showTip();
}

function endTips() {
    tipStep = -1;
    tipWaiting = false;
    store.set('tipsDone', true);
    showTip();
}

$('coach-next').addEventListener('click', () => nextTip());
$('coach-skip').addEventListener('click', () => endTips());
$('replay-tips').addEventListener('click', () => {
    store.set('tipsDone', false);
    tipStep = -1;
    menuResume = false;
    closeOverlay('menu');
    resetGame();
    maybeStartTips();
});


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
    $('set-shake').checked = screenShake;
    $('set-haptics').checked = haptics;
    $('haptics-row').hidden = !('vibrate' in navigator);
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
    FX.enabled = showEffects;
    savePrefs();
});
$('set-autosend').addEventListener('change', e => {
    skipToNext = e.target.checked;
    savePrefs();
});
$('set-shake').addEventListener('change', e => {
    screenShake = e.target.checked;
    FX.shakeOn = screenShake;
    savePrefs();
});
$('set-haptics').addEventListener('change', e => {
    haptics = e.target.checked;
    savePrefs();
    if (haptics) FX.buzz(30);
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
            else sub = m.spawns ? `${m.spawns} portals` : 'Not played yet';
            const data = thumbData(m);
            const themeName = data ? Terrain.THEMES[Terrain.themeFor(data, m.group === 'custom' ? null : m.id)].title : '';
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'map-card' + (m.id === mapId && pickMode === modeId && pickDiff === diffId ? ' current' : '');
            b.disabled = disabled;
            b.dataset.map = m.id;
            const starHTML = pickMode === 'campaign' && !disabled
                ? `<span class="mini-stars" aria-label="${st} of 3 stars">${[1, 2, 3].map(i => `<span class="${i <= st ? 'on' : ''}">${icon('star')}</span>`).join('')}</span>`
                : '';
            b.innerHTML = `<span class="thumb"><img alt="" src="${thumbURL(m, data)}" width="320" height="200">${themeName ? `<span class="theme">${esc(themeName)}</span>` : ''}</span>
                <span class="title"><span>${esc(m.spawns ? `${m.title} ×${m.spawns}` : m.title)}</span>${starHTML}</span>
                <span class="sub">${esc(sub)}</span>`;
            holder.append(b);
        });
    });
}

function thumbData(m) {
    if (m.group === 'designed') return maps[m.id];
    if (m.group === 'custom') return custom;
    return fakeRandomMap(m);
}

// Picture of a map for the level select, drawn with the game's terrain
const thumbCache = {};
function thumbURL(m, data) {
    if (!data) return blankThumb();
    const key = m.group === 'custom' ? `custom-${store.get('customMap', '').length}` : m.id;
    if (thumbCache[key]) return thumbCache[key];
    const W = 320;
    const H = 200;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    const theme = Terrain.themeFor(data, m.group === 'custom' ? null : m.id);
    g.fillStyle = Terrain.THEMES[theme].frame;
    g.fillRect(0, 0, W, H);
    const px = Math.max(2, Math.floor(Math.min(W / data.cols, H / data.rows)));
    const t = Terrain.render({ m: data, px, theme });
    const ox = Math.floor((W - t.width) / 2);
    const oy = Math.floor((H - t.height) / 2);
    g.drawImage(t, ox, oy);
    // Portals and the gate, a bit larger than a tile so they read when small
    const r = Math.max(4, px * 0.8);
    data.spawnpoints.forEach(([x, y]) => {
        g.fillStyle = '#7c4dff';
        g.beginPath();
        g.arc(ox + (x + 0.5) * px, oy + (y + 0.5) * px, r, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#e3ccff';
        g.lineWidth = Math.max(1, r * 0.3);
        g.stroke();
    });
    g.save();
    g.translate(ox + (data.exit[0] + 0.5) * px, oy + (data.exit[1] + 0.5) * px);
    g.scale(r * 2.4, r * 2.4);
    Art.drawGate(g);
    g.restore();
    return (thumbCache[key] = cv.toDataURL('image/png'));
}

let blank = null;
function blankThumb() {
    if (blank) return blank;
    const cv = document.createElement('canvas');
    cv.width = 320;
    cv.height = 200;
    const g = cv.getContext('2d');
    g.fillStyle = '#09090b';
    g.fillRect(0, 0, 320, 200);
    return (blank = cv.toDataURL());
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
        maybeStartTips();
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
    FX.buzz(won ? [40, 60, 40, 60, 120] : [200, 80, 300]);

    $('end').querySelector('.panel').classList.toggle('lost', !won);
    $('end-kicker').textContent = `${mapTitle()} · ${gameMode === 'campaign' ? 'Campaign' : 'Endless'} · ${difficulty.title}`;
    $('end-title').textContent = won ? 'Victory' : 'Defeat';
    $('end-badge').textContent = isNew ? 'New best' : '';
    $('end-badge').hidden = !isNew;
    $('end-stars').innerHTML = won ? [1, 2, 3].map(i => `<span class="${i <= starCount ? 'on' : ''}">${icon('star')}</span>`).join('') : '';
    $('end-stars').setAttribute('aria-label', won ? `${starCount} of 3 stars` : '');
    const best = GameKit.readBests(SLUG)[bestMode()];
    $('end-text').textContent = won
        ? `All ${campaignWaves.length} waves held with ${health} of ${maxHealth} lives left.` +
            (starCount < 3 ? ` Keep ${Math.ceil(maxHealth * (starCount === 1 ? 0.5 : 0.9))} lives for ${starCount + 1} stars.` : '')
        : `The gate fell during wave ${wave}. ` + (isNew ? 'New personal best!' : best ? `Your best here: ${best.value} waves.` : '');
    const rows = [
        ['Waves held', cleared],
        ['Defeated', stats.kills],
        ['Lives lost', stats.leaked],
        ['Towers built', stats.built],
        ['Upgrades', stats.upgrades],
        ['Gold earned', `$${stats.earned}`]
    ];
    $('end-stats').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    drawEndArt(won);

    const designed = MAP_LIST.filter(m => m.group === 'designed');
    const i = designed.findIndex(m => m.id === mapId);
    const next = won && i >= 0 && i < designed.length - 1 ? designed[i + 1] : null;
    const nextBtn = $('end-next');
    nextBtn.hidden = !next;
    nextBtn.textContent = next ? `Next map: ${next.title}` : '';
    nextBtn.dataset.map = next ? next.id : '';
    $('end-retry').classList.toggle('primary', !next);

    floaters = [];
    cancelPlace();
    openOverlay('end');
    updateControls();
}

// Header picture for the end screen: this map, the gate, and the towers you used
function drawEndArt(won) {
    const cv = $('end-canvas');
    const g = cv.getContext('2d');
    const W = cv.width;
    const H = cv.height;
    const view = { cols, rows, grid, display, spawnpoints: spawnpoints.map(s => [s.x, s.y]), exit: [exit.x, exit.y] };
    const px = Math.max(3, Math.ceil(Math.max(W / cols, H / rows)));
    const t = Terrain.render({ m: view, px, theme: mapTheme });
    // Centre the crop on the gate
    const ex = (exit.x + 0.5) * px;
    const ey = (exit.y + 0.5) * px;
    const sx = Math.max(0, Math.min(t.width - W, ex - W / 2));
    const sy = Math.max(0, Math.min(t.height - H, ey - H / 2));
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.drawImage(t, sx, sy, W, H, 0, 0, W, H);
    g.fillStyle = won ? 'rgba(9,9,11,0.35)' : 'rgba(40,0,0,0.5)';
    g.fillRect(0, 0, W, H);
    // Towers that were standing, along the bottom
    const kinds = [...new Set(towers.map(x => x.name))].slice(0, 6);
    const step = 52;
    kinds.forEach((name, i) => {
        const img = new Image();
        img.onload = () => g.drawImage(img, W / 2 + (i - (kinds.length - 1) / 2) * step - 22, H - 50, 44, 44);
        img.src = Art.towerPortrait(name, 64);
    });
    g.save();
    g.translate(W / 2, H / 2 - 12);
    g.scale(86, 86);
    if (!won) g.rotate(0.12);
    Art.drawGate(g);
    if (!won) {
        g.strokeStyle = '#14161c';
        g.lineWidth = 0.05;
        g.beginPath();
        g.moveTo(-0.2, -0.42);
        g.lineTo(-0.05, -0.1);
        g.lineTo(-0.15, 0.1);
        g.lineTo(0.05, 0.42);
        g.stroke();
    }
    g.restore();
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

