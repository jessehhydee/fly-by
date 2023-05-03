import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.5.23/+esm'
import SimplexNoise from 'https://cdn.skypack.dev/simplex-noise@3.0.0';
import * as stats from 'https://cdn.skypack.dev/three-stats'

const container = document.querySelector('.container');
const canvas    = document.querySelector('.canvas');

let
sizes,
scene,
camera,
renderer,
controls,
raycaster,
distance,
currentPos,
currentLookAt,
capsule,
centerTile,
amountOfHexInTile,
simplex,
maxHeight,
snowHeight,
lightSnowHeight,
rockHeight,
forestHeight,
lightForestHeight,
grassHeight,
sandHeight,
shallowWaterHeight,
waterHeight,
deepWaterHeight,
textures,
terrainTiles,
activeTile,
statsPanel;

const setScene = async () => {

  sizes = {
    width:  container.offsetWidth,
    height: container.offsetHeight
  };

  scene             = new THREE.Scene();
  scene.background  = new THREE.Color(0xcccccc);
  scene.fog         = new THREE.Fog(0xcccccc, 80, 170);

  camera  = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 1, 1000);
  camera.position.set(0, 40, 40);
  
  renderer = new THREE.WebGLRenderer({
    canvas:     canvas,
    antialias:  false,
    alpha:      true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5));
  const pointLight = new THREE.PointLight(new THREE.Color("#FFCB8E").convertSRGBToLinear().convertSRGBToLinear(), 10, 120);
  pointLight.position.set(10, 50, 70);
  pointLight.castShadow = true;
  scene.add(pointLight);

  centerTile = {
    xFrom:  -40,
    xTo:    40,
    yFrom:  -40,
    yTo:    40
  };
  amountOfHexInTile     = Math.pow((centerTile.xTo + 1) - centerTile.xFrom, 2); // +1 accounts for 0
  simplex               = new SimplexNoise();
  maxHeight             = 10;
  snowHeight            = maxHeight * 0.9;
  lightSnowHeight       = maxHeight * 0.8;
  rockHeight            = maxHeight * 0.7;
  forestHeight          = maxHeight * 0.6;
  lightForestHeight     = maxHeight * 0.5;
  grassHeight           = maxHeight * 0.4;
  sandHeight            = maxHeight * 0.3;
  shallowWaterHeight    = maxHeight * 0.2;
  waterHeight           = maxHeight * 0.1;
  deepWaterHeight       = maxHeight * 0;
  textures              = {
    snow:         new THREE.Color(0xE5E5E5),
    lightSnow:    new THREE.Color(0x73918F),
    rock:         new THREE.Color(0x2A2D10),
    forest:       new THREE.Color(0x224005),
    lightForest:  new THREE.Color(0x367308),
    grass:        new THREE.Color(0x98BF06),
    sand:         new THREE.Color(0xE3F272),
    shallowWater: new THREE.Color(0x3EA9BF),
    water:        new THREE.Color(0x00738B),
    deepWater:    new THREE.Color(0x015373)
  };
  terrainTiles = [];

  // setControls();
  setRaycast();
  setThirdPersonCam();
  setSphere();
  createTile();
  createSurroundingTiles('{"x":-40,"y":-40}');
  calcCamHeight();
  resize();
  listenTo();
  showStats();
  render();

}

const setControls = () => {
  controls                 = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping   = true;
}

const setRaycast = () => {

  THREE.BufferGeometry.prototype.computeBoundsTree  = computeBoundsTree;
  THREE.BufferGeometry.prototype.disposeBoundsTree  = disposeBoundsTree;
  THREE.Mesh.prototype.raycast                      = acceleratedRaycast;

  raycaster = new THREE.Raycaster();
  distance  = 4
  raycaster.firstHitOnly = true;

}

const setThirdPersonCam = () => {
  currentPos    = new THREE.Vector3();
  currentLookAt = new THREE.Vector3();
}

const setSphere = () => {

  const geo = new THREE.CapsuleGeometry(1, 1, 4, 14); 
  const mat = new THREE.MeshBasicMaterial({color: 0x000000}); 
  capsule   = new THREE.Mesh(geo, mat); 

  capsule.position.set(0, 10, 0);
  geo.computeBoundsTree();
  scene.add(capsule);

}

const createSurroundingTiles = (newActiveTile) => {

  const setCenterTile = (parsedCoords) => {
    centerTile = {
      xFrom:  parsedCoords.x,
      xTo:    parsedCoords.x + 81,
      yFrom:  parsedCoords.y,
      yTo:    parsedCoords.y + 81
    }
  }

  console.log('NEW TILE');
  const parsedCoords = JSON.parse(newActiveTile);

  setCenterTile(parsedCoords);

  tileYNegative();

  tileXPositive();

  tileYPositive();
  tileYPositive();

  tileXNegative();
  tileXNegative();

  tileYNegative();
  tileYNegative();

  setCenterTile(parsedCoords);

  cleanUp();

  activeTile = newActiveTile;

}

const tileYNegative = () => {
  centerTile.yFrom -= 81;
  centerTile.yTo -= 81;
  createTile();
}
const tileYPositive = () => {
  centerTile.yFrom += 81;
  centerTile.yTo += 81;
  createTile();
}
const tileXNegative = () => {
  centerTile.xFrom -= 81;
  centerTile.xTo -= 81;
  createTile();
}
const tileXPositive = () => {
  centerTile.xFrom += 81;
  centerTile.xTo += 81;
  createTile();
}

const createTile = () => {

  if(
    terrainTiles.some(el => el.name === JSON.stringify({
      x: centerTile.xFrom,
      y: centerTile.yFrom
    }))
  ) return; // Returns if tile already exists

  const tileToPosition = (tileX, height, tileY) => {
    return new THREE.Vector3((tileX + (tileY % 2) * 0.5) * 1.68, height / 2, tileY * 1.535);
  }

  const setHexMesh = (geo) => {

    const mat   = new THREE.MeshStandardMaterial();
    const mesh  = new THREE.InstancedMesh(geo, mat, amountOfHexInTile);

    mesh.castShadow     = true;
    mesh.receiveShadow  = true;
  
    return mesh;

  }

  const manipulator = new THREE.Object3D();
  const geo         = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false);
  const mesh        = setHexMesh(geo);
  mesh.name         = JSON.stringify({
    x: centerTile.xFrom,
    y: centerTile.yFrom
  });
  geo.computeBoundsTree();
  terrainTiles.push(mesh);
  
  let counter = 0;
  for(let i = centerTile.xFrom; i <= centerTile.xTo; i++) {
    for(let j = centerTile.yFrom; j <= centerTile.yTo; j++) {

      let noise     = (simplex.noise2D(i * 0.04, j * 0.04) + 1) * 0.5;
      noise         = Math.pow(noise, 1.5);
      const height  = noise * maxHeight;

      manipulator.scale.y = height;

      const pos = tileToPosition(i, height, j);
      manipulator.position.set(pos.x, pos.y, pos.z);

      manipulator.updateMatrix();
      mesh.setMatrixAt(counter, manipulator.matrix);

      if(height > snowHeight)               mesh.setColorAt(counter, textures.snow);
      else if(height > lightSnowHeight)     mesh.setColorAt(counter, textures.lightSnow);
      else if(height > rockHeight)          mesh.setColorAt(counter, textures.rock);
      else if(height > forestHeight)        mesh.setColorAt(counter, textures.forest);
      else if(height > lightForestHeight)   mesh.setColorAt(counter, textures.lightForest);
      else if(height > grassHeight)         mesh.setColorAt(counter, textures.grass);
      else if(height > sandHeight)          mesh.setColorAt(counter, textures.sand);
      else if(height > shallowWaterHeight)  mesh.setColorAt(counter, textures.shallowWater);
      else if(height > waterHeight)         mesh.setColorAt(counter, textures.water);
      else if(height > deepWaterHeight)     mesh.setColorAt(counter, textures.deepWater);

      counter++;

    }
  }

  scene.add(mesh);

}

const cleanUp = () => {

  for(let i = terrainTiles.length - 1; i >= 0; i--) {

    let tileCoords  = JSON.parse(terrainTiles[i].name);
    tileCoords      = {
      xFrom:  tileCoords.x,
      xTo:    tileCoords.x + 81,
      yFrom:  tileCoords.y,
      yTo:    tileCoords.y + 81
    }

    if(
      tileCoords.xFrom < centerTile.xFrom - 81 ||
      tileCoords.xTo > centerTile.xTo + 81 ||
      tileCoords.yFrom < centerTile.yFrom - 81 ||
      tileCoords.yTo > centerTile.yTo + 81
    ) {
      const tile = scene.getObjectByProperty('name', terrainTiles[i].name);
      tile.geometry.dispose();
      tile.material.dispose();
      scene.remove(tile);
      renderer.renderLists.dispose();
      terrainTiles.splice(i, 1);
    }

  }

}

const resize = () => {

  sizes = {
    width:  container.offsetWidth,
    height: container.offsetHeight
  };

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);

}

const keyDown = (event) => {
 
  if (event.keyCode == '38') tileYNegative(); // up arrow
  else if (event.keyCode == '40') tileYPositive(); // down arrow
  else if (event.keyCode == '37') tileXNegative(); // left arrow
  else if (event.keyCode == '39') tileXPositive(); // right arrow

  if (event.keyCode == '87') { // w
    capsule.position.z -= 1;
    calcCamHeight(true);
  }
  else if (event.keyCode == '83') { // s
    capsule.position.z += 1;
    calcCamHeight(false);
  }
  else if (event.keyCode == '65') { // a
    capsule.position.x -= 1;
    calcCamHeight();
  }
  else if (event.keyCode == '68') { // d
    capsule.position.x += 1;
    calcCamHeight();
  }
  
}

const calcCamHeight = (movingForward = true) => {

  // https://stackoverflow.com/questions/17443056/threejs-keep-object-on-surface-of-another-object
  raycaster.set(capsule.position, new THREE.Vector3(0, -1, movingForward ? -0.3 : 0.3));

  var intersects = raycaster.intersectObjects(terrainTiles);

  if(activeTile !== intersects[0].object.name) createSurroundingTiles(intersects[0].object.name);

  if (distance > intersects[0].distance) capsule.position.y += (distance - intersects[0].distance) - 1;
  else capsule.position.y -= intersects[0].distance - distance;
  
}

const listenTo = () => {
  window.addEventListener('resize', resize.bind(this));
  window.addEventListener('keydown', keyDown.bind(this));
}

const showStats = () => {
  statsPanel = new stats.Stats();
  statsPanel.showPanel(0);
  document.body.appendChild(statsPanel.dom);
}

const thirdPersonCamUpdate = () => {

  const calcIdealOffset = () => {
    const idealOffset = new THREE.Vector3(3, 14, 30);
    idealOffset.add(capsule.position)
    return idealOffset;
  }
  
  const calcIdealLookat = () => {
    const idealLookat = new THREE.Vector3(0, -5, -25);
    idealLookat.add(capsule.position)
    return idealLookat;
  }

  const idealOffset = calcIdealOffset();
  const idealLookat = calcIdealLookat();

  const factor = 0.09;
  currentPos.lerp(idealOffset, factor);
  currentLookAt.lerp(idealLookat, factor);

  camera.position.copy(currentPos);
  camera.lookAt(currentLookAt);

}

const render = () => {

  statsPanel.begin();
  // controls.update();
  thirdPersonCamUpdate();
  renderer.render(scene, camera);
  statsPanel.end();

  requestAnimationFrame(render.bind(this))

}

setScene();