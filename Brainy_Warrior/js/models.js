// Procedural low-poly models: warrior, enemy, wizard, rocks. No asset files.
import * as THREE from 'three';

const mats = new Map();
/** Shared flat-shaded material per colour. */
export function mat(color, extra = {}) {
    const key = `${color}|${JSON.stringify(extra)}`;
    if (!mats.has(key)) {
        mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, flatShading: true, ...extra }));
    }
    return mats.get(key);
}

function mesh(geo, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
}


/**
 * Merge the direct mesh children of every group that share a material into one
 * mesh, so a character costs a handful of draw calls instead of dozens.
 */
function compact(group) {
    const byMat = new Map();
    for (const child of [...group.children]) {
        if (child.isMesh && !child.userData.keep) {
            if (!byMat.has(child.material)) byMat.set(child.material, []);
            byMat.get(child.material).push(child);
        } else if (!child.isMesh) {
            compact(child);
        }
    }
    for (const [material, meshes] of byMat) {
        if (meshes.length < 2) continue;
        const pos = [];
        const nor = [];
        for (const m of meshes) {
            m.updateMatrix();
            const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
            pos.push(...g.attributes.position.array);
            nor.push(...g.attributes.normal.array);
            g.dispose();
            group.remove(m);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        const merged = new THREE.Mesh(geo, material);
        merged.castShadow = true;
        group.add(merged);
    }
    return group;
}

const C = {
    skin: 0xf2c79b,
    steel: 0xb8c4d6,
    steelDark: 0x6b7a90,
    tunic: 0x1f6feb,
    gold: 0xfacc15,
    leather: 0x6b3f22,
    boot: 0x2b2118,
};

/** The hero. Faces +z; `parts` exposes pieces the animator moves. */
export function createWarrior() {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const legGeo = new THREE.BoxGeometry(0.11, 0.2, 0.12);
    body.add(mesh(legGeo, mat(C.boot), -0.08, 0.1, 0), mesh(legGeo, mat(C.boot), 0.08, 0.1, 0));
    const torso = mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.3, 7), mat(C.tunic), 0, 0.34, 0);
    body.add(torso);
    body.add(mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.06, 7), mat(C.leather), 0, 0.24, 0));
    body.add(mesh(new THREE.BoxGeometry(0.07, 0.06, 0.03), mat(C.gold), 0, 0.24, 0.215));
    // Pauldrons
    const padGeo = new THREE.SphereGeometry(0.09, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    body.add(mesh(padGeo, mat(C.steel), -0.19, 0.45, 0), mesh(padGeo, mat(C.steel), 0.19, 0.45, 0));

    const head = new THREE.Group();
    head.position.y = 0.6;
    body.add(head);
    head.add(mesh(new THREE.IcosahedronGeometry(0.13, 1), mat(C.skin)));
    const helm = mesh(new THREE.SphereGeometry(0.15, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(C.steel), 0, 0.01, 0);
    head.add(helm);
    head.add(mesh(new THREE.BoxGeometry(0.03, 0.12, 0.05), mat(C.steelDark), 0, -0.02, 0.135)); // nose guard
    const eyeGeo = new THREE.BoxGeometry(0.03, 0.03, 0.02);
    head.add(mesh(eyeGeo, mat(0x111111), -0.05, -0.01, 0.12), mesh(eyeGeo, mat(0x111111), 0.05, -0.01, 0.12));
    const plume = mesh(new THREE.ConeGeometry(0.05, 0.22, 5), mat(C.gold, { emissive: 0x332200 }), 0, 0.2, -0.04);
    plume.rotation.x = -0.5;
    head.add(plume);

    // Sword arm (right) and shield arm (left)
    const swordArm = new THREE.Group();
    swordArm.position.set(0.24, 0.42, 0.02);
    body.add(swordArm);
    swordArm.add(mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), mat(C.tunic), 0, -0.08, 0));
    const sword = new THREE.Group();
    sword.position.set(0, -0.17, 0.05);
    sword.rotation.x = Math.PI / 2.4;
    swordArm.add(sword);
    sword.add(mesh(new THREE.BoxGeometry(0.035, 0.09, 0.035), mat(C.leather), 0, 0, 0));
    sword.add(mesh(new THREE.BoxGeometry(0.16, 0.03, 0.04), mat(C.gold), 0, 0.055, 0));
    sword.add(mesh(new THREE.BoxGeometry(0.05, 0.36, 0.015), mat(0xe8eef7, { metalness: 0.6, roughness: 0.3 }), 0, 0.25, 0));
    sword.add(mesh(new THREE.ConeGeometry(0.035, 0.07, 4), mat(0xe8eef7, { metalness: 0.6, roughness: 0.3 }), 0, 0.46, 0));

    const shieldArm = new THREE.Group();
    shieldArm.position.set(-0.24, 0.4, 0.04);
    body.add(shieldArm);
    const shield = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 8), mat(C.steelDark), -0.03, -0.04, 0.05);
    shield.rotation.z = Math.PI / 2;
    shield.rotation.y = 0.25;
    shieldArm.add(shield);
    const boss = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 6), mat(C.gold), -0.055, -0.04, 0.05);
    boss.rotation.z = Math.PI / 2;
    shieldArm.add(boss);

    body.scale.setScalar(1.3);
    compact(root);
    root.userData.parts = { body, head, swordArm, shieldArm };
    return root;
}

/** A horned goblin raider. Faces +z. */
export function createEnemy(seed = 0) {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const hues = [0xb83b5e, 0x9b2d8a, 0xc2410c];
    const cloth = hues[seed % hues.length];
    const skin = 0x7cb342;
    body.add(mesh(new THREE.ConeGeometry(0.24, 0.42, 6), mat(cloth), 0, 0.21, 0));
    const head = new THREE.Group();
    head.position.y = 0.5;
    body.add(head);
    head.add(mesh(new THREE.IcosahedronGeometry(0.16, 0), mat(skin)));
    const hornGeo = new THREE.ConeGeometry(0.04, 0.16, 4);
    const hl = mesh(hornGeo, mat(0xf5f0e1), -0.11, 0.1, 0);
    hl.rotation.z = 0.6;
    const hr = mesh(hornGeo, mat(0xf5f0e1), 0.11, 0.1, 0);
    hr.rotation.z = -0.6;
    head.add(hl, hr);
    const earGeo = new THREE.ConeGeometry(0.035, 0.14, 3);
    const el = mesh(earGeo, mat(skin), -0.17, 0, 0);
    el.rotation.z = Math.PI / 2;
    const er = mesh(earGeo, mat(skin), 0.17, 0, 0);
    er.rotation.z = -Math.PI / 2;
    head.add(el, er);
    const eyeGeo = new THREE.BoxGeometry(0.05, 0.035, 0.02);
    const eyeMat = mat(0xffe066, { emissive: 0xffb300, emissiveIntensity: 0.9 });
    head.add(mesh(eyeGeo, eyeMat, -0.055, 0.02, 0.14), mesh(eyeGeo, eyeMat, 0.055, 0.02, 0.14));
    head.add(mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), mat(0x1b1b1b), 0, -0.06, 0.14));
    // Spear
    const spear = new THREE.Group();
    spear.position.set(0.24, 0.3, 0.05);
    body.add(spear);
    spear.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.75, 5), mat(C.leather), 0, 0.1, 0));
    spear.add(mesh(new THREE.ConeGeometry(0.045, 0.14, 4), mat(C.steel, { metalness: 0.5, roughness: 0.35 }), 0, 0.53, 0));
    body.scale.setScalar(1.3);
    compact(root);
    root.userData.parts = { body, head, spear };
    return root;
}

/** The wizard: robe, hat, beard, and a staff with a glowing crystal. */
export function createWizard() {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const robe = 0x5b21b6;
    body.add(mesh(new THREE.ConeGeometry(0.26, 0.6, 7), mat(robe), 0, 0.3, 0));
    body.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 7), mat(C.gold), 0, 0.18, 0));
    const head = new THREE.Group();
    head.position.y = 0.66;
    body.add(head);
    head.add(mesh(new THREE.IcosahedronGeometry(0.12, 1), mat(C.skin)));
    const beard = mesh(new THREE.ConeGeometry(0.1, 0.26, 6), mat(0xf1f5f9), 0, -0.13, 0.06);
    beard.rotation.x = Math.PI + 0.25;
    head.add(beard);
    head.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.025, 10), mat(robe), 0, 0.07, 0));
    const hat = mesh(new THREE.ConeGeometry(0.14, 0.42, 7), mat(robe), 0, 0.28, -0.02);
    hat.rotation.x = -0.18;
    head.add(hat);
    head.add(mesh(new THREE.TorusGeometry(0.13, 0.018, 4, 10), mat(C.gold), 0, 0.1, 0).rotateX(Math.PI / 2));
    const staff = new THREE.Group();
    staff.position.set(0.27, 0.0, 0.05);
    body.add(staff);
    staff.add(mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.95, 5), mat(C.leather), 0, 0.48, 0));
    const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.075, 0),
        new THREE.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0xfacc15, emissiveIntensity: 1.4, flatShading: true }),
    );
    crystal.position.y = 1.0;
    crystal.userData.keep = true;
    staff.add(crystal);
    body.scale.setScalar(1.2);
    compact(root);
    root.userData.parts = { body, head, staff, crystal };
    return root;
}

/** A few jittered boulder shapes, shared by every rock tile. */
export function createRockGeometries(count = 4) {
    const out = [];
    for (let k = 0; k < count; k++) {
        const g = new THREE.DodecahedronGeometry(0.42, 0);
        const p = g.attributes.position;
        const seen = new Map();
        for (let i = 0; i < p.count; i++) {
            const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
            if (!seen.has(key)) {
                const s = 0.82 + Math.abs(Math.sin((i + 1) * 12.9898 * (k + 1))) * 0.3;
                seen.set(key, s);
            }
            const s = seen.get(key);
            p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.85, p.getZ(i) * s);
        }
        g.computeVertexNormals();
        g.translate(0, 0.28, 0);
        out.push(g);
    }
    return out;
}
