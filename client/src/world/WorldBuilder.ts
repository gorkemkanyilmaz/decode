import * as THREE from 'three';
import { MAP_OBJECTS, COLLISION_OBSTACLES } from '@shared/constants/mapLayout';
import { MapObjectDefinition, BoundingBox } from '@shared/types/game';
import { ProceduralProps } from './ProceduralProps';

export class WorldBuilder {
  public scene: THREE.Scene;
  public mapGroup: THREE.Group;
  public obstacles: BoundingBox[] = [...COLLISION_OBSTACLES];
  private dirLight!: THREE.DirectionalLight;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);

    this.setupLighting();
    this.buildMap();
  }

  private setupLighting(): void {
    // Atmospheric spy fog
    this.scene.fog = new THREE.FogExp2(0x0f172a, 0.015);
    this.scene.background = new THREE.Color(0x0f172a);

    // Hemisphere Light (sky blue top, warm earth bounce)
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.6);
    this.scene.add(hemiLight);

    // Directional Sun Light
    this.dirLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
    this.dirLight.position.set(40, 60, 30);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 150;

    const d = 60;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;

    this.scene.add(this.dirLight);

    // Ambient fill
    const ambientLight = new THREE.AmbientLight(0x38bdf8, 0.25);
    this.scene.add(ambientLight);
  }

  private buildMap(): void {
    // 1. Add Floor
    const floor = ProceduralProps.createFloor(100);
    this.mapGroup.add(floor);

    // 2. Instantiate all defined map objects
    for (const obj of MAP_OBJECTS) {
      let meshGroup: THREE.Group | null = null;
      const [w, h, d] = obj.scale;
      const color = obj.color;

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
          meshGroup = ProceduralProps.createRock(w, h, d);
          break;
        case 'bush':
          meshGroup = ProceduralProps.createBush(w, h, d);
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
      }

      if (meshGroup) {
        meshGroup.position.set(obj.position[0], obj.position[1], obj.position[2]);
        meshGroup.rotation.set(obj.rotation[0], obj.rotation[1], obj.rotation[2]);
        this.mapGroup.add(meshGroup);
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
      // Check horizontal footprint overlap
      if (
        pos.x >= b.min[0] - margin &&
        pos.x <= b.max[0] + margin &&
        pos.z >= b.min[2] - margin &&
        pos.z <= b.max[2] + margin
      ) {
        // Surface is eligible as ground if at or below feet (with 0.35m landing tolerance)
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
   */
  public resolveCollision(
    pos: THREE.Vector3,
    radius: number = 0.45,
    height: number = 1.65
  ): { x: number; y: number; z: number } {
    const result = pos.clone();

    // Map boundary clamping (-48 to +48)
    const mapLimit = 48.0;
    result.x = Math.max(-mapLimit, Math.min(mapLimit, result.x));
    result.z = Math.max(-mapLimit, Math.min(mapLimit, result.z));

    const pMinY = result.y;
    const pMaxY = result.y + height;
    const stepTolerance = 0.25;

    for (const b of this.obstacles) {
      // 1. If player's feet are on or above the obstacle's top surface,
      // it is a walkable floor, NOT a vertical lateral wall!
      if (pMinY >= b.max[1] - stepTolerance) {
        continue;
      }

      // 2. If player's head is below the underside of this obstacle (e.g. overhead beam/canopy)
      if (pMaxY <= b.min[1] + 0.05) {
        continue;
      }

      // 3. Otherwise, obstacle overlaps vertically with player body: resolve cylinder vs AABB
      const closestX = Math.max(b.min[0], Math.min(result.x, b.max[0]));
      const closestZ = Math.max(b.min[2], Math.min(result.z, b.max[2]));

      const dx = result.x - closestX;
      const dz = result.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        if (dist === 0) {
          // Inside box: push out along shortest axis
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
          // Push away along normal
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
      this.scene.fog = new THREE.FogExp2(0x0f172a, 0.015);
    } else {
      this.dirLight.castShadow = true;
      this.dirLight.shadow.mapSize.width = 2048;
      this.dirLight.shadow.mapSize.height = 2048;
      this.scene.fog = new THREE.FogExp2(0x0f172a, 0.015);
    }
  }
}
