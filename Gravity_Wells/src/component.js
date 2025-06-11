const components = {};

async function loadAllComponents() {
  const componentList = [
    'arrowdown', 'arrowleft', 'arrowright', 'arrowup',
    'bgcut', 'blackhole', 'blanksquare', 'canvas',
    'fillrect', 'home', 'levels', 'maintitle',
    'mask', 'neutronstar', 'pointer', 'position',
    'progress', 'puzzle', 'size', 'state',
    'statemachine', 'text', 'tunnel', 'xsquare'
  ];

  for (const name of componentList) {
    try {
      const response = await fetch(`./components/${name}.json`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      components[name] = await response.json();
    } catch (error) {
      console.error(`Failed to load component ${name}:`, error);
      components[name] = {}; // Fallback empty object
    }
  }
}

// Initialize components when the module loads
await loadAllComponents();

const add = (entity, component) => {
  if (!components[component]) {
    console.warn(`Component ${component} not found`);
    return entity;
  }
  
  entity[component] = JSON.parse(JSON.stringify(components[component]));
  return entity;
};

export default Object.freeze({
  add
});