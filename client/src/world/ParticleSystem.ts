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
