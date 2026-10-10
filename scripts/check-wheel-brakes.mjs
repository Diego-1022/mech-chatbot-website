import assert from "node:assert/strict";
import { Box3, Euler, Mesh, MeshStandardMaterial, Quaternion, Raycaster, Vector3 } from "three";
import { BRAKE_LAYOUT, createWheelCaliper } from "../lib/wheel-brakes.ts";

// Inspect the real generated surfaces, not screenshots or duplicated formulas.
const yellow = new MeshStandardMaterial({ color: "#ffc627" });
const friction = new MeshStandardMaterial({ color: "#191e22" });
const hardware = new MeshStandardMaterial({ color: "#343c43" });
const { group, geometries } = createWheelCaliper({ yellow, friction, hardware });
group.updateMatrixWorld(true);
const meshes = [];
group.traverse(object => { if (object instanceof Mesh) meshes.push(object); });
const outboard = group.getObjectByName("brake-pad-outboard");
const inboard = group.getObjectByName("brake-pad-inboard");
const front = new Box3().setFromObject(outboard);
const rear = new Box3().setFromObject(inboard);
assert(front.min.z > BRAKE_LAYOUT.rotorFront, "Outboard pad must sit outside the front rotor face");
assert(rear.max.z < BRAKE_LAYOUT.rotorRear, "Inboard pad must sit outside the rear rotor face");
assert(front.max.z < .017 && rear.min.z > -.055, "Pad thickness must fit inside the caliper cavity");

const ray = new Raycaster();
const cameraDirection = new Vector3(0, 0, 1).applyQuaternion(new Quaternion().setFromEuler(new Euler(.035, -.14, 0)).invert());
let coverageSamples = 0;
for (const [pad, direction] of [[outboard, -1], [inboard, 1]]) {
  const vertices = pad.geometry.attributes.position;
  for (let i = 0; i < vertices.count; i += 7) {
    const point = new Vector3().fromBufferAttribute(vertices, i).applyMatrix4(pad.matrixWorld);
    const radius = Math.hypot(point.x, point.y);
    assert(radius > .53 && radius < BRAKE_LAYOUT.rotorRadius - .01, "Pads must overlap the outer friction band, not the hub or empty space");
    for (const axis of [new Vector3(0, 0, 1), cameraDirection]) {
      const observer = axis.clone().multiplyScalar(-direction);
      ray.set(point.clone().add(observer), observer.clone().negate());
      const hit = ray.intersectObjects(meshes, false)[0];
      assert(hit && hit.object.material !== friction, "The housing must hide the pad silhouette from axial and tilted camera views");
      coverageSamples++;
    }
  }
}
const bridge = group.getObjectByName("caliper-outer-bridge");
const bridgeVertices = bridge.geometry.attributes.position;
for (let i = 0; i < bridgeVertices.count; i++) {
  const radius = Math.hypot(bridgeVertices.getX(i), bridgeVertices.getY(i));
  assert(radius > BRAKE_LAYOUT.rotorRadius + .005, "Connecting bridge must pass outside the rotor edge");
}
for (const mesh of meshes) {
  const vertices = mesh.geometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const point = new Vector3().fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld);
    assert(Math.hypot(point.x, point.y) < .72, "Caliper must clear the rim barrel");
    assert(point.z < .107, "Caliper must stay behind the deepest spoke edge");
  }
}
assert(meshes.every(mesh => !mesh.material.map && !mesh.material.transparent), "Brake surfaces must not introduce an image background plane");
for (const geometry of geometries) geometry.dispose();
yellow.dispose(); friction.dispose(); hardware.dispose();
console.log(JSON.stringify({ result: "pass", coveredPadSamples: coverageSamples, meshes: meshes.length,
  checks: ["two rotor-side pads", "pad radial/thickness fit", "housing hides pad silhouettes", "bridge clears rotor", "rim/spoke clearance", "no brake image background"] }));
