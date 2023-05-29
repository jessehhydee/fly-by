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
flyingIn,
clouds,
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
  // scene.fog         = new THREE.Fog(0xf5e6d3, 70, 110);

  flyingIn  = true;
  camY      = 160,
  camZ      = -190;
  camera    = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 1, 300);
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

  setFog();
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

const setFog = () => {

  const _NOISE_GLSL = `
  //
  // Description : Array and textureless GLSL 2D/3D/4D simplex
  //               noise functions.
  //      Author : Ian McEwan, Ashima Arts.
  //  Maintainer : stegu
  //     Lastmod : 20201014 (stegu)
  //     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
  //               Distributed under the MIT License. See LICENSE file.
  //               https://github.com/ashima/webgl-noise
  //               https://github.com/stegu/webgl-noise
  //

  vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  vec4 permute(vec4 x) {
      return mod289(((x*34.0)+1.0)*x);
  }

  vec4 taylorInvSqrt(vec4 r)
  {
    return 1.79284291400159 - 0.85373472095314 * r;
  }

  float snoise(vec3 v)
  {
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 =   v - i + dot(i, C.xxx) ;

  // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    //   x0 = x0 - 0.0 + 0.0 * C.xxx;
    //   x1 = x0 - i1  + 1.0 * C.xxx;
    //   x2 = x0 - i2  + 2.0 * C.xxx;
    //   x3 = x0 - 1.0 + 3.0 * C.xxx;
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
    vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

  // Permutations
    i = mod289(i);
    vec4 p = permute( permute( permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  // Gradients: 7x7 points over a square, mapped onto an octahedron.
  // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
    float n_ = 0.142857142857; // 1.0/7.0
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
    //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

  //Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

  // Mix final noise value
    vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 105.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                  dot(p2,x2), dot(p3,x3) ) );
  }

  float FBM(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 0.0;
    for (int i = 0; i < 6; ++i) {
      value += amplitude * snoise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }
  `;

  THREE.ShaderChunk.fog_fragment = `
  #ifdef USE_FOG
    vec3 fogOrigin = cameraPosition;
    vec3 fogDirection = normalize(vWorldPosition - fogOrigin);
    float fogDepth = distance(vWorldPosition, fogOrigin);

    // f(p) = fbm( p + fbm( p ) )
    vec3 noiseSampleCoord = vWorldPosition * 0.00025 + vec3(
        0.0, 0.0, fogTime * 0.025);
    float noiseSample = FBM(noiseSampleCoord + FBM(noiseSampleCoord)) * 0.5 + 0.5;
    fogDepth *= mix(noiseSample, 1.0, saturate((fogDepth - 5000.0) / 5000.0));
    fogDepth *= fogDepth;

    float heightFactor = 0.001;
    float fogFactor = heightFactor * exp(-fogOrigin.y * fogDensity) * (
        1.0 - exp(-fogDepth * fogDirection.y * fogDensity)) / fogDirection.y;
    fogFactor = saturate(fogFactor);

    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
  #endif`;
    
  THREE.ShaderChunk.fog_pars_fragment = _NOISE_GLSL + `
  #ifdef USE_FOG
    uniform float fogTime;
    uniform vec3 fogColor;
    varying vec3 vWorldPosition;
    #ifdef FOG_EXP2
      uniform float fogDensity;
    #else
      uniform float fogNear;
      uniform float fogFar;
    #endif
  #endif`;
    
  THREE.ShaderChunk.fog_vertex = `
  #ifdef USE_FOG
  vec4 worldPosition = projectionMatrix * modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
  #endif`;
    
  THREE.ShaderChunk.fog_pars_vertex = `
  #ifdef USE_FOG
    varying vec3 vWorldPosition;
  #endif`;

  scene.fog = new THREE.FogExp2(0xDFE9F3, 0.001);
  // scene.fog         = new THREE.Fog(0xf5e6d3, 70, 110);

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

  clouds                = []
  const amountOfClouds  = 10;

  const createClouds = async () => {
    
    const cloudModels     = [];
    const cloudModelPaths = [
      'img/clouds/cloud-one/scene.gltf',
      'img/clouds/cloud-two/scene.gltf'
    ];
  
    for(let i = 0; i < cloudModelPaths.length; i++)
      cloudModels[i] = await gltfLoader.loadAsync(cloudModelPaths[i]);

    return cloudModels;

  }

  const getRandom = (max, min) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  const cloudModels = await createClouds();

  for(let i = 0; i < Math.floor(amountOfClouds / 2) * 2; i++) {

    let cloud;

    if(i < Math.floor(amountOfClouds / 2)) { // cloud-one
      cloud = cloudModels[0].scene.clone();
      cloud.scale.set(5.5, 5.5, 5.5);
      cloud.rotation.y = cloud.rotation.z = -(Math.PI / 2);
    }
    else { // cloud-two
      cloud = cloudModels[1].scene.clone();
      cloud.scale.set(0.02, 0.02, 0.02);
      cloud.rotation.y = cloud.rotation.z = 0;
    }

    cloud.name = `cloud-${i}`
    cloud.position.set(
      getRandom(-15, 15),
      getRandom(camY - 90, camY - 110), 
      getRandom(camZ + 200, camZ + 320)
    );

    scene.add(cloud);
    clouds.push(cloud);

  }

  return;

}

const animateClouds = () => {

  for(let i = 0; i < clouds.length; i++)
    clouds[i].position.x = 
    clouds[i].position.x < 0 
      ? clouds[i].position.x - (clock.getElapsedTime() * 0.04) 
      : clouds[i].position.x + (clock.getElapsedTime() * 0.04);

}

const cleanUpClouds = () => {

  flyingIn = false;

  for(let i = 0; i < clouds.length; i++) {
    const cloud = scene.getObjectByProperty('name', `cloud-${i}`);
    cleanUp(cloud);
  }

  clouds = undefined;

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

  cleanUpTiles();

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

const cleanUpTiles = () => {

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
      for(let o = 0; o < tile.length; o++) cleanUp(tile[o]);

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
  else {
    if(flyingIn) cleanUpClouds(); // This statement is called once when the fly in animation is compelte
  }

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

const cleanUp = (obj) => {

  if(obj.geometry && obj.material) {
    obj.geometry.dispose();
    obj.material.dispose();
  }
  else {
    obj.traverse(el => {
      if(el.isMesh) {
        el.geometry.dispose();
        el.material.dispose();
      }
    });
  }

  scene.remove(obj);
  renderer.renderLists.dispose();

}

const render = () => {

  statsPanel.begin();
  determineMovement();
  calcCharPos();
  if(flyingIn) animateClouds();
  if(mixer) mixer.update(clock.getDelta());
  renderer.render(scene, camera);
  statsPanel.end();

  requestAnimationFrame(render.bind(this))

}

setScene();
