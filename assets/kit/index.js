/**
 * Game Lab kit entry point.
 *
 * Module games import what they need directly:
 *   import { createLoop } from '../assets/kit/loop.js';
 *
 * Classic-script games can load this file as a module and use `window.GameKit`
 * once the `gamekit:ready` event has fired (or after DOMContentLoaded, since
 * module scripts run before it):
 *   <script type="module" src="../assets/kit/index.js"></script>
 */
import * as storage from './storage.js';
import * as loop from './loop.js';
import * as input from './input.js';
import * as shell from './shell.js';

const GameKit = Object.freeze({ ...storage, ...loop, ...input, ...shell });
window.GameKit = GameKit;
document.dispatchEvent(new CustomEvent('gamekit:ready', { detail: GameKit }));

export default GameKit;
