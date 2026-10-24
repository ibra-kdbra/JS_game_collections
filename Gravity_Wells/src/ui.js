import puzzleSystem from './updates/puzzle.js';
import soundSystem from './sound.js';
import dataSystem from './data.js';

const ICONS = {
    sound: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    muted: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
    grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>'
};

let icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>';

let button = (label, html) => {
    let b = document.createElement('button');
    b.type = 'button';
    b.className = 'gw-btn';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.innerHTML = html;
    return b;
};

let setup = (entities) => {
    let levels = entities.game.levels;
    let sequence = levels.sequence;
    let current = () => sequence[levels.current];
    let isPuzzle = id => entities[id].puzzle.grid.length > 0;

    let bar = document.createElement('div');
    bar.className = 'gw-hud';

    let muted = dataSystem.load('muted') === true;
    let muteButton = button('Mute', '');
    let renderMute = () => {
        muteButton.innerHTML = icon(muted ? 'muted' : 'sound');
        muteButton.setAttribute('aria-pressed', String(muted));
        muteButton.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
        muteButton.title = (muted ? 'Unmute' : 'Mute') + ' (M)';
    };
    let toggleMute = () => {
        muted = !muted;
        dataSystem.save('muted', muted);
        soundSystem.setMuted(muted);
        renderMute();
    };
    soundSystem.setMuted(muted);
    renderMute();
    muteButton.addEventListener('click', () => {
        toggleMute();
        muteButton.blur();
    });

    let listButton = button('Puzzles (L)', icon('grid'));

    let dialog = document.createElement('dialog');
    dialog.className = 'gw-levels';
    dialog.setAttribute('aria-labelledby', 'gw-levels-title');
    dialog.innerHTML = '<div class="gw-levels-head">'
        + '<h2 id="gw-levels-title">Puzzles</h2>'
        + '<p class="gw-levels-count"></p>'
        + '<button type="button" class="gw-btn gw-close" aria-label="Close">'
        + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
        + '</button></div><ol class="gw-levels-grid"></ol>'
        + '<p class="gw-levels-help">Keys: ← → previous / next, R or Enter reset, M mute</p>';
    let grid = dialog.querySelector('.gw-levels-grid');
    let count = dialog.querySelector('.gw-levels-count');

    let renderLevels = () => {
        grid.textContent = '';
        let number = 0;
        let solvedCount = 0;
        sequence.forEach((id, index) => {
            if (!isPuzzle(id)) {
                return;
            }
            number = number + 1;
            let solved = puzzleSystem.isSolved(id);
            if (solved) {
                solvedCount = solvedCount + 1;
            }
            let item = document.createElement('li');
            let b = document.createElement('button');
            b.type = 'button';
            b.className = 'gw-level';
            if (solved) {
                b.classList.add('is-solved');
            }
            if (id === current()) {
                b.setAttribute('aria-current', 'true');
            }
            b.innerHTML = '<span class="gw-level-n">' + number
                + (solved ? ' ✓' : '') + '</span>'
                + '<span class="gw-level-name">' + id + '</span>';
            b.setAttribute('aria-label', 'Puzzle ' + number + ', ' + id
                + (solved ? ', solved' : ''));
            b.addEventListener('click', () => {
                puzzleSystem.navigate(index);
                dialog.close();
            });
            item.append(b);
            grid.append(item);
        });
        count.textContent = solvedCount + ' / ' + number + ' solved';
    };

    let openLevels = () => {
        renderLevels();
        dialog.showModal();
        let active = grid.querySelector('[aria-current]') || grid.querySelector('button');
        active.focus();
    };

    listButton.addEventListener('click', () => {
        listButton.blur();
        openLevels();
    });
    dialog.querySelector('.gw-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => {
        if (e.target === dialog) {
            dialog.close();
        }
    });

    bar.append(listButton, muteButton);
    document.body.append(bar, dialog);

    document.addEventListener('keydown', e => {
        if (dialog.open || e.altKey || e.ctrlKey || e.metaKey) {
            return;
        }
        let key = e.key;
        let action = null;
        if (key === 'ArrowRight' || key === 'PageDown') {
            action = 'next';
        } else if (key === 'ArrowLeft' || key === 'PageUp') {
            action = 'prev';
        } else if (key === 'Enter' || key === ' ' || key === 'r' || key === 'R') {
            action = isPuzzle(current()) ? 'reset' : 'next';
        } else if (key === 'm' || key === 'M') {
            toggleMute();
        } else if (key === 'l' || key === 'L') {
            openLevels();
        } else {
            return;
        }
        e.preventDefault();
        if (action !== null) {
            puzzleSystem.navigate(action);
        }
    });
};

export default Object.freeze({
    setup
});
