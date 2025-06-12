let manifest;
try {
  const response = await fetch('../assets/manifest.json');
  manifest = await response.json();
} catch (error) {
  console.error('Error loading manifest.json:', error);
  manifest = {}; // fallback empty object
}
let data = {};

let lsData = localStorage.getItem(
    manifest.name + ' Data'
);

if (lsData !== null) {
    data = JSON.parse(lsData);
}

let save = (key, value) => {
    data[key] = value;
    localStorage.setItem(
        manifest.name + ' Data',
        JSON.stringify(data)
    );
};

let load = (key) => {
    return data[key];
};

export default Object.freeze({
    save,
    load
});
