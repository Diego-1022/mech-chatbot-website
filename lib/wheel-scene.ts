import {
  ACESFilmicToneMapping, BoxGeometry, CanvasTexture, CatmullRomCurve3, CylinderGeometry,
  DirectionalLight, ExtrudeGeometry, Group, HemisphereLight, InstancedMesh,
  LatheGeometry, Matrix4, Mesh, MeshStandardMaterial, OrthographicCamera, Path,
  PCFShadowMap, PMREMGenerator, Scene, Shape, SRGBColorSpace, TorusGeometry, Vector2, Vector3,
  WebGLRenderer, type BufferGeometry, type Material,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { TessellateModifier } from "three/addons/modifiers/TessellateModifier.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { BRAKE_LAYOUT, createWheelCaliper } from "./wheel-brakes";

/** Locally modelled wheel: uniform albedo, actual bevels and fixed studio light.
 * No photograph, baked lighting, remote model or per-frame texture upload.
 */
export function createWheelScene(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = .9;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  const scene = new Scene();
  const camera = new OrthographicCamera(-1.13, 1.13, 1.13, -1.13, .1, 20);
  camera.position.set(0, 0, 6);
  camera.lookAt(0, 0, 0);

  // These lights/environment belong to the scene, never the rotating assembly.
  const room = new RoomEnvironment();
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, .04, .1, 100, { size: 128 });
  scene.environment = environment.texture;
  scene.environmentIntensity = .65;
  room.dispose();
  pmrem.dispose();
  scene.add(new HemisphereLight(0xe4edf3, 0x292e32, .45));
  const key = new DirectionalLight(0xf5f5ed, 1.8);
  key.position.set(-3, 4, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -1.3;
  key.shadow.camera.right = key.shadow.camera.top = 1.3;
  key.shadow.camera.near = .1; key.shadow.camera.far = 14;
  key.shadow.normalBias = .008; key.shadow.bias = -.0002;
  key.shadow.radius = 2;
  scene.add(key);
  const fill = new DirectionalLight(0xc3d5e4, .65);
  fill.position.set(4, -1, 3);
  scene.add(fill);

  const assembly = new Group();
  assembly.rotation.set(.035, -.14, 0);
  scene.add(assembly);
  const rotating = new Group();
  rotating.name = "rotating-wheel";
  assembly.add(rotating);
  const fixedBrake = new Group();
  fixedBrake.name = "fixed-caliper";
  assembly.add(fixedBrake);

  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures: CanvasTexture[] = [];
  const material = (color: string, metalness: number, roughness: number) => {
    const result = new MeshStandardMaterial({ color, metalness, roughness });
    materials.add(result);
    return result;
  };
  const mesh = (geometry: BufferGeometry, surface: Material | Material[], parent = rotating) => {
    geometries.add(geometry);
    const result = new Mesh(geometry, surface);
    result.castShadow = true; result.receiveShadow = true;
    parent.add(result);
    return result;
  };
  const rubber = material("#111416", 0, .88);
  const moulding = material("#202326", 0, .8);
  const alloy = material("#a4abb0", .95, .3);
  const alloyEdge = material("#525c65", .9, .4);
  const barrel = material("#363f48", .86, .43);
  const steel = material("#969ba0", .84, .48);
  const darkSteel = material("#343c43", .8, .5);
  const yellow = material("#ffc627", .25, .32);
  const pad = material("#191e22", .1, .8);

  // Fine moulded rubber and grooves carry no broad colour/highlight variation.
  const rubberCanvas = document.createElement("canvas");
  rubberCanvas.width = 1024; rubberCanvas.height = 256;
  const ctx = rubberCanvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#999"; ctx.fillRect(0, 0, 1024, 256);
    const pixels = ctx.getImageData(0, 0, 1024, 256);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const shade = 150 + ((i * 17 + Math.floor(i / 4096) * 13) % 9);
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = shade;
    }
    ctx.putImageData(pixels, 0, 0);
    ctx.strokeStyle = "#414141"; ctx.lineWidth = 3;
    for (let x = -16; x < 1040; x += 16) {
      ctx.beginPath(); ctx.moveTo(x, 74); ctx.lineTo(x + 9, 103);
      ctx.lineTo(x + 6, 130); ctx.lineTo(x + 14, 174); ctx.stroke();
    }
    for (const y of [100, 125, 150]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke(); }
    const texture = new CanvasTexture(rubberCanvas);
    textures.push(texture); rubber.bumpMap = texture; rubber.bumpScale = .008;
  }

  function lathe(profile: number[][], surface: Material, parent = rotating) {
    const curve = new CatmullRomCurve3(profile.map(([radius, depth]) => new Vector3(radius, depth, 0)));
    const points = curve.getPoints(48).map(point => new Vector2(point.x, point.y));
    const geometry = new LatheGeometry(points, 128);
    geometry.rotateX(Math.PI / 2);
    return mesh(geometry, surface, parent);
  }
  function ring(radius: number, thickness: number, depth: number, surface: Material, parent = rotating) {
    const result = mesh(new TorusGeometry(radius, thickness, 8, 128), surface, parent);
    result.position.z = depth;
    return result;
  }
  function cylinder(radius: number, depth: number, z: number, surface: Material, parent = rotating) {
    const geometry = new CylinderGeometry(radius, radius, depth, 64);
    geometry.rotateX(Math.PI / 2);
    const result = mesh(geometry, surface, parent); result.position.z = z;
    return result;
  }

  lathe([
    [.764, .17], [.79, .21], [.845, .24], [.92, .23], [.982, .17],
    [1.015, .10], [1.025, 0], [1.015, -.12], [.977, -.19], [.89, -.23],
    [.81, -.22], [.765, -.17], [.764, .17],
  ], rubber);
  // Instanced shoulder sipes share a single draw call.
  const grooveGeometry = new BoxGeometry(.006, .038, .005);
  geometries.add(grooveGeometry);
  const grooves = new InstancedMesh(grooveGeometry, material("#080b0d", 0, .97), 80);
  for (let i = 0; i < 80; i++) {
    const angle = i * Math.PI / 40;
    const transform = new Matrix4().makeRotationZ(angle - .28);
    transform.setPosition(-Math.sin(angle) * 1.005, Math.cos(angle) * 1.005, .123);
    grooves.setMatrixAt(i, transform);
  }
  rotating.add(grooves);
  for (const [radius, z] of [[.793, .218], [.818, .234], [.942, .214], [.968, .19]]) {
    ring(radius, .0018, z, moulding);
  }
  lathe([[.726, -.17], [.724, .16], [.739, .215], [.765, .22], [.779, .205], [.776, .165]], barrel);
  ring(.752, .014, .229, alloy);
  ring(.732, .005, .217, alloyEdge);

  // A drilled rotor with open holes is mechanically behind the spokes.
  const rotor = new Shape(); rotor.absarc(0, 0, BRAKE_LAYOUT.rotorRadius, 0, Math.PI * 2, false);
  const centre = new Path(); centre.absarc(0, 0, .235, 0, Math.PI * 2, true); rotor.holes.push(centre);
  for (let i = 0; i < 24; i++) for (let row = 0; row < 2; row++) {
    const angle = (i + row * .32) * Math.PI / 12;
    const radius = .51 + row * .078;
    const hole = new Path(); hole.absarc(Math.cos(angle) * radius, Math.sin(angle) * radius, .009, 0, Math.PI * 2, true);
    rotor.holes.push(hole);
  }
  const discGeometry = new ExtrudeGeometry(rotor, { depth: BRAKE_LAYOUT.rotorFront - BRAKE_LAYOUT.rotorRear, bevelEnabled: false, curveSegments: 12 });
  const brushedCanvas = document.createElement("canvas"); brushedCanvas.width = brushedCanvas.height = 512;
  const brushed = brushedCanvas.getContext("2d");
  if (brushed) {
    brushed.fillStyle = "#999"; brushed.fillRect(0, 0, 512, 512);
    for (let r = 1; r < 256; r++) {
      brushed.strokeStyle = r % 3 ? "#999" : "#888"; brushed.lineWidth = .7;
      brushed.beginPath(); brushed.arc(256, 256, r, 0, Math.PI * 2); brushed.stroke();
    }
    const texture = new CanvasTexture(brushedCanvas); textures.push(texture);
    steel.bumpMap = texture; steel.bumpScale = .0012;
    const uv = discGeometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, .5 + uv.getX(i) / 1.314, .5 + uv.getY(i) / 1.314);
  }
  const disc = mesh(discGeometry, steel); disc.position.z = BRAKE_LAYOUT.rotorRear;
  cylinder(.234, .048, -.017, darkSteel);

  // Five forged split spokes; raised hub, dished branches and bevelled edges.
  const spoke = new Shape();
  spoke.moveTo(-.072, .17); spoke.lineTo(-.076, .32);
  spoke.lineTo(-.172, .696); spoke.quadraticCurveTo(-.13, .726, -.087, .733);
  spoke.lineTo(-.026, .413); spoke.quadraticCurveTo(0, .36, .026, .413);
  spoke.lineTo(.087, .733); spoke.quadraticCurveTo(.13, .726, .172, .696);
  spoke.lineTo(.076, .32); spoke.lineTo(.072, .17); spoke.closePath();
  const blank = new ExtrudeGeometry(spoke, { depth: .071, bevelEnabled: true, bevelThickness: .009, bevelSize: .009, bevelSegments: 3, curveSegments: 12 });
  const tessellated = new TessellateModifier(.065, 7).modify(blank);
  const spokeGeometry = mergeVertices(tessellated);
  blank.dispose(); tessellated.dispose();
  const vertices = spokeGeometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const radius = Math.hypot(vertices.getX(i), vertices.getY(i));
    const bow = Math.sin(Math.max(0, Math.min(1, (radius - .17) / .56)) * Math.PI) * .04;
    vertices.setZ(i, vertices.getZ(i) + .12 + (.73 - radius) * .14 + bow);
  }
  spokeGeometry.computeVertexNormals();
  spokeGeometry.computeBoundingBox();
  for (let i = 0; i < 5; i++) mesh(spokeGeometry, alloy).rotation.z = i * Math.PI * 2 / 5;
  cylinder(.188, .1, .24, alloyEdge);
  cylinder(.117, .026, .298, alloy);
  ring(.116, .003, .313, alloyEdge);
  cylinder(.073, .004, .315, darkSteel);
  ring(.07, .0015, .318, alloy);

  const boltGeometry = new CylinderGeometry(.024, .024, .025, 6); boltGeometry.rotateX(Math.PI / 2);
  geometries.add(boltGeometry);
  const bolts = new InstancedMesh(boltGeometry, alloy, 5);
  const recessGeometry = new CylinderGeometry(.035, .035, .004, 24); recessGeometry.rotateX(Math.PI / 2);
  geometries.add(recessGeometry);
  const recesses = new InstancedMesh(recessGeometry, pad, 5);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5 + .05) * Math.PI * 2;
    bolts.setMatrixAt(i, new Matrix4().makeTranslation(Math.cos(angle) * .151, Math.sin(angle) * .151, .302));
    recesses.setMatrixAt(i, new Matrix4().makeTranslation(Math.cos(angle) * .151, Math.sin(angle) * .151, .293));
  }
  rotating.add(bolts, recesses);

  const caliper = createWheelCaliper({ yellow, friction: pad, hardware: darkSteel });
  fixedBrake.add(caliper.group);
  for (const geometry of caliper.geometries) geometries.add(geometry);
  // The maximum caliper front remains behind even the deepest spoke edge.
  caliper.group.updateMatrixWorld(true);
  let caliperFront = -Infinity;
  caliper.group.traverse(object => {
    if (object instanceof Mesh) {
      object.geometry.computeBoundingBox();
      caliperFront = Math.max(caliperFront, object.geometry.boundingBox!.max.z + object.position.z);
    }
  });
  const caliperSpokeClearance = spokeGeometry.boundingBox!.min.z - caliperFront;

  let disposed = false, renders = 0;
  function resize(width: number, height: number) {
    // A small phone wheel does not need a full devicePixelRatio3 render target.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 400 ? 1.5 : 2));
    renderer.setSize(Math.max(1, width), Math.max(1, height), false);
    const aspect = width / Math.max(1, height);
    camera.left = -1.13 * aspect; camera.right = 1.13 * aspect;
    camera.updateProjectionMatrix();
  }
  function render(degrees: number) {
    if (disposed) return;
    rotating.rotation.z = -degrees * Math.PI / 180;
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);
    renders++;
  }
  function stats() {
    return { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      width: canvas.width, height: canvas.height, angle: rotating.rotation.z,
      fixedCaliperAngle: fixedBrake.rotation.z, caliperSpokeClearance, materials: materials.size, clearAlpha: renderer.getClearAlpha(), renders };
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const geometry of geometries) geometry.dispose();
    for (const surface of materials) surface.dispose();
    for (const texture of textures) texture.dispose();
    grooves.dispose(); bolts.dispose(); recesses.dispose(); key.shadow.dispose();
    environment.dispose(); renderer.dispose();
  }
  return { resize, render, stats, dispose };
}
