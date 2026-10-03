import * as THREE from 'three';
import { ForeheadBadge } from './ForeheadBadge';
import { PlayerCustomization } from '@shared/types/game';

export class CharacterModel {
  public group: THREE.Group;
  public torso: THREE.Mesh;
  public headGroup: THREE.Group;
  public foreheadBadge: ForeheadBadge;

  // Limbs for procedural animation
  private leftArm: THREE.Group;
  private rightArm: THREE.Group;
  private leftLeg: THREE.Group;
  private rightLeg: THREE.Group;
  private shieldMesh: THREE.Mesh;

  private walkCycleTime: number = 0;
  private isDead: boolean = false;
  private deathProgress: number = 0;

  // Hip pivot height (0.65m above ground, leg length 0.65m -> feet touch ground at y=0)
  private readonly HIP_HEIGHT: number = 0.65;
  private readonly LEG_LENGTH: number = 0.65;

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

    // 1. Torso / Body (Centered at y = 0.95, facing -Z)
    const torsoGeo = new THREE.BoxGeometry(0.50, 0.65, 0.32);
    this.torso = new THREE.Mesh(torsoGeo, suitMat);
    this.torso.position.set(0, 0.95, 0);
    this.torso.castShadow = true;
    this.torso.receiveShadow = true;
    this.group.add(this.torso);

    // Spy Tie / Collar on FRONT chest (front is -Z)
    const tieGeo = new THREE.BoxGeometry(0.12, 0.35, 0.04);
    const tie = new THREE.Mesh(tieGeo, accentMat);
    tie.position.set(0, 0.10, -0.17);
    this.torso.add(tie);

    // 2. Head (Attached to torso/body hierarchy, centers at y = 1.45)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.45, 0);
    this.group.add(this.headGroup);

    // Head base (0.38 x 0.38 x 0.38)
    const headGeo = new THREE.BoxGeometry(0.38, 0.38, 0.38);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.castShadow = true;
    this.headGroup.add(headMesh);

    // Spy Sunglasses on FRONT face (z = -0.19)
    const glassesGeo = new THREE.BoxGeometry(0.36, 0.10, 0.06);
    const glassesMat = new THREE.MeshStandardMaterial({
      color: 0x020617,
      roughness: 0.1,
      metalness: 0.95
    });
    const glasses = new THREE.Mesh(glassesGeo, glassesMat);
    glasses.position.set(0, 0.02, -0.19);
    this.headGroup.add(glasses);

    // 3. Forehead Number Badge
    // Anchored directly to forehead/upper face level: y = +0.13, z = -0.20
    this.foreheadBadge = new ForeheadBadge(isSelf);
    this.foreheadBadge.mesh.position.set(0, 0.13, -0.20);
    this.headGroup.add(this.foreheadBadge.mesh);

    // 4. Hat / Accessory (Aligned to front -Z)
    this.addAccessory(customization.accessory, accentMat, suitMat);

    // 5. Arms (Pivoting at shoulders: y = 1.25, x = +/-0.35)
    this.leftArm = this.createArm(0.14, 0.55, 0.14, suitMat, skinMat);
    this.leftArm.position.set(-0.34, 1.25, 0);
    this.group.add(this.leftArm);

    this.rightArm = this.createArm(0.14, 0.55, 0.14, suitMat, skinMat);
    this.rightArm.position.set(0.34, 1.25, 0);
    this.group.add(this.rightArm);

    // 6. Legs (Pivoting at hips: y = 0.65, x = +/-0.15)
    // Shoe soles extend down exactly 0.65m to rest firmly on the ground plane y = 0.0
    this.leftLeg = this.createLeg(0.15, this.LEG_LENGTH, 0.15, suitMat, shoeMat);
    this.leftLeg.position.set(-0.15, this.HIP_HEIGHT, 0);
    this.group.add(this.leftLeg);

    this.rightLeg = this.createLeg(0.15, this.LEG_LENGTH, 0.15, suitMat, shoeMat);
    this.rightLeg.position.set(0.15, this.HIP_HEIGHT, 0);
    this.group.add(this.rightLeg);

    // 7. Spawn Protection Shield
    const shieldGeo = new THREE.SphereGeometry(1.2, 16, 12);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.y = 1.0;
    this.shieldMesh.visible = false;
    this.group.add(this.shieldMesh);

    // First person camera hides body to prevent self-clipping
    if (isSelf) {
      this.torso.visible = false;
      this.headGroup.visible = false;
    }
  }

  private createArm(
    w: number,
    h: number,
    d: number,
    sleeveMat: THREE.Material,
    handMat: THREE.Material
  ): THREE.Group {
    const limb = new THREE.Group();

    // Sleeve (top 75%)
    const sleeveGeo = new THREE.BoxGeometry(w, h * 0.75, d);
    const sleeve = new THREE.Mesh(sleeveGeo, sleeveMat);
    sleeve.position.y = -h * 0.375;
    sleeve.castShadow = true;
    limb.add(sleeve);

    // Hand (bottom 25%)
    const handGeo = new THREE.BoxGeometry(w * 0.9, h * 0.25, d * 0.9);
    const hand = new THREE.Mesh(handGeo, handMat);
    hand.position.y = -h * 0.875;
    hand.castShadow = true;
    limb.add(hand);

    return limb;
  }

  private createLeg(
    w: number,
    totalH: number,
    d: number,
    pantsMat: THREE.Material,
    shoeMat: THREE.Material
  ): THREE.Group {
    const limb = new THREE.Group();

    // Pants (from y = 0 to -0.53)
    const pantsH = totalH - 0.12;
    const pantsGeo = new THREE.BoxGeometry(w, pantsH, d);
    const pants = new THREE.Mesh(pantsGeo, pantsMat);
    pants.position.y = -pantsH / 2;
    pants.castShadow = true;
    limb.add(pants);

    // Shoe (from y = -0.53 to -0.65, extending forward toward -Z)
    const shoeH = 0.12;
    const shoeD = d * 1.4; // Slightly longer in forward -Z
    const shoeGeo = new THREE.BoxGeometry(w * 1.05, shoeH, shoeD);
    const shoe = new THREE.Mesh(shoeGeo, shoeMat);
    // Position shoe so its bottom is precisely at -totalH (-0.65)
    shoe.position.set(0, -totalH + shoeH / 2, -0.03);
    shoe.castShadow = true;
    limb.add(shoe);

    return limb;
  }

  private addAccessory(
    acc: string,
    accentMat: THREE.Material,
    darkMat: THREE.Material
  ): void {
    if (acc === 'fedora') {
      const brimGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.03, 14);
      const brim = new THREE.Mesh(brimGeo, darkMat);
      brim.position.y = 0.21;

      const crownGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.16, 12);
      const crown = new THREE.Mesh(crownGeo, darkMat);
      crown.position.y = 0.29;

      const bandGeo = new THREE.CylinderGeometry(0.245, 0.245, 0.04, 12);
      const band = new THREE.Mesh(bandGeo, accentMat);
      band.position.y = 0.23;

      this.headGroup.add(brim, crown, band);
    } else if (acc === 'cap') {
      const capGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.12, 12);
      const cap = new THREE.Mesh(capGeo, accentMat);
      cap.position.y = 0.24;

      // Visor pointing forward (-Z)
      const visorGeo = new THREE.BoxGeometry(0.26, 0.02, 0.18);
      const visor = new THREE.Mesh(visorGeo, darkMat);
      visor.position.set(0, 0.20, -0.20);
      this.headGroup.add(cap, visor);
    } else if (acc === 'headset') {
      const bandGeo = new THREE.TorusGeometry(0.22, 0.025, 8, 16, Math.PI);
      const band = new THREE.Mesh(bandGeo, darkMat);
      band.rotation.x = -Math.PI / 2;
      band.position.y = 0.15;

      // Mic arm forward (-Z)
      const micGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.18);
      const mic = new THREE.Mesh(micGeo, accentMat);
      mic.rotation.z = Math.PI / 3;
      mic.position.set(0.18, 0.05, -0.14);
      this.headGroup.add(band, mic);
    }
  }

  public setNumber(numberStr: string): void {
    this.foreheadBadge.setNumber(numberStr);
  }

  public setNumberVisible(visible: boolean): void {
    this.foreheadBadge.setVisible(visible);
  }

  public getForeheadPosition(): THREE.Vector3 {
    const pos = new THREE.Vector3();
    this.foreheadBadge.mesh.getWorldPosition(pos);
    return pos;
  }

  public getForeheadForward(): THREE.Vector3 {
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.group.quaternion);
    return forward;
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
      this.group.rotation.x = (Math.PI / 2) * this.deathProgress;
      this.group.position.y = 0.15 * (1 - this.deathProgress);
      return;
    } else {
      if (this.isDead) {
        this.isDead = false;
        this.group.rotation.x = 0;
        this.group.position.y = 0;
      }
    }

    // Crouch height offset
    const crouchOffset = isCrouching ? -0.48 : 0;
    const baseTorsoY = 0.95 + crouchOffset;
    const baseHeadY = 1.45 + crouchOffset;

    if (isMoving) {
      // Cadence: walk ~8.5 rad/s, sprint ~14.5 rad/s
      const cadence = isSprinting ? 14.5 : 8.5;
      this.walkCycleTime += delta * cadence;

      // Leg swing angle
      const swingMax = isSprinting ? 0.75 : 0.44;
      const legSwing = Math.sin(this.walkCycleTime) * swingMax;

      this.leftLeg.rotation.x = legSwing;
      this.rightLeg.rotation.x = -legSwing;

      // Arm swing (opposite to legs)
      const armSwingMax = isSprinting ? 0.70 : 0.40;
      this.leftArm.rotation.x = -legSwing * (armSwingMax / swingMax);
      this.rightArm.rotation.x = legSwing * (armSwingMax / swingMax);

      // Torso lean forward: running leans forward dynamically into movement
      const targetLean = isSprinting ? -0.20 : -0.06;
      this.torso.rotation.x = THREE.MathUtils.lerp(this.torso.rotation.x, targetLean, delta * 10);
      this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, -targetLean * 0.4, delta * 10);

      // Torso twist (counter-rotation to swinging legs)
      this.torso.rotation.y = -Math.sin(this.walkCycleTime) * (isSprinting ? 0.10 : 0.04);

      // Grounding calculation:
      // When legs swing by angle theta, the hip drops by L * (1 - cos theta)
      // to keep the planted foot firmly on the ground without hovering or floating!
      const plantedAngle = Math.min(Math.abs(legSwing), 0.7);
      const hipDip = -this.LEG_LENGTH * (1.0 - Math.cos(plantedAngle)) * 0.9;

      this.leftLeg.position.y = this.HIP_HEIGHT + hipDip + crouchOffset;
      this.rightLeg.position.y = this.HIP_HEIGHT + hipDip + crouchOffset;
      this.torso.position.y = baseTorsoY + hipDip;
      this.headGroup.position.y = baseHeadY + hipDip;
    } else {
      // Idle breathing: legs stationary and planted firmly on ground
      this.walkCycleTime += delta * 2.2;
      const breath = Math.sin(this.walkCycleTime) * 0.015;

      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, delta * 10);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, delta * 10);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, breath, delta * 10);
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, -breath, delta * 10);

      this.torso.rotation.x = THREE.MathUtils.lerp(this.torso.rotation.x, 0, delta * 8);
      this.torso.rotation.y = THREE.MathUtils.lerp(this.torso.rotation.y, 0, delta * 8);
      this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, 0, delta * 8);

      // Feet firmly on ground
      this.leftLeg.position.y = this.HIP_HEIGHT + crouchOffset;
      this.rightLeg.position.y = this.HIP_HEIGHT + crouchOffset;
      this.torso.position.y = baseTorsoY + breath;
      this.headGroup.position.y = baseHeadY + breath;
    }
  }
}
