const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'cleanroom-lod.js'), 'utf8');

class SphereGeometry {
  constructor(radius, widthSegments, heightSegments, phiStart = 0, phiLength = Math.PI * 2, thetaStart = 0, thetaLength = Math.PI) {
    this.type = 'SphereGeometry';
    this.parameters = { radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength };
    const count = widthSegments * heightSegments;
    const array = new Float32Array(count * 3);
    for (let i = 0; i < array.length; i++) array[i] = i / array.length;
    this.attributes = { position: { array, count } };
    this.groups = [];
    this.morphAttributes = {};
    this.index = null;
  }
  dispose() {}
}

function createSceneObject(children = []) {
  return {
    children,
    traverse(callback) {
      callback(this);
      this.children.forEach(child => child.traverse ? child.traverse(callback) : callback(child));
    }
  };
}

test('machine LOD swaps eligible geometry by distance and preserves interactive or modified geometry', () => {
  const scene = createSceneObject();
  const group = createSceneObject();
  const geometry = new SphereGeometry(1, 24, 16);
  const hull = { isMesh: true, geometry, position: { y: 1 }, userData: {}, children: [], visible: true };
  const interactiveGeometry = new SphereGeometry(1, 24, 16);
  const interactive = {
    isMesh: true,
    geometry: interactiveGeometry,
    position: { y: 1 },
    userData: { interactive: true },
    children: []
  };
  const modifiedGeometry = new SphereGeometry(1, 24, 16);
  modifiedGeometry.attributes.position.array[0] += 1;
  const modified = { isMesh: true, geometry: modifiedGeometry, position: { y: 1 }, userData: {}, children: [] };
  group.children.push(hull, interactive, modified);
  scene.children.push(group);

  const sandbox = {
    THREE: { SphereGeometry },
    scene,
    machines: [{ kind: 'fabrication', index: 0, group, world: { x: 0, z: 0 }, modelHull: hull }],
    player: { position: { x: 0, z: 0 } },
    status: [],
    designWorld: { active: false },
    performance: { now: () => 1000 },
    Math, Array, Object, Set, Map, WeakMap, Number
  };
  vm.runInNewContext(source, sandbox);
  sandbox.CleanroomLOD.init();

  sandbox.player.position.x = 15;
  sandbox.CleanroomLOD.update(1100);
  assert.equal(hull.geometry.parameters.widthSegments, 12, 'mid LOD should use a lower-segment sphere');

  sandbox.player.position.x = 30;
  sandbox.CleanroomLOD.update(1200);
  assert.equal(hull.geometry.parameters.widthSegments, 6, 'far LOD should use the coarsest sphere');
  assert.equal(hull.visible, true, 'the hull silhouette should remain visible');
  assert.equal(interactive.geometry, interactiveGeometry, 'interactive geometry must not be replaced');
  assert.equal(modified.geometry, modifiedGeometry, 'geometry with baked/custom vertex edits must not be replaced');

  sandbox.player.position.x = 0;
  sandbox.CleanroomLOD.update(1300);
  assert.equal(hull.geometry, geometry, 'near LOD should restore the original geometry');
});
