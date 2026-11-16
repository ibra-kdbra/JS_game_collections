// Imported before anything creates a THREE.Color: work in linear colour with
// sRGB output, so hex colours, glTF textures and canvas textures all agree.
import * as THREE from '../vendor/three-0.150.1/three.module.min.js';

THREE.ColorManagement.legacyMode = false;

/** sRGB component (0..1) to linear, for raw vertex colours. */
export const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
