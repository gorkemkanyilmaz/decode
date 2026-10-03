import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  initialScale: number;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private smokeClouds: Map<string, THREE.Group> = new Map();

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

  public spawnSmoke(id: string, pos: [number, number, number], durationSec: number, radius: number): void {
    const group = new THREE.Group();
    group.position.set(pos[0], pos[1] + 1.5, pos[2]);

    const sphereGeo = new THREE.DodecahedronGeometry(radius * 0.45, 1);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.75,
      roughness: 1.0
    });

    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(sphereGeo, sphereMat);
      mesh.position.set(
        (Math.random() - 0.5) * radius * 0.8,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * radius * 0.8
      );
      group.add(mesh);
    }

    this.scene.add(group);
    this.smokeClouds.set(id, group);

    setTimeout(() => {
      this.scene.remove(group);
      this.smokeClouds.delete(id);
    }, durationSec * 1000);
  }

  public spawnFlashEffect(pos: [number, number, number], radius: number = 16.0): void {
    // 1. High-intensity momentary light burst
    const flashLight = new THREE.PointLight(0xffffff, 25, radius, 1.5);
    flashLight.position.set(pos[0], pos[1] + 1.2, pos[2]);
    this.scene.add(flashLight);

    // 2. Bright blinding center sphere
    const sphereGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    sphereMesh.position.set(pos[0], pos[1] + 1.2, pos[2]);
    this.scene.add(sphereMesh);

    // 3. High-velocity white/cyan sparks
    const count = 45;
    const sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.25);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });

    for (let i = 0; i < count; i++) {
      const spark = new THREE.Mesh(sparkGeo, sparkMat);
      spark.position.set(pos[0], pos[1] + 1.2, pos[2]);

      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      const speed = 12 + Math.random() * 14;

      const velocity = new THREE.Vector3(
        Math.cos(theta) * Math.cos(phi) * speed,
        Math.sin(phi) * speed + 3,
        Math.sin(theta) * Math.cos(phi) * speed
      );
      spark.lookAt(spark.position.clone().add(velocity));

      this.scene.add(spark);
      this.particles.push({
        mesh: spark,
        velocity,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.3,
        initialScale: 1.0
      });
    }

    // Fade and remove light and sphere
    let elapsed = 0;
    const fadeTimer = setInterval(() => {
      elapsed += 0.04;
      flashLight.intensity = Math.max(0, 25 * (1 - elapsed / 0.45));
      sphereMesh.scale.addScalar(0.4);
      sphereMat.opacity = Math.max(0, 0.95 * (1 - elapsed / 0.35));

      if (elapsed >= 0.45) {
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

    // Animate active smoke clouds
    for (const group of this.smokeClouds.values()) {
      group.rotation.y += delta * 0.2;
    }
  }
}
