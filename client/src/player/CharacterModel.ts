import * as THREE from 'three';
import { ForeheadBadge } from './ForeheadBadge';
import { PlayerCustomization } from '@shared/types/game';

export class CharacterModel {
  public group: THREE.Group;
  public headGroup: THREE.Group;
  public foreheadBadge: ForeheadBadge;

  // Limbs for procedural animation
  private leftArm: THREE.Group;
  private rightArm: THREE.Group;
  private leftLeg: THREE.Group;
  private rightLeg: THREE.Group;
  private torso: THREE.Mesh;
  private shieldMesh: THREE.Mesh;

  private walkCycleTime: number = 0;
  private isDead: boolean = false;
  private deathProgress: number = 0;

  constructor(customization: PlayerCustomization, isSelf: boolean = false) {
    this.group = new THREE.Group();

    const suitColor = customization.suitColor || '#1E293B';
    const accentColor = customization.color || '#3B82F6';

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xfbcfe8,
      roughness: 0.6,
      metalness: 0.0
    });
    const suitMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(suitColor),
      roughness: 0.7,
      metalness: 0.1
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(accentColor),
      roughness: 0.5,
      metalness: 0.2
    });
    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8,
      metalness: 0.2
    });

    // 1. Torso / Spy Jacket
    const torsoGeo = new THREE.BoxGeometry(0.5, 0.65, 0.32);
    this.torso = new THREE.Mesh(torsoGeo, suitMat);
    this.torso.position.y = 0.95;
    this.torso.castShadow = true;
    this.torso.receiveShadow = true;
    this.group.add(this.torso);

    // Spy Tie / Collar
    const tieGeo = new THREE.BoxGeometry(0.12, 0.35, 0.04);
    const tie = new THREE.Mesh(tieGeo, accentMat);
    tie.position.set(0, 0.1, 0.17);
    this.torso.add(tie);

    // 2. Head Group (Rotates and pitches)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.45, 0);
    this.group.add(this.headGroup);

    // Head base (rounded box)
    const headGeo = new THREE.BoxGeometry(0.38, 0.38, 0.38);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.castShadow = true;
    this.headGroup.add(headMesh);

    // Spy Sunglasses / Visor
    const glassesGeo = new THREE.BoxGeometry(0.36, 0.1, 0.08);
    const glassesMat = new THREE.MeshStandardMaterial({
      color: 0x020617,
      roughness: 0.1,
      metalness: 0.9
    });
    const glasses = new THREE.Mesh(glassesGeo, glassesMat);
    glasses.position.set(0, 0.02, 0.18);
    this.headGroup.add(glasses);

    // 3. Forehead Number Badge (Mounted onto forehead front)
    this.foreheadBadge = new ForeheadBadge(isSelf);
    this.foreheadBadge.mesh.position.set(0, 0.14, 0.2); // Just above sunglasses
    this.headGroup.add(this.foreheadBadge.mesh);

    // 4. Hat / Accessory
    this.addAccessory(customization.accessory, accentMat, suitMat);

    // 5. Arms
    this.leftArm = this.createLimb(0.14, 0.55, 0.14, suitMat, skinMat);
    this.leftArm.position.set(-0.35, 1.25, 0);
    this.group.add(this.leftArm);

    this.rightArm = this.createLimb(0.14, 0.55, 0.14, suitMat, skinMat);
    this.rightArm.position.set(0.35, 1.25, 0);
    this.group.add(this.rightArm);

    // 6. Legs
    this.leftLeg = this.createLimb(0.16, 0.65, 0.16, suitMat, shoeMat);
    this.leftLeg.position.set(-0.16, 0.65, 0);
    this.group.add(this.leftLeg);

    this.rightLeg = this.createLimb(0.16, 0.65, 0.16, suitMat, shoeMat);
    this.rightLeg.position.set(0.16, 0.65, 0);
    this.group.add(this.rightLeg);

    // 7. Spawn Protection Shield
    const shieldGeo = new THREE.SphereGeometry(1.2, 16, 12);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.4
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.y = 1.0;
    this.shieldMesh.visible = false;
    this.group.add(this.shieldMesh);

    // Hide self body from blocking first-person camera if isSelf
    if (isSelf) {
      // In first person, we hide head and torso from self camera so they don't clip
      this.torso.visible = false;
      this.headGroup.visible = false;
    }
  }

  private createLimb(
    w: number,
    h: number,
    d: number,
    mainMat: THREE.Material,
    tipMat: THREE.Material
  ): THREE.Group {
    const limbGroup = new THREE.Group();

    const upperGeo = new THREE.BoxGeometry(w, h * 0.75, d);
    const upper = new THREE.Mesh(upperGeo, mainMat);
    upper.position.y = -h * 0.35;
    upper.castShadow = true;
    limbGroup.add(upper);

    const tipGeo = new THREE.BoxGeometry(w * 1.02, h * 0.25, d * 1.05);
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.y = -h * 0.85;
    tip.castShadow = true;
    limbGroup.add(tip);

    return limbGroup;
  }

  private addAccessory(
    acc: string,
    accentMat: THREE.Material,
    darkMat: THREE.Material
  ): void {
    if (acc === 'fedora') {
      const brimGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.03, 12);
      const brim = new THREE.Mesh(brimGeo, darkMat);
      brim.position.y = 0.21;

      const crownGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.16, 10);
      const crown = new THREE.Mesh(crownGeo, darkMat);
      crown.position.y = 0.29;

      const bandGeo = new THREE.CylinderGeometry(0.245, 0.245, 0.04, 10);
      const band = new THREE.Mesh(bandGeo, accentMat);
      band.position.y = 0.23;

      this.headGroup.add(brim, crown, band);
    } else if (acc === 'cap') {
      const capGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.12, 10);
      const cap = new THREE.Mesh(capGeo, accentMat);
      cap.position.y = 0.24;

      const visorGeo = new THREE.BoxGeometry(0.26, 0.02, 0.18);
      const visor = new THREE.Mesh(visorGeo, darkMat);
      visor.position.set(0, 0.2, 0.2);
      this.headGroup.add(cap, visor);
    } else if (acc === 'headset') {
      const bandGeo = new THREE.TorusGeometry(0.22, 0.025, 8, 16, Math.PI);
      const band = new THREE.Mesh(bandGeo, darkMat);
      band.rotation.x = -Math.PI / 2;
      band.position.y = 0.15;

      const micGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.18);
      const mic = new THREE.Mesh(micGeo, accentMat);
      mic.rotation.z = Math.PI / 3;
      mic.position.set(0.18, 0.05, 0.14);
      this.headGroup.add(band, mic);
    }
  }

  public updateAnimation(
    delta: number,
    isMoving: boolean,
    isSprinting: boolean,
    isCrouching: boolean,
    isDead: boolean,
    isSpawnProtected: boolean
  ): void {
    this.shieldMesh.visible = isSpawnProtected;
    if (isSpawnProtected) {
      this.shieldMesh.rotation.y += delta * 2;
    }

    if (isDead) {
      if (!this.isDead) {
        this.isDead = true;
        this.deathProgress = 0;
      }
      this.deathProgress = Math.min(1, this.deathProgress + delta * 3.5);
      // Fall backwards and flatten
      this.group.rotation.x = (Math.PI / 2) * this.deathProgress;
      this.group.position.y = 0.2 * (1 - this.deathProgress);
      return;
    } else {
      if (this.isDead) {
        this.isDead = false;
        this.group.rotation.x = 0;
      }
    }

    // Crouch height adjustment
    const targetY = isCrouching ? -0.4 : 0;
    this.torso.position.y = THREE.MathUtils.lerp(this.torso.position.y, 0.95 + targetY, 0.2);
    this.headGroup.position.y = THREE.MathUtils.lerp(this.headGroup.position.y, 1.45 + targetY, 0.2);

    if (isMoving) {
      const speedMultiplier = isSprinting ? 14 : 9;
      this.walkCycleTime += delta * speedMultiplier;

      const swing = Math.sin(this.walkCycleTime) * (isSprinting ? 0.8 : 0.5);

      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.8;
      this.rightArm.rotation.x = swing * 0.8;

      // Slight body bounce
      this.torso.position.y = 0.95 + targetY + Math.abs(Math.sin(this.walkCycleTime * 2)) * 0.04;
    } else {
      // Idle breathing
      this.walkCycleTime += delta * 2.0;
      const breathe = Math.sin(this.walkCycleTime) * 0.02;

      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, 0.15);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, 0.15);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, breathe, 0.15);
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, -breathe, 0.15);
      this.torso.position.y = THREE.MathUtils.lerp(this.torso.position.y, 0.95 + targetY + breathe, 0.15);
    }
  }
}
