import { createStore, migrateKey, recordBest } from '../../assets/kit/storage.js';

const store = createStore('gravity-wells');

// Earlier builds kept one object ({ current, solved, solutions }) under
// `gravity-wells.data`, and before that under "undefined Data". `current` was
// an index into this original puzzle order, so it is mapped to a puzzle id.
const LEGACY_SEQUENCE = [
    'titlescreen', 'startscreen', 'click', 'wait', 'push', 'move', 'tango',
    'substitute', 'wander', 'double', 'conflict', 'extract', 'grab', 'twin',
    'snare', 'sink', 'support', 'snatch', 'swivel', 'turmoil', 'end'
];

migrateKey(store, 'undefined Data', 'data', { parse: JSON.parse });
const legacy = store.get('data');
if (legacy !== null && typeof legacy === 'object') {
    if (Array.isArray(legacy.solved) && store.get('solved') === null) {
        store.set('solved', legacy.solved);
    }
    if (legacy.solutions && store.get('solutions') === null) {
        store.set('solutions', legacy.solutions);
    }
    if (LEGACY_SEQUENCE[legacy.current] && store.get('level') === null) {
        store.set('level', LEGACY_SEQUENCE[legacy.current]);
    }
    store.remove('data');
}

let save = (key, value) => {
    store.set(key, value);
};

let load = (key) => {
    let value = store.get(key);
    return value === null ? undefined : value;
};

let recordSolved = (count, total) => {
    recordBest('gravity-wells', count, { label: count + '/' + total + ' puzzles' });
};

export default Object.freeze({
    save,
    load,
    recordSolved
});
