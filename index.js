import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils';
import SimplexNoise from 'https://cdn.skypack.dev/simplex-noise@3.0.0';

const container = document.querySelector('.container');
const canvas    = document.querySelector('.canvas');

let
sizes,
scene,
camera,
renderer,
controls,
centerTile,
simplex,
maxHeight,
snowhexagons,
lightSnowhexagons,
rockhexagons,
foresthexagons,
lightForesthexagons,
grasshexagons,
sandhexagons,
shallowWaterhexagons,
waterhexagons,
deepWaterhexagons,
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
textures;

const setScene = async () => {

  sizes = {
    width:  container.offsetWidth,
    height: container.offsetHeight
  };

  scene = new THREE.Scene();

  camera             = new THREE.PerspectiveCamera(30, sizes.width / sizes.height, 1, 1000);
  camera.position.set(0, 50, 60);
  
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
    xFrom:  -10,
    xTo:    10,
    yFrom:  -10,
    yTo:    10
  }
  simplex       = new SimplexNoise();
  maxHeight     = 10;
  snowhexagons          = new THREE.BoxGeometry(0, 0, 0);
  lightSnowhexagons     = new THREE.BoxGeometry(0, 0, 0);
  rockhexagons          = new THREE.BoxGeometry(0, 0, 0);
  foresthexagons        = new THREE.BoxGeometry(0, 0, 0);
  lightForesthexagons   = new THREE.BoxGeometry(0, 0, 0);
  grasshexagons         = new THREE.BoxGeometry(0, 0, 0);
  sandhexagons          = new THREE.BoxGeometry(0, 0, 0);
  shallowWaterhexagons  = new THREE.BoxGeometry(0, 0, 0);
  waterhexagons         = new THREE.BoxGeometry(0, 0, 0);
  deepWaterhexagons     = new THREE.BoxGeometry(0, 0, 0);
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
    snow:         0xE5E5E5,
    lightSnow:    0x73918F,
    rock:         0x2A2D10,
    forest:       0x224005,
    lightForest:  0x367308,
    grass:        0x98BF06,
    sand:         0xE3F272,
    shallowWater: 0x3EA9BF,
    water:        0x00738B,
    deepWater:    0x015373
  };

  setControls();
  createTile();
  resize();
  listenTo();
  render();

}

const setControls = () => {
  controls                 = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping   = true;
}

const createTile = () => {

  const tileToPosition = (tileX, tileY) => {
    return new THREE.Vector2((tileX + (tileY % 2) * 0.5) * 1.77, tileY * 1.535);
  }

  const geometry = (height, position) => {

    const hex  = new THREE.CylinderGeometry(1, 1, height, 6, 1, false);
    hex.translate(position.x, height * 0.5, position.y);
  
    return hex;

  }

  const setHex = (height, position) => {

    const hex = geometry(height, position);

    if(height > snowHeight)               snowhexagons = mergeGeometries([hex, snowhexagons]);
    else if(height > lightSnowHeight)     lightSnowhexagons = mergeGeometries([hex, lightSnowhexagons]);
    else if(height > rockHeight)          rockhexagons = mergeGeometries([hex, rockhexagons]);
    else if(height > forestHeight)        foresthexagons = mergeGeometries([hex, foresthexagons]);
    else if(height > lightForestHeight)   lightForesthexagons = mergeGeometries([hex, lightForesthexagons]);
    else if(height > grassHeight)         grasshexagons = mergeGeometries([hex, grasshexagons]);
    else if(height > sandHeight)          sandhexagons = mergeGeometries([hex, sandhexagons]);
    else if(height > shallowWaterHeight)  shallowWaterhexagons = mergeGeometries([hex, shallowWaterhexagons]);
    else if(height > waterHeight)         waterhexagons = mergeGeometries([hex, waterhexagons]);
    else if(height > deepWaterHeight)     deepWaterhexagons = mergeGeometries([hex, deepWaterhexagons]);

  }

  const setHexMesh = (geo, color) => {

    const mat   = new THREE.MeshStandardMaterial({color: color});
    const mesh  = new THREE.Mesh(geo, mat);

    mesh.castShadow     = true;
    mesh.receiveShadow  = true;
  
    return mesh;

  }

  for(let i = centerTile.xFrom; i <= centerTile.xTo; i++)
    for(let j = centerTile.yFrom; j <= centerTile.yTo; j++) {

      const position = tileToPosition(i, j);
      
      let noise = (simplex.noise2D(i * 0.04, j * 0.04) + 1) * 0.5;
      noise = Math.pow(noise, 1.5);

      setHex(noise * maxHeight, position);

    } 

  const snowMesh          = setHexMesh(snowhexagons, textures.snow);
  const lightSnowMesh     = setHexMesh(lightSnowhexagons, textures.lightSnow);
  const rockMesh          = setHexMesh(rockhexagons, textures.rock);
  const forestMesh        = setHexMesh(foresthexagons, textures.forest);
  const lightForestMesh   = setHexMesh(lightForesthexagons, textures.lightForest);
  const grassMesh         = setHexMesh(grasshexagons, textures.grass);
  const sandMesh          = setHexMesh(sandhexagons, textures.sand);
  const shallowWaterMesh  = setHexMesh(shallowWaterhexagons, textures.shallowWater);
  const waterMesh         = setHexMesh(waterhexagons, textures.water);
  const deepWaterMesh     = setHexMesh(deepWaterhexagons, textures.deepWater);
  scene.add(snowMesh, lightSnowMesh, rockMesh, forestMesh, lightForestMesh, 
    grassMesh, sandMesh, shallowWaterMesh, waterMesh, deepWaterMesh);

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
 
  if (event.keyCode == '38') {
    centerTile.yFrom -= 21;
    centerTile.yTo -= 21;
  }
  else if (event.keyCode == '40') {
    centerTile.yFrom += 21;
    centerTile.yTo += 21;
  }
  else if (event.keyCode == '37') {
    centerTile.xFrom -= 21;
    centerTile.xTo -= 21;
  }
  else if (event.keyCode == '39') {
    centerTile.xFrom += 21;
    centerTile.xTo += 21;
  }

  createTile();
  
}

const listenTo = () => {
  window.addEventListener('resize', resize.bind(this));
  window.addEventListener('keydown', keyDown.bind(this));
}

const render = () => {

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render.bind(this))

}

setScene();