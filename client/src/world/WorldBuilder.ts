import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MAP_OBJECTS, COLLISION_OBSTACLES, LADDERS, ARENA_RADIUS } from '@shared/constants/mapLayout';
import { MapObjectDefinition, BoundingBox } from '@shared/types/game';
import { ProceduralProps } from './ProceduralProps';

interface ObstacleBinding {
  holder: THREE.Group;
  def: MapObjectDefinition;
  proceduralMesh: THREE.Group | null;
}

export class WorldBuilder {
  public scene: THREE.Scene;
  public mapGroup: THREE.Group;
  public obstacles: BoundingBox[] = [...COLLISION_OBSTACLES];
  private dirLight!: THREE.DirectionalLight;
  private gltfLoader: GLTFLoader = new GLTFLoader();
  private obstacleBindings: Map<string, ObstacleBinding> = new Map();
  private loadedGlbCache: Map<string, THREE.Group> = new Map();
  private sharedColormapTexture: THREE.Texture | null = null;
  private skyDome: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);

    this.setupPastelSkyDome();
    this.setupLighting();
    this.buildMap();
    this.loadReal3DAssets();
  }

  /**
   * Builds a dreamy pastel sky dome with soft gradients
   */
  private setupPastelSkyDome(): void {
    const skyGeo = new THREE.SphereGeometry(180, 48, 32);
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // 1. Soft pastel sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0.0, '#A0C4FF');   // Soft sky blue zenith
    grad.addColorStop(0.2, '#BDB2FF');   // Lavender
    grad.addColorStop(0.45, '#FFC6FF');  // Pink mist
    grad.addColorStop(0.65, '#FFD6A5');  // Peach horizon
    grad.addColorStop(0.82, '#FFFACD');  // Lemon cream
    grad.addColorStop(0.95, '#E8F5E8');  // Soft mint ground
    grad.addColorStop(1.0, '#C8E6C9');   // Light green base
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2048, 1024);

    // 2. Warm soft sun with gentle glow
    const sunX = 700;
    const sunY = 350;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, 250);
    sunGrad.addColorStop(0.0, '#FFFFFF');
    sunGrad.addColorStop(0.1, '#FFF8E1');
    sunGrad.addColorStop(0.3, 'rgba(255, 245, 200, 0.6)');
    sunGrad.addColorStop(0.6, 'rgba(255, 220, 180, 0.2)');
    sunGrad.addColorStop(1.0, 'rgba(255, 220, 180, 0.0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 250, 0, Math.PI * 2);
    ctx.fill();

    // 3. Gentle rolling hills at horizon
    ctx.fillStyle = '#B8D8B8';
    ctx.beginPath();
    ctx.moveTo(0, 920);
    for (let x = 0; x <= 2048; x += 24) {
      const h = 895 + Math.sin(x * 0.008) * 25 + Math.cos(x * 0.018) * 12;
      ctx.lineTo(x, h);
    }
    ctx.lineTo(2048, 1024);
    ctx.lineTo(0, 1024);
    ctx.closePath();
    ctx.fill();

    // 4. Soft white fluffy clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let i = 0; i < 20; i++) {
      const cx = (i * 120 + 50) % 2048;
      const cy = 280 + (i % 6) * 55;
      const rw = 140 + (i % 5) * 50;
      const rh = 22 + (i % 4) * 10;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const skyTex = new THREE.CanvasTexture(canvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;

    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      depthWrite: false
    });

    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.skyDome.position.y = -15;
    this.scene.add(this.skyDome);
  }

  private setupLighting(): void {
    // Light pastel fog for depth
    this.scene.fog = new THREE.Fog(0xE8E0F0, 80, 180);
    this.scene.background = null;

    // Hemisphere Light - bright and warm
    const hemiLight = new THREE.HemisphereLight(0xCCDDFF, 0xE8D5B0, 1.2);
    this.scene.add(hemiLight);

    // Directional Sun Light - bright and warm
    this.dirLight = new THREE.DirectionalLight(0xFFF8E1, 1.8);
    this.dirLight.position.set(30, 55, 20);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 160;

    const d = 55;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0003;

    this.scene.add(this.dirLight);

    // Bright ambient fill for pastel feel
    const ambientLight = new THREE.AmbientLight(0xF0E6FF, 0.6);
    this.scene.add(ambientLight);

    // Secondary fill light from opposite side to reduce harsh shadows
    const fillLight = new THREE.DirectionalLight(0xE0D0FF, 0.5);
    fillLight.position.set(-20, 30, -15);
    this.scene.add(fillLight);
  }

  private buildMap(): void {
    // 1. Create circular arena floor
    const floor = ProceduralProps.createCircularFloor(ARENA_RADIUS);
    this.mapGroup.add(floor);

    // 2. Create arena boundary wall (circular)
    const boundary = ProceduralProps.createArenaBoundary(ARENA_RADIUS);
    this.mapGroup.add(boundary);

    // 3. Instantiate all defined map objects
    for (const obj of MAP_OBJECTS) {
      let meshGroup: THREE.Group | null = null;
      const [w, h, d] = obj.scale;
      const color = obj.color;

      // tree_foliage_* is ONLY a collision volume - no visual mesh
      if (obj.id.startsWith('tree_foliage')) {
        meshGroup = null;
      } else {
        switch (obj.type) {
          case 'crate':
          case 'crate_stack':
            meshGroup = ProceduralProps.createCrate(w, h, d, color);
            break;
          case 'container':
            meshGroup = ProceduralProps.createContainer(w, h, d, color);
            break;
          case 'barrier':
            meshGroup = ProceduralProps.createBarrier(w, h, d, color);
            break;
          case 'wall':
            meshGroup = ProceduralProps.createWall(w, h, d, color);
            break;
          case 'tree':
            meshGroup = ProceduralProps.createTree(w, h, d);
            break;
          case 'rock':
            meshGroup = ProceduralProps.createRock(w, h, d, color);
            break;
          case 'bush':
            meshGroup = ProceduralProps.createBush(w, h, d, color);
            break;
          case 'building':
            meshGroup = ProceduralProps.createBuilding(w, h, d, color);
            break;
          case 'ramp':
            meshGroup = ProceduralProps.createRamp(w, h, d, color);
            break;
          case 'pillar':
            meshGroup = ProceduralProps.createPillar(w, h, d, color);
            break;
          case 'platform':
            meshGroup = ProceduralProps.createPlatform(w, h, d, color);
            break;
        }
      }

      const holder = new THREE.Group();
      if (meshGroup) {
        holder.add(meshGroup);
      }
      holder.position.set(obj.position[0], obj.position[1], obj.position[2]);
      holder.rotation.set(obj.rotation[0], obj.rotation[1], obj.rotation[2]);
      this.mapGroup.add(holder);

      this.obstacleBindings.set(obj.id, {
        holder,
        def: obj,
        proceduralMesh: meshGroup
      });
    }

    // 4. Spawn ladders
    for (const lad of LADDERS) {
      const ladderMesh = ProceduralProps.createLadder(lad.height);
      ladderMesh.position.set(lad.position[0], lad.position[1], lad.position[2]);
      ladderMesh.rotation.y = lad.rotationY;
      this.mapGroup.add(ladderMesh);
    }
  }

  /**
   * Loads authentic GLB 3D assets asynchronously and upgrades map obstacles
   */
  private loadReal3DAssets(): void {
    const textureLoader = new THREE.TextureLoader();
    this.gltfLoader.setResourcePath('/assets/models/');

    // Authentic colormap texture for all Kenney GLB models
    this.sharedColormapTexture = textureLoader.load('/assets/models/Textures/colormap.png');
    this.sharedColormapTexture.colorSpace = THREE.SRGBColorSpace;
    this.sharedColormapTexture.flipY = false;

    const assetsToLoad: { key: string; url: string }[] = [];

    for (const asset of assetsToLoad) {
      this.gltfLoader.load(
        asset.url,
        (gltf) => {
          gltf.scene.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh) {
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              const applyPbr = (mat: THREE.Material) => {
                const std = mat as THREE.MeshStandardMaterial;
                if (!std.map && this.sharedColormapTexture) {
                  std.map = this.sharedColormapTexture;
                } else if (std.map) {
                  std.map.colorSpace = THREE.SRGBColorSpace;
                  std.map.flipY = false;
                }
                std.color.setHex(0xffffff);
                std.roughness = 0.7;
                std.metalness = 0.15;
                std.needsUpdate = true;
              };

              if (Array.isArray(mesh.material)) {
                mesh.material.forEach(applyPbr);
              } else if (mesh.material) {
                applyPbr(mesh.material);
              }
            }
          });

          this.loadedGlbCache.set(asset.key, gltf.scene);
          this.upgradeObstaclesWithModel(asset.key, gltf.scene);
        },
        undefined,
        (err) => {
          console.warn(`[WorldBuilder] GLB fallback for ${asset.key}:`, err);
        }
      );
    }
  }

  private upgradeObstaclesWithModel(key: string, baseModel: THREE.Group): void {
    for (const binding of this.obstacleBindings.values()) {
      const def = binding.def;

      // tree_foliage_* must NEVER have visual meshes
      if (def.id.startsWith('tree_foliage')) {
        binding.holder.clear();
        continue;
      }

      let matches = false;

      // Use Kenney models for pillars (barrels), trees, and natural rocks
      // Crates and barriers use our high-detail procedural textured wood and military camouflage models
      if (key === 'barrel' && (def.type === 'pillar' || def.id.includes('barrel'))) {
        matches = true;
      } else if (key === 'tree' && def.type === 'tree' && def.id.startsWith('tree_trunk') && def.scale[1] <= 4.0) {
        matches = true;
      } else if (key === 'tree_tall' && def.type === 'tree' && def.id.startsWith('tree_trunk') && def.scale[1] > 4.0) {
        matches = true;
      } else if (key === 'rock_a' && def.type === 'rock' && !def.id.endsWith('_2') && !def.id.endsWith('_4')) {
        matches = true;
      } else if (key === 'rock_b' && def.type === 'rock' && (def.id.endsWith('_2') || def.id.endsWith('_4'))) {
        matches = true;
      }

      if (matches) {
        const clone = baseModel.clone(true);
        const [w, h, d] = def.scale;

        const bbox = new THREE.Box3().setFromObject(clone);
        const size = new THREE.Vector3();
        bbox.getSize(size);

        if (size.x > 0.001 && size.y > 0.001 && size.z > 0.001) {
          const targetH = def.type === 'tree' ? 4.8 : h;
          const targetW = def.type === 'tree' ? 3.2 : w;
          const targetD = def.type === 'tree' ? 3.2 : d;

          clone.scale.set(targetW / size.x, targetH / size.y, targetD / size.z);
          const adjBbox = new THREE.Box3().setFromObject(clone);
          const center = new THREE.Vector3();
          adjBbox.getCenter(center);
          clone.position.x -= center.x;
          clone.position.y -= center.y;
          clone.position.z -= center.z;
        }

        binding.holder.clear();
        binding.holder.add(clone);
      }
    }
  }

  /**
   * Calculates the walkable ground height under a given position,
   * accounting for the base floor (y=0) and all obstacle top surfaces.
   */
  public getGroundHeight(
    pos: THREE.Vector3,
    radius: number = 0.42
  ): number {
    let groundY = 0.0; // Base ground level
    const margin = radius * 0.2;

    for (const b of this.obstacles) {
      if (
        pos.x >= b.min[0] - margin &&
        pos.x <= b.max[0] + margin &&
        pos.z >= b.min[2] - margin &&
        pos.z <= b.max[2] + margin
      ) {
        if (b.max[1] <= pos.y + 0.35) {
          if (b.max[1] > groundY) {
            groundY = b.max[1];
          }
        }
      }
    }

    return groundY;
  }

  /**
   * Resolves player cylinder-box collisions against all map obstacles
   * AND the circular arena boundary
   */
  public resolveCollision(
    pos: THREE.Vector3,
    radius: number = 0.45,
    height: number = 1.65
  ): { x: number; y: number; z: number } {
    const result = pos.clone();

    // Circular boundary clamping
    const distFromCenter = Math.sqrt(result.x * result.x + result.z * result.z);
    const boundaryLimit = ARENA_RADIUS - radius - 0.5; // Wall thickness buffer
    if (distFromCenter > boundaryLimit) {
      const scale = boundaryLimit / distFromCenter;
      result.x *= scale;
      result.z *= scale;
    }

    const pMinY = result.y;
    const pMaxY = result.y + height;
    const stepTolerance = 0.25;

    for (const b of this.obstacles) {
      if (pMinY >= b.max[1] - stepTolerance) {
        continue;
      }

      if (pMaxY <= b.min[1] + 0.05) {
        continue;
      }

      const closestX = Math.max(b.min[0], Math.min(result.x, b.max[0]));
      const closestZ = Math.max(b.min[2], Math.min(result.z, b.max[2]));

      const dx = result.x - closestX;
      const dz = result.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        if (dist === 0) {
          const left = result.x - b.min[0];
          const right = b.max[0] - result.x;
          const front = result.z - b.min[2];
          const back = b.max[2] - result.z;
          const minOverlap = Math.min(left, right, front, back);

          if (minOverlap === left) result.x = b.min[0] - radius;
          else if (minOverlap === right) result.x = b.max[0] + radius;
          else if (minOverlap === front) result.z = b.min[2] - radius;
          else result.z = b.max[2] + radius;
        } else {
          const overlap = radius - dist;
          result.x += (dx / dist) * overlap;
          result.z += (dz / dist) * overlap;
        }
      }
    }

    return { x: result.x, y: result.y, z: result.z };
  }

  public setGraphicsQuality(quality: 'low' | 'medium' | 'high'): void {
    if (quality === 'low') {
      this.dirLight.castShadow = false;
      this.scene.fog = null;
    } else if (quality === 'medium') {
      this.dirLight.castShadow = true;
      this.dirLight.shadow.mapSize.width = 1024;
      this.dirLight.shadow.mapSize.height = 1024;
      this.scene.fog = new THREE.Fog(0xE8E0F0, 80, 180);
    } else {
      this.dirLight.castShadow = true;
      this.dirLight.shadow.mapSize.width = 2048;
      this.dirLight.shadow.mapSize.height = 2048;
      this.scene.fog = new THREE.Fog(0xE8E0F0, 80, 180);
    }
  }
}
