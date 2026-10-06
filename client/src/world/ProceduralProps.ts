import * as THREE from 'three';

export class ProceduralProps {
  // Shared reusable materials to minimize draw calls and shader switching
  private static materials: Map<string, THREE.Material> = new Map();
  private static floorTexture: THREE.CanvasTexture | null = null;
  private static woodTexture: THREE.CanvasTexture | null = null;
  private static camoTexture: THREE.CanvasTexture | null = null;
  private static bunkerTexture: THREE.CanvasTexture | null = null;

  private static getMaterial(color: string | number, roughness: number = 0.7, metalness: number = 0.1): THREE.MeshStandardMaterial {
    const key = `${color}_${roughness}_${metalness}`;
    if (!this.materials.has(key)) {
      this.materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          roughness,
          metalness
        })
      );
    }
    return this.materials.get(key) as THREE.MeshStandardMaterial;
  }

  private static getTexturedMaterial(
    texture: THREE.CanvasTexture,
    colorHex: string | number = 0xffffff,
    roughness: number = 0.65,
    metalness: number = 0.1
  ): THREE.MeshStandardMaterial {
    const key = `tex_${texture.id}_${colorHex}_${roughness}_${metalness}`;
    if (!this.materials.has(key)) {
      this.materials.set(
        key,
        new THREE.MeshStandardMaterial({
          map: texture,
          color: new THREE.Color(colorHex),
          roughness,
          metalness
        })
      );
    }
    return this.materials.get(key) as THREE.MeshStandardMaterial;
  }

  /**
   * Generates authentic pastel wood plank texture for crates and wood covers
   */
  public static getPastelWoodTexture(): THREE.CanvasTexture {
    if (this.woodTexture) return this.woodTexture;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // 1. Base warm pastel wood tone
    ctx.fillStyle = '#EBDCCB';
    ctx.fillRect(0, 0, size, size);

    // 2. Horizontal planks (4 planks)
    const plankH = size / 4;
    const plankTones = ['#F5E8DC', '#EADCCE', '#E4D3C2', '#DFCDBE'];

    for (let i = 0; i < 4; i++) {
      const y = i * plankH;
      ctx.fillStyle = plankTones[i];
      ctx.fillRect(0, y, size, plankH);

      // Fine wood grain waves across the plank
      ctx.strokeStyle = 'rgba(165, 135, 110, 0.24)';
      ctx.lineWidth = 1.2;
      for (let g = 0; g < 6; g++) {
        const gy = y + 14 + g * 18;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        for (let x = 0; x <= size; x += 16) {
          const wave = Math.sin((x + i * 80) * 0.02) * 4 + Math.sin(x * 0.05) * 2;
          ctx.lineTo(x, gy + wave);
        }
        ctx.stroke();
      }

      // Subtle wood knots on alternating planks
      if (i === 1 || i === 3) {
        const knotX = i === 1 ? 140 : 360;
        const knotY = y + plankH / 2;
        ctx.strokeStyle = 'rgba(150, 115, 90, 0.35)';
        ctx.lineWidth = 1.5;
        for (let r = 5; r <= 18; r += 6) {
          ctx.beginPath();
          ctx.ellipse(knotX, knotY, r * 1.5, r, 0.15, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Plank separator groove (dark bottom, light top highlight)
      ctx.fillStyle = 'rgba(110, 80, 60, 0.45)';
      ctx.fillRect(0, y + plankH - 2, size, 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(0, y, size, 1.5);

      // Fastener nail heads near ends and center
      const nailPositions = [24, 256, size - 24];
      for (const nx of nailPositions) {
        ctx.fillStyle = 'rgba(100, 80, 100, 0.6)';
        ctx.beginPath();
        ctx.arc(nx, y + plankH / 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(nx - 0.7, y + plankH / 2 - 0.7, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.woodTexture = tex;
    return tex;
  }

  /**
   * Generates light pastel military camouflage texture for barriers and tactical cover
   */
  public static getPastelCamoTexture(): THREE.CanvasTexture {
    if (this.camoTexture) return this.camoTexture;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // 1. Base: Soft pastel desert sand
    ctx.fillStyle = '#EBE3D5';
    ctx.fillRect(0, 0, size, size);

    // 2. Splotch layer 1: Pastel sage / mint green
    ctx.fillStyle = '#B6D3B6';
    const sageBlobs = [
      [80, 80, 70], [220, 120, 90], [380, 60, 80],
      [140, 260, 100], [320, 240, 85], [460, 300, 75],
      [60, 420, 80], [240, 400, 95], [420, 440, 85]
    ];
    for (const [bx, by, br] of sageBlobs) {
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.arc(bx + 40, by - 20, br * 0.7, 0, Math.PI * 2);
      ctx.arc(bx - 30, by + 30, br * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Splotch layer 2: Pastel khaki / light olive tan
    ctx.fillStyle = '#CAC0A2';
    const khakiBlobs = [
      [150, 60, 65], [300, 140, 75], [450, 160, 70],
      [60, 200, 70], [220, 280, 80], [390, 340, 90],
      [140, 440, 75], [310, 470, 70], [480, 60, 65]
    ];
    for (const [bx, by, br] of khakiBlobs) {
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.arc(bx - 25, by + 25, br * 0.6, 0, Math.PI * 2);
      ctx.arc(bx + 35, by + 15, br * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Splotch layer 3: Pastel lavender / stone grey
    ctx.fillStyle = '#C8BCD4';
    const lavenderBlobs = [
      [220, 40, 50], [400, 180, 60], [100, 140, 55],
      [280, 200, 60], [450, 250, 55], [180, 360, 65],
      [360, 420, 55], [60, 340, 50], [480, 420, 60]
    ];
    for (const [bx, by, br] of lavenderBlobs) {
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.arc(bx + 20, by - 15, br * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Tactical accent stipples (small dark olive accents)
    ctx.fillStyle = '#7E987E';
    const flecks = [
      [120, 90], [260, 130], [370, 90], [170, 230],
      [330, 270], [440, 320], [90, 390], [270, 370], [410, 460]
    ];
    for (const [fx, fy] of flecks) {
      ctx.beginPath();
      ctx.ellipse(fx, fy, 14, 8, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Subtle matte canvas stipple overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let x = 0; x < size; x += 8) {
      for (let y = 0; y < size; y += 8) {
        if ((x + y) % 16 === 0) {
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.camoTexture = tex;
    return tex;
  }

  /**
   * Generates reinforced modular ballistic panel texture for bunkers
   */
  public static getPastelBunkerTexture(): THREE.CanvasTexture {
    if (this.bunkerTexture) return this.bunkerTexture;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // 1. Base ballistic composite in pastel lilac
    ctx.fillStyle = '#DFD6E7';
    ctx.fillRect(0, 0, size, size);

    // 2. Central camouflage accent band across middle
    ctx.fillStyle = '#C4D8C4';
    ctx.fillRect(0, 160, size, 180);
    ctx.fillStyle = '#D6CCB2';
    ctx.beginPath();
    ctx.arc(100, 240, 60, 0, Math.PI * 2);
    ctx.arc(320, 260, 75, 0, Math.PI * 2);
    ctx.arc(460, 220, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#C2B5D2';
    ctx.beginPath();
    ctx.arc(200, 220, 55, 0, Math.PI * 2);
    ctx.arc(400, 270, 50, 0, Math.PI * 2);
    ctx.fill();

    // 3. Panel seams (horizontal & vertical grooves)
    ctx.strokeStyle = 'rgba(110, 95, 125, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(6, 6, size - 12, size - 12);
    ctx.beginPath();
    ctx.moveTo(0, 160);
    ctx.lineTo(size, 160);
    ctx.moveTo(0, 340);
    ctx.lineTo(size, 340);
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.stroke();

    // 4. Panel rivets/bolts along seams
    ctx.fillStyle = '#837194';
    const boltPoints = [
      [24, 24], [size / 2 - 20, 24], [size / 2 + 20, 24], [size - 24, 24],
      [24, 150], [size / 2 - 20, 150], [size / 2 + 20, 150], [size - 24, 150],
      [24, 350], [size / 2 - 20, 350], [size / 2 + 20, 350], [size - 24, 350],
      [24, size - 24], [size / 2 - 20, size - 24], [size / 2 + 20, size - 24], [size - 24, size - 24]
    ];
    for (const [bx, by] of boltPoints) {
      ctx.beginPath();
      ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.arc(bx - 0.8, by - 0.8, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#837194';
    }



    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.bunkerTexture = tex;
    return tex;
  }

  /**
   * Generates a bright pastel arena floor texture with concentric rings
   */
  private static getFloorTexture(radius: number): THREE.CanvasTexture {
    if (this.floorTexture) return this.floorTexture;

    const size = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const cx = size / 2;
    const cy = size / 2;

    // 1. Base - warm cream/light floor
    ctx.fillStyle = '#F5F0E8';
    ctx.fillRect(0, 0, size, size);

    // 2. Subtle radial gradient for depth
    const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
    radGrad.addColorStop(0.0, 'rgba(232, 213, 245, 0.25)');  // Center lavender tint
    radGrad.addColorStop(0.5, 'rgba(255, 245, 230, 0.1)');
    radGrad.addColorStop(1.0, 'rgba(200, 215, 230, 0.2)');   // Edge cool tint
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, size, size);

    // 3. Concentric ring markings
    const ringColors = ['#E8D5F5', '#D5E5F5', '#F5D5E5', '#D5F5E8'];
    const ringRadii = [0.15, 0.35, 0.55, 0.75, 0.95];

    ctx.lineWidth = 3;
    for (let i = 0; i < ringRadii.length; i++) {
      const r = ringRadii[i] * cx;
      ctx.strokeStyle = ringColors[i % ringColors.length];
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // 4. Tile grid pattern
    const tileSize = size / 20;
    ctx.strokeStyle = 'rgba(180, 170, 160, 0.2)';
    ctx.lineWidth = 1;
    for (let x = 0; x < size; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    for (let y = 0; y < size; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }

    // 5. Center arena marker
    ctx.strokeStyle = '#D4A0E0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 65, 0, Math.PI * 2);
    ctx.stroke();

    // Center crosshair
    ctx.strokeStyle = '#C4B0E0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 80, cy);
    ctx.lineTo(cx - 50, cy);
    ctx.moveTo(cx + 50, cy);
    ctx.lineTo(cx + 80, cy);
    ctx.moveTo(cx, cy - 80);
    ctx.lineTo(cx, cy - 50);
    ctx.moveTo(cx, cy + 50);
    ctx.lineTo(cx, cy + 80);
    ctx.stroke();

    // 6. Fine grain noise for texture
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 8;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    this.floorTexture = new THREE.CanvasTexture(canvas);
    this.floorTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.floorTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.floorTexture.colorSpace = THREE.SRGBColorSpace;
    return this.floorTexture;
  }

  /**
   * Creates a circular arena floor
   */
  public static createCircularFloor(radius: number): THREE.Group {
    const group = new THREE.Group();

    const geo = new THREE.CircleGeometry(radius, 64);
    const mat = new THREE.MeshStandardMaterial({
      map: this.getFloorTexture(radius),
      roughness: 0.75,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    group.add(ground);

    return group;
  }

  /**
   * Creates the circular arena boundary wall
   */
  public static createArenaBoundary(radius: number): THREE.Group {
    const group = new THREE.Group();

    const wallHeight = 4.5;
    const wallThickness = 0.6;

    // Outer wall ring
    const wallGeo = new THREE.CylinderGeometry(
      radius + wallThickness / 2,
      radius + wallThickness / 2,
      wallHeight,
      64,
      1,
      true
    );
    const wallMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#E0D5F0'),
      roughness: 0.6,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = wallHeight / 2;
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);

    // Inner decorative ring at base
    const baseGeo = new THREE.TorusGeometry(radius, 0.3, 8, 64);
    const baseMat = this.getMaterial('#C4B5E3', 0.5, 0.3);
    const baseRing = new THREE.Mesh(baseGeo, baseMat);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.3;
    group.add(baseRing);

    // Top cap ring
    const topGeo = new THREE.TorusGeometry(radius, 0.25, 8, 64);
    const topMat = this.getMaterial('#D4C0F0', 0.4, 0.4);
    const topRing = new THREE.Mesh(topGeo, topMat);
    topRing.rotation.x = Math.PI / 2;
    topRing.position.y = wallHeight;
    group.add(topRing);

    return group;
  }

  /**
   * Platform with textured pastel wood surface and metal protective trim
   */
  public static createPlatform(w: number, h: number, d: number, colorHex: string = '#E8D5F5'): THREE.Group {
    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(w, h, d);
    const woodTex = this.getPastelWoodTexture();
    const mat = this.getTexturedMaterial(woodTex, '#FFF8F0', 0.65, 0.05);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Border accent
    const edgeGeo = new THREE.BoxGeometry(w + 0.1, h * 0.35, d + 0.1);
    const edgeMat = this.getMaterial('#C8BAD8', 0.45, 0.35);
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.position.y = h * 0.35;
    group.add(edge);

    return group;
  }

  /**
   * Authentic wooden tactical supply crate with real wood plank texture,
   * cross bracing, and metal corner reinforcement brackets.
   */
  public static createCrate(w: number, h: number, d: number, colorHex: string = '#FFB5BA'): THREE.Group {
    const group = new THREE.Group();

    // 1. Main crate box with pastel wood plank texture
    const boxGeo = new THREE.BoxGeometry(w, h, d);
    const woodTex = this.getPastelWoodTexture();
    const boxMat = this.getTexturedMaterial(woodTex, colorHex, 0.7, 0.05);
    const mesh = new THREE.Mesh(boxGeo, boxMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // 2. Soft pastel metal reinforcement brackets (top & bottom frames)
    const frameGeo = new THREE.BoxGeometry(w * 1.015, h * 0.09, d * 1.015);
    const frameMat = this.getMaterial('#B8A8C8', 0.35, 0.5);
    const topFrame = new THREE.Mesh(frameGeo, frameMat);
    topFrame.position.y = h * 0.42;
    const botFrame = new THREE.Mesh(frameGeo, frameMat);
    botFrame.position.y = -h * 0.42;
    group.add(topFrame, botFrame);

    // 3. Wooden cross-brace diagonal slashes on front and back
    if (w > 0.8 && h > 0.8) {
      const diagLen = Math.sqrt(w * w + h * h) * 0.75;
      const braceMat = this.getTexturedMaterial(woodTex, '#E0D0C0', 0.75, 0.05);
      const braceGeo = new THREE.BoxGeometry(0.1, diagLen, d * 1.02);
      const brace = new THREE.Mesh(braceGeo, braceMat);
      brace.rotation.z = Math.atan2(h, w);
      group.add(brace);
    }

    return group;
  }

  public static createContainer(w: number, h: number, d: number, colorHex: string = '#FFA0B0'): THREE.Group {
    const group = new THREE.Group();

    // Main container body - pastel
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = this.getMaterial(colorHex, 0.55, 0.15);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Corrugation ridges (vertical stripes)
    const stripeCount = Math.max(3, Math.floor(Math.max(w, d) / 0.8));
    const isWide = w > d;
    for (let i = 0; i < stripeCount; i++) {
      const t = (i / (stripeCount - 1)) - 0.5;
      const stripeGeo = isWide
        ? new THREE.BoxGeometry(0.08, h * 0.95, d * 1.02)
        : new THREE.BoxGeometry(w * 1.02, h * 0.95, 0.08);
      const stripeMat = this.getMaterial(colorHex, 0.5, 0.2);
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      if (isWide) {
        stripe.position.x = t * w * 0.9;
      } else {
        stripe.position.z = t * d * 0.9;
      }
      group.add(stripe);
    }

    // Corner posts (soft colored)
    const postMat = this.getMaterial('#C0B0D0', 0.35, 0.5);
    const postW = 0.18;
    const postGeo = new THREE.BoxGeometry(postW, h * 1.01, postW);
    const hw = w / 2 - postW / 2;
    const hd = d / 2 - postW / 2;

    const positions = [[hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd]];
    for (const [px, pz] of positions) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(px, 0, pz);
      group.add(post);
    }

    return group;
  }

  /**
   * Tactical military camouflage barrier with reinforced base and hazard trim
   */
  public static createBarrier(w: number, h: number, d: number, colorHex: string = '#C4B5E3'): THREE.Group {
    const group = new THREE.Group();

    // 1. Concrete / composite barrier body with pastel military camo texture!
    const geo = new THREE.BoxGeometry(w, h * 0.85, d * 0.88);
    const camoTex = this.getPastelCamoTexture();
    const camoMat = this.getTexturedMaterial(camoTex, '#FFFFFF', 0.7, 0.05);
    const mesh = new THREE.Mesh(geo, camoMat);
    mesh.position.y = h * 0.05;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // 2. Beveled reinforced base foot (wider at bottom, jersey barrier style)
    const baseGeo = new THREE.BoxGeometry(w * 1.02, h * 0.28, d * 1.25);
    const baseMat = this.getMaterial('#B0A0C4', 0.65, 0.2);
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -h * 0.36;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // 3. Pastel warning hazard accent stripe on top
    const stripeGeo = new THREE.BoxGeometry(w * 1.01, h * 0.12, d * 0.9);
    const stripeMat = this.getMaterial('#FFE5B4', 0.45, 0.1);
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = h * 0.44;
    group.add(stripe);

    // 4. Vertical steel end-plates with bolt studs
    const endMat = this.getMaterial('#9F8EA8', 0.4, 0.45);
    const endGeo = new THREE.BoxGeometry(0.06, h * 0.95, d * 1.05);
    const leftEnd = new THREE.Mesh(endGeo, endMat);
    leftEnd.position.x = -w / 2;
    const rightEnd = new THREE.Mesh(endGeo, endMat);
    rightEnd.position.x = w / 2;
    group.add(leftEnd, rightEnd);

    return group;
  }

  public static createLadder(height: number): THREE.Group {
    const group = new THREE.Group();

    const railMat = this.getMaterial('#B0A0C0', 0.35, 0.6);
    const rungMat = this.getMaterial('#FFD700', 0.45, 0.3);

    const railW = 0.48;
    const railRadius = 0.024;
    const railHeight = height + 0.4;

    // Left and Right vertical rails
    const railGeo = new THREE.CylinderGeometry(railRadius, railRadius, railHeight, 8);
    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.position.set(-railW / 2, railHeight / 2, 0);
    leftRail.castShadow = true;

    const rightRail = new THREE.Mesh(railGeo, railMat);
    rightRail.position.set(railW / 2, railHeight / 2, 0);
    rightRail.castShadow = true;

    group.add(leftRail, rightRail);

    // Horizontal rungs
    const rungSpacing = 0.28;
    const rungCount = Math.floor(height / rungSpacing);
    const rungGeo = new THREE.CylinderGeometry(0.016, 0.016, railW, 8);
    rungGeo.rotateZ(Math.PI / 2);

    for (let i = 1; i <= rungCount; i++) {
      const rung = new THREE.Mesh(rungGeo, i % 3 === 0 ? rungMat : railMat);
      rung.position.set(0, i * rungSpacing, 0);
      rung.castShadow = true;
      group.add(rung);
    }

    // Top handrail loop
    const loopGeo = new THREE.TorusGeometry(railW / 2, railRadius, 8, 16, Math.PI);
    const loop = new THREE.Mesh(loopGeo, rungMat);
    loop.position.set(0, railHeight, 0);
    group.add(loop);

    return group;
  }

  public static createWall(w: number, h: number, d: number, colorHex: string = '#D5C4E3'): THREE.Group {
    const group = new THREE.Group();

    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = this.getMaterial(colorHex, 0.75, 0.1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Subtle pillar buttresses
    const pillarMat = this.getMaterial('#C0B0D0', 0.7, 0.15);
    const isHorizontal = w >= d;
    const length = isHorizontal ? w : d;
    const step = 10;
    const count = Math.floor(length / step);

    for (let i = -count / 2; i <= count / 2; i++) {
      const pw = isHorizontal ? 0.6 : d * 1.2;
      const pd = isHorizontal ? d * 1.2 : 0.6;
      const pillarGeo = new THREE.BoxGeometry(pw, h * 1.02, pd);
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      if (isHorizontal) {
        pillar.position.set(i * step, 0, 0);
      } else {
        pillar.position.set(0, 0, i * step);
      }
      pillar.castShadow = true;
      group.add(pillar);
    }

    // Top cap
    const capGeo = new THREE.BoxGeometry(isHorizontal ? w : d * 1.15, 0.2, isHorizontal ? d * 1.15 : w);
    const capMat = this.getMaterial('#E0D0F0', 0.5, 0.3);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = h / 2 + 0.1;
    group.add(cap);

    return group;
  }

  public static createTree(w: number, h: number, d: number): THREE.Group {
    const group = new THREE.Group();

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, h * 0.5, 6);
    const trunkMat = this.getMaterial('#A08060', 0.9, 0.05);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = -h * 0.25;
    trunk.castShadow = true;
    group.add(trunk);

    // Pastel foliage layers
    const fMat1 = this.getMaterial('#90D090', 0.85, 0.0);
    const fMat2 = this.getMaterial('#A0E0A0', 0.85, 0.0);

    const f1Geo = new THREE.ConeGeometry(w * 0.9, h * 0.5, 7);
    const f1 = new THREE.Mesh(f1Geo, fMat1);
    f1.position.y = h * 0.05;
    f1.castShadow = true;

    const f2Geo = new THREE.ConeGeometry(w * 0.7, h * 0.45, 6);
    const f2 = new THREE.Mesh(f2Geo, fMat2);
    f2.position.y = h * 0.32;
    f2.castShadow = true;

    group.add(f1, f2);
    return group;
  }

  public static createRock(w: number, h: number, d: number, colorHex: string = '#D4C4B8'): THREE.Group {
    const group = new THREE.Group();

    const geo = new THREE.DodecahedronGeometry(w * 0.5, 1);
    geo.scale(1, h / w, d / w);
    const mat = this.getMaterial(colorHex, 0.85, 0.05);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    return group;
  }

  public static createBush(w: number, h: number, d: number, colorHex: string = '#80C880'): THREE.Group {
    const group = new THREE.Group();

    const geo = new THREE.SphereGeometry(w * 0.5, 6, 5);
    geo.scale(1, h / w, d / w);
    const mat = this.getMaterial(colorHex, 0.8, 0.0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    group.add(mesh);

    return group;
  }

  /**
   * Tactical military bunker building with modular ballistic composite camo panels,
   * protective parapet coping, and visor accents.
   */
  public static createBuilding(w: number, h: number, d: number, colorHex: string = '#E0D0F0'): THREE.Group {
    const group = new THREE.Group();

    // 1. Bunker wall body with pastel tactical bunker camo panel texture
    const geo = new THREE.BoxGeometry(w, h, d);
    const bunkerTex = this.getPastelBunkerTexture();
    const mat = this.getTexturedMaterial(bunkerTex, '#FFFFFF', 0.65, 0.1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // 2. Parapet protective coping along top edge
    const copingGeo = new THREE.BoxGeometry(w * 1.03, h * 0.08, d * 1.03);
    const copingMat = this.getMaterial('#C0A8D4', 0.45, 0.35);
    const coping = new THREE.Mesh(copingGeo, copingMat);
    coping.position.y = h * 0.48;
    coping.castShadow = true;
    group.add(coping);

    // 3. Reinforced base footing
    const footGeo = new THREE.BoxGeometry(w * 1.04, h * 0.12, d * 1.04);
    const footMat = this.getMaterial('#B098C8', 0.6, 0.25);
    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.y = -h * 0.45;
    foot.castShadow = true;
    group.add(foot);

    // 4. Subtle visor accent strip with soft glow
    const visorGeo = new THREE.BoxGeometry(w * 0.85, h * 0.1, d * 1.02);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0xD4A0E0,
      roughness: 0.3,
      metalness: 0.4,
      emissive: 0xD4A0E0,
      emissiveIntensity: 0.12
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.y = h * 0.25;
    group.add(visor);

    return group;
  }

  public static createRamp(w: number, h: number, d: number, colorHex: string = '#D5C4E3'): THREE.Group {
    const group = new THREE.Group();

    const shape = new THREE.Shape();
    shape.moveTo(-d / 2, -h / 2);
    shape.lineTo(d / 2, -h / 2);
    shape.lineTo(d / 2, h / 2);
    shape.closePath();

    const extrudeSettings = { depth: w, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center();
    const mat = this.getMaterial(colorHex, 0.7, 0.1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.y = Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    return group;
  }

  public static createPillar(w: number, h: number, d: number, colorHex: string = '#D4A0E0'): THREE.Group {
    const group = new THREE.Group();

    const radius = Math.min(w, d) / 2;
    // Smooth pastel column
    const geo = new THREE.CylinderGeometry(radius, radius * 1.1, h, 16);
    const mat = this.getMaterial(colorHex, 0.5, 0.3);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Decorative ring bands
    const ringMat = this.getMaterial('#E8D5F5', 0.4, 0.4);
    const ringGeo = new THREE.CylinderGeometry(radius * 1.08, radius * 1.08, h * 0.05, 16);
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.position.y = h * 0.25;
    const ring2 = new THREE.Mesh(ringGeo, ringMat);
    ring2.position.y = -h * 0.25;
    group.add(ring1, ring2);

    // Top cap
    const capGeo = new THREE.CylinderGeometry(radius * 1.15, radius * 1.15, 0.08, 16);
    const cap = new THREE.Mesh(capGeo, ringMat);
    cap.position.y = h / 2 + 0.04;
    group.add(cap);

    return group;
  }

  // Legacy createFloor for backward compatibility
  public static createFloor(size: number = 100): THREE.Group {
    return this.createCircularFloor(size / 2);
  }
}
