import * as THREE from 'three';
import { MAP_OBJECTS, ARENA_RADIUS } from '@shared/constants/mapLayout';

/**
 * Circular minimap rendered on a 2D canvas in the bottom-right corner.
 * Shows the arena boundary, all obstacles, and the local player's position + direction.
 */
export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLDivElement;

  private size: number = 150;
  private padding: number = 16;
  private scale: number = 1;

  constructor() {
    // Create container
    this.container = document.createElement('div');
    this.container.id = 'minimap-container';

    // Create canvas
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;

    this.container.appendChild(this.canvas);
    document.body.appendChild(this.container);

    this.applyResponsiveLayout();
    window.addEventListener('resize', () => this.applyResponsiveLayout());
  }

  private applyResponsiveLayout(): void {
    const isMobile = window.innerWidth <= 768 || window.innerHeight <= 520;
    this.size = isMobile ? 105 : 150;
    this.padding = isMobile ? 12 : 16;
    this.scale = (this.size / 2 - 8) / ARENA_RADIUS;

    this.container.style.cssText = `
      position: fixed;
      bottom: ${this.padding}px;
      right: ${this.padding}px;
      width: ${this.size}px;
      height: ${this.size}px;
      z-index: 25;
      pointer-events: none;
      border-radius: 50%;
      overflow: hidden;
      background: rgba(22, 18, 36, 0.78);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), 0 0 0 2px rgba(196, 181, 253, 0.6), 0 0 20px rgba(167, 139, 250, 0.35);
    `;

    this.canvas.width = this.size * 2; // High DPI
    this.canvas.height = this.size * 2;
    this.canvas.style.cssText = `
      width: ${this.size}px;
      height: ${this.size}px;
      border-radius: 50%;
      display: block;
    `;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(2, 2);
  }

  /**
   * Converts world X,Z to minimap canvas X,Y
   */
  private worldToMinimap(worldX: number, worldZ: number): [number, number] {
    const cx = this.size / 2;
    const cy = this.size / 2;
    return [
      cx + worldX * this.scale,
      cy + worldZ * this.scale
    ];
  }

  /**
   * Update the minimap every frame with player position and rotation
   */
  public update(
    playerPos: THREE.Vector3,
    playerYaw: number
  ): void {
    const ctx = this.ctx;
    const size = this.size;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2;

    // Clear
    ctx.clearRect(0, 0, size, size);

    // 1. Background circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // High-tech dark tactical background for maximum contrast against pastel arena
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    bgGrad.addColorStop(0, 'rgba(30, 24, 48, 0.88)');
    bgGrad.addColorStop(0.7, 'rgba(24, 18, 38, 0.92)');
    bgGrad.addColorStop(1.0, 'rgba(16, 12, 28, 0.96)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size, size);

    // 2. Arena boundary ring (circular deathmatch boundary)
    const arenaR = ARENA_RADIUS * this.scale;
    ctx.strokeStyle = 'rgba(196, 181, 253, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, arenaR, 0, Math.PI * 2);
    ctx.stroke();

    // Outer boundary fill (inaccessible zone outside arena)
    ctx.strokeStyle = 'rgba(244, 114, 182, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, arenaR + 3, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Concentric radar range rings
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.18)';
    ctx.lineWidth = 0.75;
    for (let ringR = 10; ringR < ARENA_RADIUS; ringR += 10) {
      ctx.beginPath();
      ctx.arc(cx, cy, ringR * this.scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Crosshairs
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.15)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(10, cy);
    ctx.lineTo(size - 10, cy);
    ctx.moveTo(cx, 10);
    ctx.lineTo(cx, size - 10);
    ctx.stroke();

    // Cardinal directions
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(216, 180, 254, 0.7)';
    ctx.fillText('N', cx, 8);
    ctx.fillText('S', cx, size - 8);
    ctx.fillText('W', 8, cy);
    ctx.fillText('E', size - 8, cy);

    // 4. Draw map obstacles with crisp distinct pastel colors & outlines
    for (const obj of MAP_OBJECTS) {
      if (obj.id.startsWith('tree_foliage') || obj.type === 'bush') continue;

      const b = obj.bounds;
      const [mx1, my1] = this.worldToMinimap(b.min[0], b.min[2]);
      const [mx2, my2] = this.worldToMinimap(b.max[0], b.max[2]);

      const w = Math.max(1.5, mx2 - mx1);
      const h = Math.max(1.5, my2 - my1);

      let fillColor = 'rgba(196, 181, 253, 0.65)';
      let strokeColor = 'rgba(233, 213, 255, 0.9)';

      if (obj.type === 'container') {
        fillColor = 'rgba(251, 146, 60, 0.75)';
        strokeColor = 'rgba(254, 215, 170, 0.95)';
      } else if (obj.type === 'building') {
        fillColor = 'rgba(147, 197, 253, 0.75)';
        strokeColor = 'rgba(219, 234, 254, 0.95)';
      } else if (obj.type === 'crate' || obj.type === 'crate_stack') {
        fillColor = 'rgba(244, 114, 182, 0.7)';
        strokeColor = 'rgba(252, 231, 243, 0.9)';
      } else if (obj.type === 'rock') {
        fillColor = 'rgba(168, 162, 158, 0.6)';
        strokeColor = 'rgba(231, 229, 228, 0.8)';
      } else if (obj.type === 'tree') {
        fillColor = 'rgba(74, 222, 128, 0.7)';
        strokeColor = 'rgba(187, 247, 208, 0.9)';
      } else if (obj.type === 'pillar') {
        fillColor = 'rgba(192, 132, 252, 0.8)';
        strokeColor = 'rgba(243, 232, 255, 0.95)';
      } else if (obj.type === 'platform') {
        fillColor = 'rgba(232, 213, 245, 0.3)';
        strokeColor = 'rgba(216, 180, 254, 0.5)';
      }

      ctx.fillStyle = fillColor;
      ctx.fillRect(mx1, my1, w, h);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 0.75;
      ctx.strokeRect(mx1, my1, w, h);
    }

    // 5. Draw local player (prominent glowing indicator with FOV cone)
    const [px, py] = this.worldToMinimap(playerPos.x, playerPos.z);

    // In world coordinates, forward direction is (-sin(yaw), -cos(yaw))
    // On minimap: +X is right (East), -Z is up (North, canvas -Y), +Z is down (South, canvas +Y)
    const dirX = -Math.sin(playerYaw);
    const dirY = -Math.cos(playerYaw);
    const baseAngle = Math.atan2(dirY, dirX);

    const arrowLen = 12;
    const tipX = px + dirX * arrowLen;
    const tipY = py + dirY * arrowLen;

    // FOV cone (soft glowing sector centered on forward gaze)
    const fovHalfAngle = Math.PI / 6; // 30 degrees half-width
    const coneLen = 28;
    const coneGrad = ctx.createRadialGradient(px, py, 2, px, py, coneLen);
    coneGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
    coneGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, coneLen, baseAngle - fovHalfAngle, baseAngle + fovHalfAngle);
    ctx.closePath();
    ctx.fill();

    // Pulse ring around local player
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.stroke();

    // Player core dot (Bright Cyan)
    ctx.fillStyle = '#00F0FF';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();

    // White outline
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.stroke();

    // Direction arrow pointer
    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // Arrowhead barb
    const barbLen = 4.5;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
      tipX - Math.cos(baseAngle - 0.55) * barbLen,
      tipY - Math.sin(baseAngle - 0.55) * barbLen
    );
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
      tipX - Math.cos(baseAngle + 0.55) * barbLen,
      tipY - Math.sin(baseAngle + 0.55) * barbLen
    );
    ctx.stroke();

    ctx.restore();

    // 7. Outer border ring & glass sheen
    ctx.strokeStyle = 'rgba(196, 181, 253, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.stroke();
  }

  public show(): void {
    this.container.style.display = 'block';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }

  public destroy(): void {
    this.container.remove();
  }
}
