// import * as THREE from 'three';

onmessage = async (event) => {
  console.log('INN AA');
  const tile = await createTile(JSON.parse(event.data));
  postMessage(tile);
};

const createTile = async (data) => {

  console.log('INN');

  const tileName = JSON.stringify({
    x: data.centerTile.xFrom,
    y: data.centerTile.yFrom
  });

  if(data.terrainTiles.some(el => el.name === tileName)) return; // Returns if tile already exists

  const tileToPosition = (tileX, height, tileY) => {
    return {
      x:  (tileX + (tileY % 2) * 0.5) * 1.68, 
      y:  height / 2, 
      z:  tileY * 1.535
    };
  }

  const hexManipulator    = data.threeObj3D;
  const grassManipulator  = data.threeObj3D;

  const hex         = data.hexMesh;
  hex.name          = tileName;
  const grassOne    = data.grassMeshOne;
  grassOne.name     = tileName;
  const grassTwo    = data.grassMeshTewo;
  grassTwo.name     = tileName;
  data.terrainTiles.push({
    name:   tileName,
    hex:    hex,
    grass:  [
      grassOne,
      grassTwo,
    ]
  });
  
  let hexCounter      = 0;
  let grassOneCounter = 0;
  let grassTwoCounter = 0;
  for(let i = data.centerTile.xFrom; i <= data.centerTile.xTo; i++) {
    for(let j = data.centerTile.yFrom; j <= data.centerTile.yTo; j++) {

      let noise     = (data.simplex.noise2D(i * 0.02, j * 0.02) + 1) * 0.5;
      noise         = Math.pow(noise, 1.9);
      const height  = noise * data.maxHeight;

      hexManipulator.scale.y = height >= data.sandHeight ? height : data.sandHeight;

      const pos = tileToPosition(i, height >= data.sandHeight ? height : data.sandHeight, j);
      hexManipulator.position.set(pos.x, pos.y, pos.z);

      hexManipulator.updateMatrix();
      hex.setMatrixAt(hexCounter, hexManipulator.matrix);

      if(height > data.snowHeight)               hex.setColorAt(hexCounter, data.textures.snow);
      else if(height > data.lightSnowHeight)     hex.setColorAt(hexCounter, data.textures.lightSnow);
      else if(height > data.rockHeight)          hex.setColorAt(hexCounter, data.textures.rock);
      else if(height > data.forestHeight)        hex.setColorAt(hexCounter, data.textures.forest);
      else if(height > data.lightForestHeight)   hex.setColorAt(hexCounter, data.textures.lightForest);
      else if(height > data.grassHeight)         {
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
      else if(height > data.sandHeight)          hex.setColorAt(hexCounter, data.textures.sand);
      else if(height > data.shallowWaterHeight)  hex.setColorAt(hexCounter, data.textures.shallowWater);
      else if(height > data.waterHeight)         hex.setColorAt(hexCounter, data.textures.water);
      else if(height > data.deepWaterHeight)     hex.setColorAt(hexCounter, data.textures.deepWater);

      hexCounter++;

    }
  }

  return {
    hex:          hex, 
    grassOne:     grassOne,
    grassTwo:     grassTwo,
    terrainTiles: data.terrainTiles
  };

}