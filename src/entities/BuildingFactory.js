import * as THREE from 'three';
import { Materials } from '../materials/Materials.js';
import { rand } from '../utils/Rng.js';

// =============================================================================
// BuildingFactory — edificios caraqueños con VARIEDAD: torres residenciales,
// edificios medianos y casas de barrio bajas y coloridas. Detalles: cornisas,
// balcones, tanques de agua en azotea, comercios con santamaría y toldo, aires
// acondicionados, antenas y, a veces, una valla publicitaria en la azotea
// (letrero emissive que se enciende de noche). Devuelve un THREE.Group.
// =============================================================================

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
const FACADE_VARIANTS = 9;

function box(mat, w, h, d) {
  const m = new THREE.Mesh(boxGeo, mat);
  m.scale.set(w, h, d);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

const SHOP_COLORS = [0x9c3b34, 0x2f6b57, 0x35507a, 0xb5892a, 0x6b4b8a, 0xc0603a];
const AWNING_COLORS = [0xc0392b, 0x2e7d5b, 0xc99a2e, 0x2f5f8a, 0x8e4585];

export const BuildingFactory = {
  create(rng, { width, depth }) {
    const g = new THREE.Group();

    // estilo: torre alta / mediano / casa de barrio baja y colorida
    const roll = rng();
    const style = roll < 0.25 ? 'barrio' : roll < 0.6 ? 'mid' : 'tower';
    const floors = style === 'barrio' ? rand.int(rng, 2, 4)
      : style === 'mid' ? rand.int(rng, 5, 9)
        : rand.int(rng, 10, 16);
    const floorH = 3.2;
    const h = floors * floorH;
    const variant = rand.int(rng, 0, FACADE_VARIANTS - 1);
    const facadeMat = Materials.facade(variant);

    // cuerpo
    const body = box(facadeMat, width, h, depth);
    body.position.y = h / 2;
    g.add(body);

    // cornisa superior
    const cornice = box(Materials.concrete(0x8f8a80), width * 1.06, 0.5, depth * 1.06);
    cornice.position.y = h + 0.25;
    g.add(cornice);

    // comercio en planta baja (santamaría) + toldo a rayas de color
    const shop = box(Materials.paintedMetal(rand.pick(rng, SHOP_COLORS)), width * 1.01, 2.6, depth * 1.01);
    shop.position.y = 1.3;
    g.add(shop);
    const awning = box(Materials.awning(rand.pick(rng, AWNING_COLORS)), width * 0.9, 0.15, 1.1);
    awning.position.set(0, 2.6, depth / 2 + 0.55);
    awning.rotation.x = -0.18;
    g.add(awning);

    // balcones (cada 2 pisos en la cara frontal)
    const balMat = Materials.concrete(0xb4ada0);
    const railMat = Materials.metal(0x555a60);
    for (let f = 1; f < floors; f += 2) {
      const y = f * floorH + 0.2;
      const bx = box(balMat, width * 0.7, 0.2, 1.0);
      bx.position.set(0, y, depth / 2 + 0.5);
      g.add(bx);
      const rail = box(railMat, width * 0.7, 0.7, 0.08);
      rail.position.set(0, y + 0.45, depth / 2 + 1.0);
      g.add(rail);
      // aire acondicionado en algunos balcones
      if (rand.chance(rng, 0.4)) {
        const ac = box(Materials.metal(0xcfd2d6), 0.7, 0.5, 0.5);
        ac.position.set(rand.range(rng, -width * 0.3, width * 0.3), y + 0.5, depth / 2 + 0.35);
        g.add(ac);
      }
    }

    // tanques de agua en azotea (icónicos de Caracas)
    const tanks = rand.int(rng, 1, 3);
    for (let i = 0; i < tanks; i++) {
      const r = rand.range(rng, 0.7, 1.1);
      const th = rand.range(rng, 1.4, 2.2);
      const tank = new THREE.Mesh(cylGeo, Materials.waterTank());
      tank.scale.set(r, th, r);
      tank.position.set(
        rand.range(rng, -width * 0.3, width * 0.3),
        h + th / 2 + 0.3,
        rand.range(rng, -depth * 0.3, depth * 0.3)
      );
      tank.castShadow = true;
      g.add(tank);
    }

    // caja de escalera / cuarto de máquinas
    const penthouse = box(Materials.concrete(0x9a958c), width * 0.35, 2.4, depth * 0.35);
    penthouse.position.set(width * 0.2, h + 1.2, -depth * 0.1);
    g.add(penthouse);

    // antena en la azotea
    if (rand.chance(rng, 0.5)) {
      const ant = new THREE.Mesh(cylGeo, Materials.metal(0x3a3f47));
      ant.scale.set(0.06, rand.range(rng, 2, 4), 0.06);
      ant.position.set(-width * 0.25, h + 1.5 + ant.scale.y / 2, depth * 0.2);
      g.add(ant);
    }

    // valla publicitaria en la azotea (letrero emissive de noche)
    if (style !== 'barrio' && rand.chance(rng, 0.35)) {
      const color = rand.pick(rng, [0xffcf5a, 0xff5a4d, 0x2fb0d8, 0x53c07a, 0xe86bb0]);
      const sw = width * 0.8, sh = width * 0.32;
      const sign = box(Materials.sign(color), sw, sh, 0.25);
      sign.position.set(0, h + 0.5 + sh / 2, 0);
      g.add(sign);
      const frame = box(Materials.metal(0x40464e), sw * 1.05, sh * 1.1, 0.12);
      frame.position.copy(sign.position);
      g.add(frame);
    }

    g.userData.height = h;
    return g;
  }
};
