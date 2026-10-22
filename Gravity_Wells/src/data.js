const STORAGE_KEY = 'gravity-wells.data';
// Older builds saved under this key because the manifest fetch 404'd.
const LEGACY_KEY = 'undefined Data';

let data = {};

try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (raw !== null) {
        data = JSON.parse(raw);
    }
} catch (error) {
    console.warn('Gravity Wells: saved data unavailable', error);
}

let save = (key, value) => {
    data[key] = value;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        // Storage can be blocked (private mode, quota); keep playing in memory.
    }
};

let load = (key) => {
    return data[key];
};

export default Object.freeze({
    save,
    load
});
