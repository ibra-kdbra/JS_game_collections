/**
 * The game's own words: help pages, hints, warnings and pet descriptions.
 * They aren't kept in this source. `tools/convert.py` reads them out of your
 * copy of Insaniquarium.exe, at the places listed in `tools/strings.json`,
 * into assets/text.json. A few lines are this version's own, below.
 */
const OWN = {
  'help.4.0': 'Virtual Tank is a tank of your own to stock and look after.',
  'help.4.3': 'To shop in Virtual Tank, use the Menu button and choose Visit Store.',
  'help.5.4': 'Keys 1 to 8 buy from the shop.  P or Esc pauses the game.',
  'mode.virtual': 'A tank of your own to stock and look after.',
  'welcome.boss': 'The final battle!',
  'note.shells': 'You need more Shells for that. Play the other modes to earn them!',
};

/** A piece of game text by key, or '' if it hasn't been converted. */
export const say = (key) => globalThis.__ASSETS?.text?.[key] ?? OWN[key] ?? '';

const page = (head, n, i) => ({ head, text: Array.from({ length: n }, (_, j) => say(`help.${i}.${j}`)) });

/** The help pages. */
export const HELP = [
  page('THE BASICS', 5, 0),
  page('UPGRADES', 5, 1),
  page('PETS', 5, 2),
  page('GAME MODES', 5, 3),
  page('VIRTUAL TANK', 4, 4),
  page('TIPS', 5, 5),
];
