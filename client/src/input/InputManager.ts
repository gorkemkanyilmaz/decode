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

  // Right Look/Rotation Joystick state
  private lookJoystickActive: boolean = false;
  private lookJoystickTouchId: number | null = null;
  private lookVector: { x: number; y: number } = { x: 0, y: 0 };
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
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 820;

    this.setupDesktopControls();
    if (this.isMobile) {
      this.setupMobileControls();
    }

    window.addEventListener('resize', () => {
      if (window.innerWidth <= 820 && !this.isMobile) {
        this.isMobile = true;
        this.setupMobileControls();
      }
    });
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

    // Keep base permanently positioned and visible at bottom-left
    const getJoystickCenter = () => {
      if (!moveBase) return { x: 80, y: window.innerHeight - 80 };
      const rect = moveBase.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    };

    let joystickCenter = { x: 80, y: window.innerHeight - 80 };

    const startMove = (clientX: number, clientY: number, id: number | null) => {
      this.moveJoystickActive = true;
      this.moveJoystickTouchId = id;
      joystickCenter = getJoystickCenter();
      processMove(clientX, clientY);
    };

    const processMove = (clientX: number, clientY: number) => {
      if (!this.moveJoystickActive) return;

      const dx = clientX - joystickCenter.x;
      const dy = clientY - joystickCenter.y;
      const maxDist = 44;
      const actualDist = Math.sqrt(dx * dx + dy * dy);
      const clampedDist = Math.min(maxDist, actualDist);
      const angle = Math.atan2(dy, dx);

      const thumbX = Math.cos(angle) * clampedDist;
      const thumbY = Math.sin(angle) * clampedDist;

      if (moveThumb) {
        moveThumb.style.left = `calc(50% + ${thumbX}px)`;
        moveThumb.style.top = `calc(50% + ${thumbY}px)`;
      }

      // If dragged to edge (>= 80% deflection), sprint automatically!
      const deflection = actualDist / maxDist;
      if (deflection >= 0.80) {
        this.mobileSprinting = true;
        moveBase?.classList.add('sprinting');
      } else {
        this.mobileSprinting = false;
        moveBase?.classList.remove('sprinting');
      }

      // Normalized movement vector
      this.moveVector = {
        x: thumbX / maxDist,
        z: -(thumbY / maxDist) // Pull down = backward (+Z in local coords)
      };
    };

    const endMove = () => {
      this.moveJoystickActive = false;
      this.moveJoystickTouchId = null;
      this.moveVector = { x: 0, z: 0 };
      this.mobileSprinting = false;
      if (moveBase) {
        moveBase.classList.remove('sprinting');
      }
      if (moveThumb) {
        moveThumb.style.left = '50%';
        moveThumb.style.top = '50%';
      }
    };

    // Touch events for movement joystick
    moveZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      startMove(touch.clientX, touch.clientY, touch.identifier);
    }, { passive: false });

    moveZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.moveJoystickActive) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.moveJoystickTouchId) {
          processMove(touch.clientX, touch.clientY);
          break;
        }
      }
    }, { passive: false });

    moveZone.addEventListener('touchend', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.moveJoystickTouchId) {
          endMove();
          break;
        }
      }
    });

    moveZone.addEventListener('touchcancel', (e) => {
      endMove();
    });

    // Mouse fallback for joystick dragging
    moveZone.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startMove(e.clientX, e.clientY, null);
      const onMouseMove = (me: MouseEvent) => processMove(me.clientX, me.clientY);
      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        endMove();
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // Right Look / Rotation Joystick Zone
    const lookBase = document.getElementById('joystick-look-base');
    const lookThumb = document.getElementById('joystick-look-thumb');

    const getLookCenter = () => {
      if (!lookBase) return { x: window.innerWidth - 80, y: window.innerHeight - 80 };
      const rect = lookBase.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    };

    let lookCenter = { x: window.innerWidth - 80, y: window.innerHeight - 80 };

    const startLook = (clientX: number, clientY: number, id: number | null) => {
      this.lookJoystickActive = true;
      this.lookJoystickTouchId = id;
      this.lastLookTouch = { x: clientX, y: clientY };
      lookCenter = getLookCenter();
      processLook(clientX, clientY);
    };

    const processLook = (clientX: number, clientY: number) => {
      if (!this.lookJoystickActive) return;

      const dx = clientX - lookCenter.x;
      const dy = clientY - lookCenter.y;
      const maxDist = 44;
      const actualDist = Math.sqrt(dx * dx + dy * dy);
      const clampedDist = Math.min(maxDist, actualDist);
      const angle = Math.atan2(dy, dx);

      const thumbX = Math.cos(angle) * clampedDist;
      const thumbY = Math.sin(angle) * clampedDist;

      if (lookThumb) {
        lookThumb.style.left = `calc(50% + ${thumbX}px)`;
        lookThumb.style.top = `calc(50% + ${thumbY}px)`;
      }

      // Normalized look deflection vector for continuous rotation
      this.lookVector = {
        x: thumbX / maxDist,
        y: thumbY / maxDist
      };
    };

    const endLook = () => {
      this.lookJoystickActive = false;
      this.lookJoystickTouchId = null;
      this.lookVector = { x: 0, y: 0 };
      if (lookThumb) {
        lookThumb.style.left = '50%';
        lookThumb.style.top = '50%';
      }
    };

    lookZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      startLook(touch.clientX, touch.clientY, touch.identifier);
    }, { passive: false });

    lookZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.lookJoystickActive) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.lookJoystickTouchId) {
          processLook(touch.clientX, touch.clientY);
          break;
        }
      }
    }, { passive: false });

    lookZone.addEventListener('touchend', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.lookJoystickTouchId) {
          endLook();
          break;
        }
      }
    });

    lookZone.addEventListener('touchcancel', () => {
      endLook();
    });

    // Mouse fallback for right joystick
    lookZone.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startLook(e.clientX, e.clientY, null);
      const onMouseMove = (me: MouseEvent) => processLook(me.clientX, me.clientY);
      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        endLook();
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  public update(delta: number): void {
    if (this.lookJoystickActive) {
      // Rotate camera smoothly based on right joystick deflection
      const turnSpeed = 2.8; // radians per second for yaw
      const pitchSpeed = 1.9; // radians per second for pitch
      this.yaw -= this.lookVector.x * turnSpeed * delta;
      this.pitch -= this.lookVector.y * pitchSpeed * delta;

      const maxPitch = (Math.PI / 2) * 0.95;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    }
  }

  public setupMobileActionButtons(): void {
    // Mobile action buttons removed from design; auto-sprint handled by joystick
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
