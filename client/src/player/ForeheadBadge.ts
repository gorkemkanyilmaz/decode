import * as THREE from 'three';

export class ForeheadBadge {
  public mesh: THREE.Group;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private currentNumber: string = '';
  private isSelf: boolean = false;

  constructor(isSelf: boolean = false) {
    this.isSelf = isSelf;
    this.mesh = new THREE.Group();
    // Hidden by default until visibility conditions are satisfied
    this.mesh.visible = false;

    // 256x96 dynamic canvas for high-contrast crisp 4-digit typography
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 96;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    // Physical mounting plate on forehead
    const plateGeo = new THREE.BoxGeometry(0.30, 0.10, 0.02);
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x0a0f1d,
      roughness: 0.35,
      metalness: 0.8
    });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    // Plate center is at origin, back sits against forehead at z = 0, front is at z = -0.01
    plate.position.set(0, 0, 0);
    this.mesh.add(plate);

    // Glowing front display surface facing forward (-Z)
    const screenGeo = new THREE.PlaneGeometry(0.28, 0.085);
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      side: THREE.FrontSide // Only readable from the front! Backface naturally culled
    });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    // Face the front (-Z): PlaneGeometry default normal is +Z, so rotate by 180 deg around Y
    screen.rotation.y = Math.PI;
    screen.position.set(0, 0, -0.011);
    this.mesh.add(screen);
  }

  /**
   * Stores and renders the four-digit number onto the forehead texture
   */
  public setNumber(numberStr: string): void {
    if (!numberStr || this.currentNumber === numberStr) return;
    this.currentNumber = numberStr;
    this.renderBadge(numberStr);
  }

  public getNumber(): string {
    return this.currentNumber;
  }

  /**
   * Toggles visibility of the forehead number.
   * There are ONLY two states: VISIBLE (4 digits) or NOT VISIBLE (nothing).
   * NO "????" placeholder is ever displayed.
   */
  public setVisible(visible: boolean): void {
    // Only display if visible is true AND we have a valid 4-digit number
    this.mesh.visible = visible && this.currentNumber.length === 4;
  }

  public isVisible(): boolean {
    return this.mesh.visible;
  }

  private renderBadge(digits: string): void {
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.ctx.clearRect(0, 0, w, h);

    // High-contrast dark badge background with crisp glowing border
    this.ctx.fillStyle = 'rgba(5, 12, 28, 0.95)';
    this.ctx.strokeStyle = '#00F0FF';
    this.ctx.lineWidth = 4;

    const r = 12;
    this.ctx.beginPath();
    this.ctx.roundRect(3, 3, w - 6, h - 6, r);
    this.ctx.fill();
    this.ctx.stroke();

    // Subtle tactical scanline accent
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    this.ctx.lineWidth = 1;
    for (let y = 10; y < h; y += 12) {
      this.ctx.beginPath();
      this.ctx.moveTo(6, y);
      this.ctx.lineTo(w - 6, y);
      this.ctx.stroke();
    }

    // High-contrast, clean 4-digit typography
    this.ctx.font = '900 52px "JetBrains Mono", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Outer glow
    this.ctx.shadowColor = '#00F0FF';
    this.ctx.shadowBlur = 10;
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillText(digits, w / 2, h / 2 + 2);

    // Inner bright core
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = '#00F0FF';
    this.ctx.fillText(digits, w / 2, h / 2 + 2);

    this.texture.needsUpdate = true;
  }
}
