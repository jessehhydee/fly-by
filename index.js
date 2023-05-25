import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.5.23/+esm';
import SimplexNoise from 'https://cdn.skypack.dev/simplex-noise@3.0.0';
import * as stats from 'https://cdn.skypack.dev/three-stats';

const container = document.querySelector('.container');
const canvas    = document.querySelector('.canvas');

let
sizes,
scene,
camera,
camY,
camZ,
renderer,
clock,
raycaster,
distance,
movingCharDueToDistance,
movingCharTimeout,
currentPos,
currentLookAt,
thirdPerson,
character,
mixer,
charAnimation,
gliding,
charNeck,
charBody,
gltfLoader,
grassMeshes,
treeMeshes,
centerTile,
tileWidth,
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
activeKeysPressed,
statsPanel;

const setScene = async () => {

  sizes = {
    width:  container.offsetWidth,
    height: container.offsetHeight
  };

  scene             = new THREE.Scene();
  scene.background  = new THREE.Color(0xf5e6d3);
  scene.fog         = new THREE.Fog(0xf5e6d3, 70, 110);

  camY    = 90,
  camZ    = -110;
  camera  = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 1, 300);
  camera.position.set(0, camY, camZ);
  
  renderer = new THREE.WebGLRenderer({
    canvas:     canvas,
    antialias:  false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;
  clock = new THREE.Clock();

  scene.add(new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5));

  gltfLoader = new GLTFLoader();
  centerTile = {
    xFrom:  -30,
    xTo:    30,
    yFrom:  -30,
    yTo:    30
  };
  tileWidth             = 60; // diff between xFrom - xTo (not accounting for 0)
  amountOfHexInTile     = Math.pow((centerTile.xTo + 1) - centerTile.xFrom, 2); // +1 accounts for 0
  simplex               = new SimplexNoise();
  maxHeight             = 30;
  snowHeight            = maxHeight * 0.9;
  lightSnowHeight       = maxHeight * 0.8;
  rockHeight            = maxHeight * 0.7;
  forestHeight          = maxHeight * 0.45;
  lightForestHeight     = maxHeight * 0.32;
  grassHeight           = maxHeight * 0.22;
  sandHeight            = maxHeight * 0.15;
  shallowWaterHeight    = maxHeight * 0.1;
  waterHeight           = maxHeight * 0.05;
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
  terrainTiles      = [];
  activeKeysPressed = [];

  setRaycast();
  await setClouds();
  await setCharacter();
  await setGrass();
  await setTrees();
  setCam();
  createTile();
  createSurroundingTiles(`{"x":${centerTile.xFrom},"y":${centerTile.yFrom}}`);
  calcCharPos();
  resize();
  listenTo();
  showStats();
  render();

}

const setRaycast = () => {

  THREE.BufferGeometry.prototype.computeBoundsTree  = computeBoundsTree;
  THREE.BufferGeometry.prototype.disposeBoundsTree  = disposeBoundsTree;
  THREE.Mesh.prototype.raycast                      = acceleratedRaycast;

  raycaster = new THREE.Raycaster();
  distance  = 14;
  movingCharDueToDistance = false;
  raycaster.firstHitOnly = true;

}

const setClouds = async () => {

  const amountOfClouds = 9;

  const createClouds = async () => {
    
    const cloudMeshes     = {};
    const cloudMeshNames  = [
      {
        varName:    'cloudMeshOne',
        modelPath:  'img/clouds/cloud-one/scene.gltf',
        meshName:   'Icosphere001_0'
      },
      {
        varName:    'cloudMeshTwo',
        modelPath:  'img/clouds/cloud-two/scene.gltf',
        meshName:   'Icosphere002_Material006_0'
      },
    ];
  
    for(let i = 0; i < cloudMeshNames.length; i++) {
      const model  = await gltfLoader.loadAsync(cloudMeshNames[i].modelPath);
      const mesh  = model.scene.getObjectByName(cloudMeshNames[i].meshName);
      const geo   = mesh.geometry.clone();
      const mat   = mesh.material.clone();
      cloudMeshes[cloudMeshNames[i].varName] = new THREE.InstancedMesh(geo, mat, Math.floor(amountOfClouds / 2));
    }

    return cloudMeshes;

  }

  const getRandom = (max, min) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  const cloudMeshes       = await createClouds();
  const cloudManipulator  = new THREE.Object3D();
  let   cloudCounter      = 0;

  for(let i = 0; i < Math.floor(amountOfClouds / 2) * 2; i++) {

    cloudManipulator.position.set(
      getRandom(-50, 50), 
      getRandom(camY - 20, camY - 40), 
      getRandom(camZ + 20, camZ + 150)
    );

    if(i < Math.floor(amountOfClouds / 2)) {
      cloudManipulator.scale.set(3.5, 3.5, 3.5);
      cloudManipulator.rotation.y = cloudManipulator.rotation.z = -(Math.PI / 2);
      cloudManipulator.updateMatrix();
      cloudMeshes.cloudMeshOne.setMatrixAt(cloudCounter, cloudManipulator.matrix);
    }
    else {
      cloudManipulator.scale.set(0.02, 0.02, 0.02);
      cloudManipulator.rotation.y = cloudManipulator.rotation.z = 0;
      cloudManipulator.updateMatrix();
      cloudMeshes.cloudMeshTwo.setMatrixAt(cloudCounter, cloudManipulator.matrix);
    }

    if(cloudCounter === Math.floor(amountOfClouds / 2) - 1) cloudCounter = -1;
    cloudCounter++;

  }

  scene.add(cloudMeshes.cloudMeshOne, cloudMeshes.cloudMeshTwo);

  return;

}

const setCharAnimation = () => {

  const 
  min = 3,
  max = 14;

  const interval = () => {

    if(!gliding) 
      charAnimation
        .reset()
        .setEffectiveTimeScale(1)
        .setEffectiveWeight(1)
        .setLoop(THREE.LoopRepeat)
        .fadeIn(1)
        .play(); 
    else charAnimation.fadeOut(2);
    gliding = !gliding;

    const randomTime = Math.floor(Math.random() * (max - min + 1) + min);
    setTimeout(interval, randomTime * 1000);
  }

  interval();
  
}

const setCharacter = async () => {

  const model = await gltfLoader.loadAsync('img/bird/scene.gltf');
  const geo   = model.scene.getObjectByName('Cube001_0').geometry.clone();
  character   = model.scene;

  character.position.set(0, 25, 0);
  character.scale.set(1.3, 1.3, 1.3);

  mixer         = new THREE.AnimationMixer(character);
  charAnimation = mixer.clipAction(model.animations[0]);

  charNeck  = character.getObjectByName('Neck_Armature');
  charBody  = character.getObjectByName('Armature_rootJoint');

  geo.computeBoundsTree();
  scene.add(character);
  
  setCharAnimation();

  return;

}

const setGrass = async () => {

  grassMeshes           = {};
  const model           = await gltfLoader.loadAsync('img/grass/scene.gltf');
  const grassMeshNames  = [
    {
      varName:  'grassMeshOne',
      meshName: 'Circle015_Grass_0'
    },
    {
      varName:  'grassMeshTwo',
      meshName: 'Circle018_Grass_0'
    }
  ];

  for(let i = 0; i < grassMeshNames.length; i++) {
    const mesh  = model.scene.getObjectByName(grassMeshNames[i].meshName);
    const geo   = mesh.geometry.clone();
    const mat   = mesh.material.clone();
    grassMeshes[grassMeshNames[i].varName] = new THREE.InstancedMesh(geo, mat, Math.floor(amountOfHexInTile / 5));
  }

  return;

}

const setTrees = async () => {

  treeMeshes          = {};
  const treeMeshNames = [
    {
      varName:    'treeMeshOne',
      modelPath:  'img/trees/pine/scene.gltf',
      meshName:   'Object_4'
    },
    {
      varName:    'treeMeshTwo',
      modelPath:  'img/trees/twisted-branches/scene.gltf',
      meshName:   'Tree_winding_01_Material_0'
    }
  ];

  for(let i = 0; i < treeMeshNames.length; i++) {
    const model  = await gltfLoader.loadAsync(treeMeshNames[i].modelPath);
    const mesh  = model.scene.getObjectByName(treeMeshNames[i].meshName);
    const geo   = mesh.geometry.clone();
    const mat   = mesh.material.clone();
    treeMeshes[treeMeshNames[i].varName] = new THREE.InstancedMesh(geo, mat, Math.floor(amountOfHexInTile / 7));
  }

  return;

}

const setCam = () => {
  currentPos    = new THREE.Vector3();
  currentLookAt = new THREE.Vector3();
  thirdPerson   = true;
}

const createSurroundingTiles = (newActiveTile) => {

  const setCenterTile = (parsedCoords) => {
    centerTile = {
      xFrom:  parsedCoords.x,
      xTo:    parsedCoords.x + tileWidth,
      yFrom:  parsedCoords.y,
      yTo:    parsedCoords.y + tileWidth
    }
  }

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
  centerTile.yFrom -= tileWidth;
  centerTile.yTo -= tileWidth;
  createTile();
}
const tileYPositive = () => {
  centerTile.yFrom += tileWidth;
  centerTile.yTo += tileWidth;
  createTile();
}
const tileXNegative = () => {
  centerTile.xFrom -= tileWidth;
  centerTile.xTo -= tileWidth;
  createTile();
}
const tileXPositive = () => {
  centerTile.xFrom += tileWidth;
  centerTile.xTo += tileWidth;
  createTile();
}

const createTile = () => {

  const tileName = JSON.stringify({
    x: centerTile.xFrom,
    y: centerTile.yFrom
  });

  if(terrainTiles.some(el => el.name === tileName)) return; // Returns if tile already exists

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

  const hexManipulator      = new THREE.Object3D();
  const grassManipulator    = new THREE.Object3D();
  const treeOneManipulator  = new THREE.Object3D();
  const treeTwoManipulator  = new THREE.Object3D();

  const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false);
  const hex = setHexMesh(geo);
  hex.name  = tileName;
  geo.computeBoundsTree();

  const grassOne  = grassMeshes.grassMeshOne.clone();
  grassOne.name   = tileName;
  const grassTwo  = grassMeshes.grassMeshTwo.clone();
  grassTwo.name   = tileName;

  const treeOne = treeMeshes.treeMeshOne.clone();
  treeOne.name  = tileName;
  const treeTwo = treeMeshes.treeMeshTwo.clone();
  treeTwo.name  = tileName;

  terrainTiles.push({
    name:   tileName,
    hex:    hex,
    grass:  [
      grassOne.clone(),
      grassTwo.clone(),
    ],
    trees:  [
      treeOne.clone(),
      treeTwo.clone(),
    ]
  });
  
  let hexCounter      = 0;
  let grassOneCounter = 0;
  let grassTwoCounter = 0;
  let treeOneCounter  = 0;
  let treeTwoCounter  = 0;
  
  for(let i = centerTile.xFrom; i <= centerTile.xTo; i++) {
    for(let j = centerTile.yFrom; j <= centerTile.yTo; j++) {

      let noise1     = (simplex.noise2D(i * 0.015, j * 0.015) + 1.3) * 0.3;
      noise1         = Math.pow(noise1, 1.2);
      let noise2     = (simplex.noise2D(i * 0.015, j * 0.015) + 1) * 0.75;
      noise2         = Math.pow(noise2, 1.2);
      const height   = noise1 * noise2 * maxHeight;

      hexManipulator.scale.y = height >= sandHeight ? height : sandHeight;

      const pos = tileToPosition(i, height >= sandHeight ? height : sandHeight, j);
      hexManipulator.position.set(pos.x, pos.y, pos.z);

      hexManipulator.updateMatrix();
      hex.setMatrixAt(hexCounter, hexManipulator.matrix);

      if(height > snowHeight)               hex.setColorAt(hexCounter, textures.snow);
      else if(height > lightSnowHeight)     hex.setColorAt(hexCounter, textures.lightSnow);
      else if(height > rockHeight)          hex.setColorAt(hexCounter, textures.rock);
      else if(height > forestHeight) {

        hex.setColorAt(hexCounter, textures.forest);
        treeTwoManipulator.scale.set(1.1, 1.2, 1.1);
        treeTwoManipulator.rotation.y = Math.floor(Math.random() * 3);
        treeTwoManipulator.position.set(pos.x, (pos.y * 2) + 5, pos.z);
        treeTwoManipulator.updateMatrix();

        if((Math.floor(Math.random() * 15)) === 0) {
          treeTwo.setMatrixAt(treeTwoCounter, treeTwoManipulator.matrix);
          treeTwoCounter++;
        }

      }
      else if(height > lightForestHeight) {

        hex.setColorAt(hexCounter, textures.lightForest);

        treeOneManipulator.scale.set(0.4, 0.4, 0.4);
        treeOneManipulator.position.set(pos.x, (pos.y * 2), pos.z);
        treeOneManipulator.updateMatrix();

        if((Math.floor(Math.random() * 10)) === 0) {
          treeOne.setMatrixAt(treeOneCounter, treeOneManipulator.matrix);
          treeOneCounter++;
        }

      }
      else if(height > grassHeight) {

        hex.setColorAt(hexCounter, textures.grass);

        grassManipulator.scale.set(0.15, 0.15, 0.15);
        grassManipulator.rotation.x = -(Math.PI / 2);
        grassManipulator.position.set(pos.x, pos.y * 2, pos.z);
        grassManipulator.updateMatrix();

        if((Math.floor(Math.random() * 3)) === 0)
          switch (Math.floor(Math.random() * 2) + 1) {
            case 1:
              grassOne.setMatrixAt(grassOneCounter, grassManipulator.matrix);
              grassOneCounter++;
              break;
            case 2:
              grassTwo.setMatrixAt(grassTwoCounter, grassManipulator.matrix);
              grassTwoCounter++;
              break;
          }

      }
      else if(height > sandHeight)          hex.setColorAt(hexCounter, textures.sand);
      else if(height > shallowWaterHeight)  hex.setColorAt(hexCounter, textures.shallowWater);
      else if(height > waterHeight)         hex.setColorAt(hexCounter, textures.water);
      else if(height > deepWaterHeight)     hex.setColorAt(hexCounter, textures.deepWater);

      hexCounter++;

    }
  }

  scene.add(hex, grassOne, grassTwo, treeOne, treeTwo);

}

const cleanUp = () => {

  for(let i = terrainTiles.length - 1; i >= 0; i--) {

    let tileCoords  = JSON.parse(terrainTiles[i].hex.name);
    tileCoords      = {
      xFrom:  tileCoords.x,
      xTo:    tileCoords.x + tileWidth,
      yFrom:  tileCoords.y,
      yTo:    tileCoords.y + tileWidth
    }

    if(
      tileCoords.xFrom < centerTile.xFrom - tileWidth ||
      tileCoords.xTo > centerTile.xTo + tileWidth ||
      tileCoords.yFrom < centerTile.yFrom - tileWidth ||
      tileCoords.yTo > centerTile.yTo + tileWidth
    ) {

      const tile = scene.getObjectsByProperty('name', terrainTiles[i].hex.name);

      for(let o = 0; o < tile.length; o++) {
        tile[o].geometry.dispose();
        tile[o].material.dispose();
        scene.remove(tile[o]);
        renderer.renderLists.dispose();
      }

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

  if(event.keyCode === 81) {
    thirdPerson ? thirdPerson = false : thirdPerson = true;
    camUpdate();
  }

  if(!activeKeysPressed.includes(event.keyCode)) 
    activeKeysPressed.push(event.keyCode);
    
}

const keyUp = (event) => {
  const index = activeKeysPressed.indexOf(event.keyCode);
  activeKeysPressed.splice(index, 1);
}

const determineMovement = () => {

  character.translateZ(0.3);

  if(activeKeysPressed.includes(87)) { // w
    if(character.position.y < 60) {
      character.position.y += 0.3;
      if(charNeck.rotation.x > -0.6) charNeck.rotation.x -= 0.06;
      if(charBody.rotation.x > -0.4) charBody.rotation.x -= 0.04;
    }
  }
  if(activeKeysPressed.includes(83) && !movingCharDueToDistance) { // s
    if(character.position.y > 22) {
      character.position.y -= 0.3;
      if(charNeck.rotation.x < 0.6) charNeck.rotation.x += 0.06;
      if(charBody.rotation.x < 0.4) charBody.rotation.x += 0.04;
    }
  }

  if(activeKeysPressed.includes(65)) { // a
    character.rotateY(0.006);
    if(charNeck.rotation.y > -0.7) charNeck.rotation.y -= 0.07;
    if(charBody.rotation.y < 0.4) charBody.rotation.y += 0.04;
  }
  if(activeKeysPressed.includes(68)) { // d
    character.rotateY(-0.006);
    if(charNeck.rotation.y < 0.7) charNeck.rotation.y += 0.07;
    if(charBody.rotation.y > -0.4) charBody.rotation.y -= 0.04;
  }

  // Revert

  if(!activeKeysPressed.includes(87) && !activeKeysPressed.includes(83) ||
    activeKeysPressed.includes(87) && activeKeysPressed.includes(83)) {
    if(charNeck.rotation.x < 0 || charBody.rotation.x < 0) {
      charNeck.rotation.x += 0.06;
      charBody.rotation.x += 0.04;
    }
    if(charNeck.rotation.x > 0 || charBody.rotation.x > 0) {
      charNeck.rotation.x -= 0.06;
      charBody.rotation.x -= 0.04;
    }
  }

  if(!activeKeysPressed.includes(65) && !activeKeysPressed.includes(68) ||
    activeKeysPressed.includes(65) && activeKeysPressed.includes(68)) {
    if(charNeck.rotation.y < 0 || charBody.rotation.y > 0) {
      charNeck.rotation.y += 0.07;
      charBody.rotation.y -= 0.04;
    }
    if(charNeck.rotation.y > 0 || charBody.rotation.y < 0) {
      charNeck.rotation.y -= 0.07;
      charBody.rotation.y += 0.04;
    }
  }

}

const camUpdate = () => {

  const calcIdealOffset = () => {
    const idealOffset = thirdPerson ? new THREE.Vector3(-0.5, camY, camZ) : new THREE.Vector3(0, 3, 2);
    idealOffset.applyQuaternion(character.quaternion);
    idealOffset.add(character.position);
    return idealOffset;
  }
  
  const calcIdealLookat = () => {
    const idealLookat = thirdPerson ? new THREE.Vector3(0, -1.2, 15) : new THREE.Vector3(0, 0.5, 20);
    idealLookat.applyQuaternion(character.quaternion);
    idealLookat.add(character.position);
    return idealLookat;
  }

  const idealOffset = calcIdealOffset();
  const idealLookat = calcIdealLookat();

  currentPos.copy(idealOffset);
  currentLookAt.copy(idealLookat);

  camera.position.lerp(currentPos, 0.14);
  camera.lookAt(currentLookAt);

  if(camY > 7)    camY -= 0.5;
  if(camZ < -10)  camZ += 0.5;

}

const calcCharPos = () => {

  raycaster.set(character.position, new THREE.Vector3(0, -1, -0.1));

  var intersects = raycaster.intersectObjects(terrainTiles.map(el => el.hex));

  if(activeTile !== intersects[0].object.name) createSurroundingTiles(intersects[0].object.name);

  if (intersects[0].distance < distance) {
    movingCharDueToDistance = true;
    character.position.y += 0.1;
  }
  else {
    if(movingCharDueToDistance && !movingCharTimeout) {
      movingCharTimeout = setTimeout(() => {
        movingCharDueToDistance = false;
        movingCharTimeout = undefined;
      }, 600);
    }
  }

  camUpdate();
  
}

const listenTo = () => {
  window.addEventListener('resize', resize.bind(this));
  window.addEventListener('keydown', keyDown.bind(this));
  window.addEventListener('keyup', keyUp.bind(this));
}

const showStats = () => {
  statsPanel = new stats.Stats();
  statsPanel.showPanel(0);
  document.body.appendChild(statsPanel.dom);
}

const render = () => {

  statsPanel.begin();
  determineMovement();
  calcCharPos();
  if(mixer) mixer.update(clock.getDelta());
  renderer.render(scene, camera);
  statsPanel.end();

  requestAnimationFrame(render.bind(this))

}

setScene();
