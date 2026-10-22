import { initThemeToggle, registerServiceWorker, initFeedbackButtons } from './site.js';

initThemeToggle('../assets/icons/sprite.svg');
initFeedbackButtons('art_lab_hub', '../');
registerServiceWorker('../sw.js');
