import * as THREE from 'three';

export class ForeheadBadge {
  public mesh: THREE.Group;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private currentDisplayNumber: string | null = null;
  private isSelf: boolean = false;

  constructor(isSelf: boolean = false) {
    this.isSelf = isSelf;
    this.mesh = new THREE.Group();

    // 256x96 dynamic canvas for high-DPI crisp digits
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 96;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    // Physical mounting plate
    const plateGeo = new THREE.BoxGeometry(0.36, 0.14, 0.03);
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.8
    });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    this.mesh.add(plate);

    // Glowing front display surface
    const screenGeo = new THREE.PlaneGeometry(0.34, 0.12);
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      side: THREE.DoubleSide
    });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.z = 0.016;
    this.mesh.add(screen);

    this.renderBadge('????');
  }

  public setNumber(numberStr: string | null): void {
    if (this.currentDisplayNumber === numberStr) return;
    this.currentDisplayNumber = numberStr;
    this.renderBadge(numberStr || '????');
  }

  private renderBadge(text: string): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const isRevealed = text !== '????';

    // Clear
    this.ctx.clearRect(0, 0, w, h);

    // Background rounded pill
    this.ctx.fillStyle = isRevealed ? 'rgba(3, 10, 25, 0.95)' : 'rgba(15, 23, 42, 0.8)';
    this.ctx.strokeStyle = isRevealed ? '#00F0FF' : 'rgba(100, 116, 139, 0.5)';
    this.ctx.lineWidth = 4;

    const r = 16;
    this.ctx.beginPath();
    this.ctx.roundRect(4, 4, w - 8, h - 8, r);
    this.ctx.fill();
    this.ctx.stroke();

    // Subtle digital matrix background grid
    if (isRevealed) {
      this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
      this.ctx.lineWidth = 1;
      for (let x = 16; x < w; x += 16) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, 4);
        this.ctx.lineTo(x, h - 4);
        this.ctx.stroke();
      }
    }

    // Typography
    this.ctx.font = '900 52px "JetBrains Mono", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    if (isRevealed) {
      // Glow effect
      this.ctx.shadowColor = '#00F0FF';
      this.ctx.shadowBlur = 12;
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.fillText(text, w / 2, h / 2 + 2);

      // Inner vibrant cyan core
      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = '#00F0FF';
      this.ctx.fillText(text, w / 2, h / 2 + 2);
    } else {
      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      this.ctx.fillText('????', w / 2, h / 2 + 2);
    }

    this.texture.needsUpdate = true;
  }
}
