import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  initialScale: number;
}

interface SmokeCloud {
  id: string;
  group: THREE.Group;
  startTime: number;
  duration: number;
  radius: number;
  materials: THREE.MeshStandardMaterial[];
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private smokeClouds: Map<string, SmokeCloud> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public spawnEliminationEffect(pos: [number, number, number]): void {
    const count = 30;
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const colors = [0x00f0ff, 0xffd700, 0xffffff];

    for (let i = 0; i < count; i++) {
      const col = colors[Math.floor(Math.random() * colors.length)];
      const mat = new THREE.MeshBasicMaterial({ color: col, wireframe: Math.random() > 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos[0], pos[1] + 1.2, pos[2]);

      const speed = 3 + Math.random() * 5;
      const angle = Math.random() * Math.PI * 2;
      const vY = 2 + Math.random() * 4;

      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        vY,
        Math.sin(angle) * speed
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity,
        life: 0,
        maxLife: 1.2,
        initialScale: 1.0
      });
    }
  }

  public spawnSmoke(id: string, pos: [number, number, number], durationSec: number, radius: number = 6.0): void {
    // If existing smoke with same id exists, remove it first
    if (this.smokeClouds.has(id)) {
      const existing = this.smokeClouds.get(id)!;
      this.scene.remove(existing.group);
      this.smokeClouds.delete(id);
    }

    const group = new THREE.Group();
    // Anchor smoke cloud reliably on the arena ground
    const groundY = Math.max(0.15, pos[1]);
    group.position.set(pos[0], groundY, pos[2]);

    // 1. Tactical Smoke Grenade Canister on ground
    const canGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.35, 12);
    const canMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
    const canister = new THREE.Mesh(canGeo, canMat);
    canister.position.set(0, 0.17, 0);
    canister.rotation.z = Math.PI / 4;
    group.add(canister);

    // 2. High-volume Counter-Strike style smoke puffs
    const puffMaterials: THREE.MeshStandardMaterial[] = [];
    const colors = [0x94a3b8, 0x64748b, 0xcbd5e1, 0x475569];

    // Generate 22 overlapping volumetric puff spheres
    const puffCount = 22;
    for (let i = 0; i < puffCount; i++) {
      const puffRadius = 1.3 + Math.random() * 1.5;
      const puffGeo = new THREE.DodecahedronGeometry(puffRadius, 1);
      const color = colors[i % colors.length];

      const mat = new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 0.85,
        roughness: 1.0,
        metalness: 0.0,
        depthWrite: false // Prevents sorting artifacts and z-fighting
      });
      puffMaterials.push(mat);

      const puff = new THREE.Mesh(puffGeo, mat);

      // Distribute puffs radially and vertically up to 3.2m
      const angle = (i / puffCount) * Math.PI * 2 + Math.random() * 0.4;
      const dist = (0.2 + Math.random() * 0.75) * (radius * 0.7);
      const puffY = 0.8 + Math.random() * 2.2;

      puff.position.set(
        Math.cos(angle) * dist,
        puffY,
        Math.sin(angle) * dist
      );
      puff.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

      group.add(puff);
    }

    // Start with small scale to animate billowing bloom
    group.scale.set(0.25, 0.25, 0.25);
    this.scene.add(group);

    const smokeCloud: SmokeCloud = {
      id,
      group,
      startTime: Date.now(),
      duration: durationSec,
      radius,
      materials: puffMaterials
    };

    this.smokeClouds.set(id, smokeCloud);

    setTimeout(() => {
      this.scene.remove(group);
      this.smokeClouds.delete(id);
    }, durationSec * 1000);
  }

  public spawnFlashEffect(pos: [number, number, number], radius: number = 20.0): void {
    const burstY = Math.max(1.0, pos[1] + 0.8);

    // 1. High-intensity momentary light burst
    const flashLight = new THREE.PointLight(0xffffff, 40, radius, 1.2);
    flashLight.position.set(pos[0], burstY, pos[2]);
    this.scene.add(flashLight);

    // 2. Bright blinding center expansion sphere
    const sphereGeo = new THREE.SphereGeometry(1.6, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.98,
      depthWrite: false
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    sphereMesh.position.set(pos[0], burstY, pos[2]);
    this.scene.add(sphereMesh);

    // 3. High-velocity white/cyan sparks
    const count = 50;
    const sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.3);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xf0fdf4 });

    for (let i = 0; i < count; i++) {
      const spark = new THREE.Mesh(sparkGeo, sparkMat);
      spark.position.set(pos[0], burstY, pos[2]);

      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      const speed = 15 + Math.random() * 16;

      const velocity = new THREE.Vector3(
        Math.cos(theta) * Math.cos(phi) * speed,
        Math.sin(phi) * speed + 3.5,
        Math.sin(theta) * Math.cos(phi) * speed
      );
      spark.lookAt(spark.position.clone().add(velocity));

      this.scene.add(spark);
      this.particles.push({
        mesh: spark,
        velocity,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.3,
        initialScale: 1.0
      });
    }

    // Fade and remove light and sphere
    let elapsed = 0;
    const fadeTimer = setInterval(() => {
      elapsed += 0.04;
      flashLight.intensity = Math.max(0, 40 * (1 - elapsed / 0.5));
      sphereMesh.scale.addScalar(0.45);
      sphereMat.opacity = Math.max(0, 0.98 * (1 - elapsed / 0.4));

      if (elapsed >= 0.5) {
        clearInterval(fadeTimer);
        this.scene.remove(flashLight);
        this.scene.remove(sphereMesh);
        sphereGeo.dispose();
        sphereMat.dispose();
      }
    }, 40);
  }

  public update(delta: number): void {
    // Update bursting particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += delta;

      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }

      p.velocity.y -= 9.8 * delta; // Gravity
      p.mesh.position.addScaledVector(p.velocity, delta);
      p.mesh.rotation.x += delta * 5;
      p.mesh.rotation.y += delta * 5;

      const progress = p.life / p.maxLife;
      const scale = p.initialScale * (1 - progress);
      p.mesh.scale.set(scale, scale, scale);
    }

    // Animate active volumetric smoke clouds
    const now = Date.now();
    for (const [id, cloud] of this.smokeClouds.entries()) {
      const ageSec = (now - cloud.startTime) / 1000;
      const remainingSec = cloud.duration - ageSec;

      if (remainingSec <= 0) {
        this.scene.remove(cloud.group);
        this.smokeClouds.delete(id);
        continue;
      }

      // 1. Billowing growth phase in first 1.2 seconds
      if (ageSec < 1.2) {
        const growth = Math.min(1.0, 0.25 + 0.75 * (ageSec / 1.2));
        cloud.group.scale.set(growth, growth, growth);
      } else {
        cloud.group.scale.set(1.0, 1.0, 1.0);
      }

      // 2. Slow swirling vortex drift
      cloud.group.rotation.y += delta * 0.15;

      // 3. Gradual dissipation fadeout in the last 2.5 seconds
      if (remainingSec < 2.5) {
        const fadeRatio = Math.max(0, remainingSec / 2.5);
        for (const mat of cloud.materials) {
          mat.opacity = 0.85 * fadeRatio;
        }
      }
    }
  }
}
