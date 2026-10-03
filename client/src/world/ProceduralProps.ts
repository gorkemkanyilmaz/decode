import * as THREE from 'three';

export class ProceduralProps {
  // Shared reusable materials to minimize draw calls and shader switching
  private static materials: Map<string, THREE.Material> = new Map();

  private static getMaterial(color: string | number, roughness: number = 0.7, metalness: number = 0.1): THREE.MeshStandardMaterial {
    const key = `${color}_${roughness}_${metalness}`;
    if (!this.materials.has(key)) {
      this.materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          roughness,
          metalness,
          flatShading: true
        })
      );
    }
    return this.materials.get(key) as THREE.MeshStandardMaterial;
  }

  public static createFloor(size: number = 100): THREE.Group {
    const group = new THREE.Group();

    // Main ground plate
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    const mat = this.getMaterial('#1E293B', 0.85, 0.05);
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    group.add(ground);

    // Tactical arena grid overlay
    const grid = new THREE.GridHelper(size, 50, 0x00f0ff, 0x334155);
    grid.position.y = 0.02;
    (grid.material as THREE.Material).opacity = 0.35;
    (grid.material as THREE.Material).transparent = true;
    group.add(grid);

    // Center spy emblem ring
    const ringGeo = new THREE.RingGeometry(6, 6.4, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    group.add(ring);

    return group;
  }

  public static createCrate(w: number, h: number, d: number, colorHex: string = '#D97706'): THREE.Group {
    const group = new THREE.Group();

    // Main crate box
    const boxGeo = new THREE.BoxGeometry(w, h, d);
    const boxMat = this.getMaterial(colorHex, 0.75, 0.05);
    const mesh = new THREE.Mesh(boxGeo, boxMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Metal corner reinforcement brackets
    const frameGeo = new THREE.BoxGeometry(w * 1.01, h * 0.1, d * 1.01);
    const frameMat = this.getMaterial('#475569', 0.5, 0.6);
    const topFrame = new THREE.Mesh(frameGeo, frameMat);
    topFrame.position.y = h * 0.42;
    const botFrame = new THREE.Mesh(frameGeo, frameMat);
    botFrame.position.y = -h * 0.42;
    group.add(topFrame, botFrame);

    return group;
  }

  public static createContainer(w: number, h: number, d: number, colorHex: string = '#DC2626'): THREE.Group {
    const group = new THREE.Group();

    // Main container body
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = this.getMaterial(colorHex, 0.6, 0.2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Corner posts (dark metal)
    const postMat = this.getMaterial('#1E293B', 0.5, 0.5);
    const postW = 0.2;
    const postGeo = new THREE.BoxGeometry(postW, h * 1.01, postW);

    const hw = w / 2 - postW / 2;
    const hd = d / 2 - postW / 2;

    const p1 = new THREE.Mesh(postGeo, postMat);
    p1.position.set(hw, 0, hd);
    const p2 = new THREE.Mesh(postGeo, postMat);
    p2.position.set(-hw, 0, hd);
    const p3 = new THREE.Mesh(postGeo, postMat);
    p3.position.set(hw, 0, -hd);
    const p4 = new THREE.Mesh(postGeo, postMat);
    p4.position.set(-hw, 0, -hd);
    group.add(p1, p2, p3, p4);

    return group;
  }

  public static createBarrier(w: number, h: number, d: number, colorHex: string = '#94A3B8'): THREE.Group {
    const group = new THREE.Group();

    // Concrete barrier with slight taper at top
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = this.getMaterial(colorHex, 0.9, 0.0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Hazard stripes band along the top
    const stripeGeo = new THREE.BoxGeometry(w * 1.005, h * 0.15, d * 1.005);
    const stripeMat = this.getMaterial('#F59E0B', 0.7, 0.1);
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = h * 0.35;
    group.add(stripe);

    return group;
  }

  public static createWall(w: number, h: number, d: number, colorHex: string = '#334155'): THREE.Group {
    const group = new THREE.Group();

    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = this.getMaterial(colorHex, 0.8, 0.1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // High-tech glowing neon trim along top rim
    const rimGeo = new THREE.BoxGeometry(w, 0.1, d * 1.05);
    const rimMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.y = h / 2 + 0.05;
    group.add(rim);

    return group;
  }

  public static createTree(w: number, h: number, d: number): THREE.Group {
    const group = new THREE.Group();

    // Stylized low-poly trunk
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, h * 0.6, 6);
    const trunkMat = this.getMaterial('#78350F', 0.9, 0.0);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = -h * 0.2;
    trunk.castShadow = true;
    group.add(trunk);

    // Stylized tiered low-poly foliage (two stacked cones)
    const fMat1 = this.getMaterial('#15803D', 0.8, 0.0);
    const fMat2 = this.getMaterial('#16A34A', 0.8, 0.0);

    const f1Geo = new THREE.ConeGeometry(w * 0.8, h * 0.5, 7);
    const f1 = new THREE.Mesh(f1Geo, fMat1);
    f1.position.y = h * 0.1;
    f1.castShadow = true;

    const f2Geo = new THREE.ConeGeometry(w * 0.6, h * 0.45, 6);
    const f2 = new THREE.Mesh(f2Geo, fMat2);
    f2.position.y = h * 0.35;
    f2.castShadow = true;

    group.add(f1, f2);
    return group;
  }

  public static createRock(w: number, h: number, d: number): THREE.Group {
    const group = new THREE.Group();

    // Faceted stylized rock
    const geo = new THREE.DodecahedronGeometry(w * 0.5, 1);
    geo.scale(1, h / w, d / w);
    const mat = this.getMaterial('#57534E', 0.95, 0.05);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    return group;
  }

  public static createBush(w: number, h: number, d: number): THREE.Group {
    const group = new THREE.Group();

    const geo = new THREE.SphereGeometry(w * 0.5, 5, 4);
    geo.scale(1, h / w, d / w);
    const mat = this.getMaterial('#16A34A', 0.85, 0.0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    group.add(mesh);

    return group;
  }

  public static createBuilding(w: number, h: number, d: number, colorHex: string = '#1E293B'): THREE.Group {
    const group = new THREE.Group();

    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = this.getMaterial(colorHex, 0.65, 0.25);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Accent glass viewing visor
    const visorGeo = new THREE.BoxGeometry(w * 0.8, h * 0.2, d * 1.02);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.2
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.y = h * 0.25;
    group.add(visor);

    return group;
  }

  public static createRamp(w: number, h: number, d: number, colorHex: string = '#475569'): THREE.Group {
    const group = new THREE.Group();

    // Wedge ramp geometry
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2, -h / 2);
    shape.lineTo(d / 2, -h / 2);
    shape.lineTo(d / 2, h / 2);
    shape.closePath();

    const extrudeSettings = { depth: w, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center();
    const mat = this.getMaterial(colorHex, 0.8, 0.1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.y = Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    return group;
  }

  public static createPillar(w: number, h: number, d: number, colorHex: string = '#64748B'): THREE.Group {
    const group = new THREE.Group();

    const radius = Math.min(w, d) / 2;
    const geo = new THREE.CylinderGeometry(radius, radius, h, 8);
    const mat = this.getMaterial(colorHex, 0.7, 0.2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    return group;
  }
}
