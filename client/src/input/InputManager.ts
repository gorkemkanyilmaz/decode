export interface InputState {
  moveX: number; // -1 to 1 (strafe)
  moveZ: number; // -1 to 1 (forward/backward)
  yaw: number;
  pitch: number;
  isSprinting: boolean;
  isCrouching: boolean;
  isJumping: boolean;
}

export class InputManager {
  private keys: Set<string> = new Set();
  public yaw: number = 0;
  public pitch: number = 0;
  public isLocked: boolean = false;
  public isMobile: boolean = false;

  // Mobile virtual joystick state
  private moveJoystickActive: boolean = false;
  private moveJoystickTouchId: number | null = null;
  private moveJoystickStart: { x: number; y: number } = { x: 0, y: 0 };
  private moveVector: { x: number; z: number } = { x: 0, z: 0 };

  private lookTouchId: number | null = null;
  private lastLookTouch: { x: number; y: number } = { x: 0, y: 0 };

  // Mobile action button states
  public mobileSprinting: boolean = false;
  public mobileCrouching: boolean = false;
  public mobileJumping: boolean = false;

  // Callbacks
  public onDecodeToggle: (() => void) | null = null;
  public onGadgetUse: ((slot: number) => void) | null = null;
  public onDebugToggle: ((key: string) => void) | null = null;

  private canvas: HTMLElement;

  constructor(canvas: HTMLElement) {
    this.canvas = canvas;
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    this.setupDesktopControls();
    if (this.isMobile) {
      this.setupMobileControls();
    }
  }

  private setupDesktopControls(): void {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);

      if (e.code === 'KeyE') {
        this.onDecodeToggle?.();
      } else if (e.code === 'Digit1') {
        this.onGadgetUse?.(1);
      } else if (e.code === 'Digit2') {
        this.onGadgetUse?.(2);
      } else if (e.code === 'Digit3') {
        this.onGadgetUse?.(3);
      } else if (e.code === 'Digit4') {
        this.onGadgetUse?.(4);
      } else if (e.code.startsWith('F') && parseInt(e.code.substring(1)) >= 1 && parseInt(e.code.substring(1)) <= 7) {
        e.preventDefault();
        this.onDebugToggle?.(e.code);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    // Pointer lock for desktop mouse look
    this.canvas.addEventListener('click', () => {
      if (!this.isMobile && !this.isLocked) {
        this.canvas.requestPointerLock?.();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.canvas;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;
      const sensitivity = 0.0022;
      this.yaw -= e.movementX * sensitivity;
      this.pitch -= e.movementY * sensitivity;

      // Clamp pitch to avoid neck break (-85 to +85 degrees)
      const maxPitch = (Math.PI / 2) * 0.95;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    });
  }

  private setupMobileControls(): void {
    const touchControls = document.getElementById('touch-controls');
    if (touchControls) {
      touchControls.classList.remove('hidden');
    }

    const moveZone = document.getElementById('joystick-move-zone');
    const moveBase = document.getElementById('joystick-move-base');
    const moveThumb = document.getElementById('joystick-move-thumb');
    const lookZone = document.getElementById('touch-look-zone');

    if (!moveZone || !lookZone) return;

    // Left Joystick Movement Zone
    moveZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      this.moveJoystickActive = true;
      this.moveJoystickTouchId = touch.identifier;
      this.moveJoystickStart = { x: touch.clientX, y: touch.clientY };

      if (moveBase) {
        moveBase.style.display = 'block';
        moveBase.style.left = `${touch.clientX}px`;
        moveBase.style.top = `${touch.clientY}px`;
      }
      if (moveThumb) {
        moveThumb.style.left = '50%';
        moveThumb.style.top = '50%';
      }
    }, { passive: false });

    moveZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.moveJoystickActive) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.moveJoystickTouchId) {
          const dx = touch.clientX - this.moveJoystickStart.x;
          const dy = touch.clientY - this.moveJoystickStart.y;
          const maxDist = 50;
          const dist = Math.min(maxDist, Math.sqrt(dx * dx + dy * dy));
          const angle = Math.atan2(dy, dx);

          const thumbX = Math.cos(angle) * dist;
          const thumbY = Math.sin(angle) * dist;

          if (moveThumb) {
            moveThumb.style.left = `calc(50% + ${thumbX}px)`;
            moveThumb.style.top = `calc(50% + ${thumbY}px)`;
          }

          // Normalized movement vector
          this.moveVector = {
            x: thumbX / maxDist,
            z: -(thumbY / maxDist) // Pull down = backward (+Z in local coords)
          };
          break;
        }
      }
    }, { passive: false });

    const endMoveJoystick = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.moveJoystickTouchId) {
          this.moveJoystickActive = false;
          this.moveJoystickTouchId = null;
          this.moveVector = { x: 0, z: 0 };
          if (moveBase) moveBase.style.display = 'none';
          break;
        }
      }
    };
    moveZone.addEventListener('touchend', endMoveJoystick);
    moveZone.addEventListener('touchcancel', endMoveJoystick);

    // Right Look Zone
    lookZone.addEventListener('touchstart', (e) => {
      const touch = e.changedTouches[0];
      if (this.lookTouchId === null) {
        this.lookTouchId = touch.identifier;
        this.lastLookTouch = { x: touch.clientX, y: touch.clientY };
      }
    }, { passive: true });

    lookZone.addEventListener('touchmove', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.lookTouchId) {
          const dx = touch.clientX - this.lastLookTouch.x;
          const dy = touch.clientY - this.lastLookTouch.y;
          this.lastLookTouch = { x: touch.clientX, y: touch.clientY };

          const sensitivity = 0.004;
          this.yaw -= dx * sensitivity;
          this.pitch -= dy * sensitivity;

          const maxPitch = (Math.PI / 2) * 0.95;
          this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
          break;
        }
      }
    }, { passive: true });

    const endLook = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.lookTouchId) {
          this.lookTouchId = null;
          break;
        }
      }
    };
    // Action buttons for mobile
    this.setupMobileActionButtons();
  }

  public setupMobileActionButtons(): void {
    const sprintBtn = document.getElementById('btn-mobile-sprint');
    const jumpBtn = document.getElementById('btn-mobile-jump');
    const crouchBtn = document.getElementById('btn-mobile-crouch');

    if (sprintBtn) {
      sprintBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.mobileSprinting = !this.mobileSprinting;
        sprintBtn.classList.toggle('active', this.mobileSprinting);
      });
      sprintBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.mobileSprinting = !this.mobileSprinting;
        sprintBtn.classList.toggle('active', this.mobileSprinting);
      }, { passive: false });
    }

    if (jumpBtn) {
      jumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.mobileJumping = true;
      }, { passive: false });
      jumpBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.mobileJumping = false;
      }, { passive: false });
    }

    if (crouchBtn) {
      crouchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.mobileCrouching = !this.mobileCrouching;
        crouchBtn.classList.toggle('active', this.mobileCrouching);
      });
      crouchBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.mobileCrouching = !this.mobileCrouching;
        crouchBtn.classList.toggle('active', this.mobileCrouching);
      }, { passive: false });
    }
  }

  public getMovementInput(): { moveX: number; moveZ: number; isSprinting: boolean; isCrouching: boolean; isJumping: boolean } {
    let moveX = 0;
    let moveZ = 0;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveZ += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveZ -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveX += 1;

    // Merge mobile joystick if active
    if (this.moveJoystickActive) {
      moveX += this.moveVector.x;
      moveZ += this.moveVector.z;
    }

    // Normalize diagonal
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 1) {
      moveX /= len;
      moveZ /= len;
    }

    const isSprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.mobileSprinting;
    const isCrouching = this.keys.has('KeyC') || this.keys.has('ControlLeft') || this.mobileCrouching;
    const isJumping = this.keys.has('Space') || this.mobileJumping;

    return { moveX, moveZ, isSprinting, isCrouching, isJumping };
  }
}
