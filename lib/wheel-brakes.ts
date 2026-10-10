import { CylinderGeometry, ExtrudeGeometry, Group, Mesh, Shape, type BufferGeometry, type Material } from "three";

/** Wheel-local dimensions: +z faces the viewer. Both pads flank the rotor;
 * the housing wraps its outer edge and stays behind the rotating spokes.
 */
export const BRAKE_LAYOUT = {
  rotorRadius: .657,
  rotorRear: -.035,
  rotorFront: -.001,
  padInnerRadius: .537,
  padOuterRadius: .64,
  padHalfAngle: .335,
  housingInnerRadius: .522,
  housingOuterRadius: .699,
  housingHalfAngle: .415,
  bridgeInnerRadius: .669,
  bridgeOuterRadius: .696,
} as const;

type Surfaces = { yellow: Material; friction: Material; hardware: Material };

/** Pure geometry builder, also usable for depth/occlusion checks without WebGL. */
export function createWheelCaliper(surfaces: Surfaces) {
  const group = new Group(); group.name = "brake-caliper-assembly";
  const geometries = new Set<BufferGeometry>();
  function add(geometry: BufferGeometry, surface: Material, name: string, z: number) {
    geometries.add(geometry);
    const object = new Mesh(geometry, surface);
    object.name = name; object.position.z = z;
    object.castShadow = true; object.receiveShadow = true;
    group.add(object);
    return object;
  }
  function sector(inner: number, outer: number, halfAngle: number, depth: number, bevel = 0) {
    const shape = new Shape();
    shape.absarc(0, 0, outer, -halfAngle, halfAngle, false);
    shape.lineTo(inner * Math.cos(halfAngle), inner * Math.sin(halfAngle));
    shape.absarc(0, 0, inner, halfAngle, -halfAngle, true);
    shape.closePath();
    return new ExtrudeGeometry(shape, {
      depth, curveSegments: 24, bevelEnabled: bevel > 0,
      bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3,
    });
  }
  const b = BRAKE_LAYOUT;
  // Friction surfaces sit just off each rotor face, fully inside the housing.
  const padGeometry = sector(b.padInnerRadius, b.padOuterRadius, b.padHalfAngle, .011);
  add(padGeometry, surfaces.friction, "brake-pad-outboard", b.rotorFront + .002);
  add(padGeometry, surfaces.friction, "brake-pad-inboard", b.rotorRear - .013);

  // Two opposing cast bodies, joined outside the rotor instead of through it.
  add(sector(b.housingInnerRadius, b.housingOuterRadius, b.housingHalfAngle, .065, .006),
    surfaces.yellow, "caliper-body-outboard", .023);
  add(sector(b.housingInnerRadius, b.housingOuterRadius, b.housingHalfAngle, .052, .006),
    surfaces.yellow, "caliper-body-inboard", -.113);
  add(sector(b.bridgeInnerRadius, b.bridgeOuterRadius, b.housingHalfAngle - .015, .16, .003),
    surfaces.yellow, "caliper-outer-bridge", -.102);

  // Cast piston-bore bosses and fasteners follow the same curved housing.
  const bossGeometry = new CylinderGeometry(.037, .043, .012, 24);
  bossGeometry.rotateX(Math.PI / 2);
  for (const [i, angle] of [-.235, 0, .235].entries()) {
    const boss = add(bossGeometry, surfaces.yellow, `caliper-cast-boss-${i}`, .094);
    boss.position.x = .604 * Math.cos(angle); boss.position.y = .604 * Math.sin(angle);
  }
  const boltGeometry = new CylinderGeometry(.009, .009, .006, 6);
  boltGeometry.rotateX(Math.PI / 2);
  for (const [i, angle] of [-.36, .36].entries()) {
    const bolt = add(boltGeometry, surfaces.hardware, `caliper-fastener-${i}`, .103);
    bolt.position.x = .61 * Math.cos(angle); bolt.position.y = .61 * Math.sin(angle);
  }
  return { group, geometries };
}
