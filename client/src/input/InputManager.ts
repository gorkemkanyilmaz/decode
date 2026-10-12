export interface InputState {
  moveX: number; // -1 to 1 (strafe)
  moveZ: number; // -1 to 1 (forward/backward)
  yaw: number;
  pitch: number;
  isSprinting: boolean;
  isCrouching: boolean;
  isJumping: boolean;
}

export interface PubgControlSettings {
  lookSensitivity: number; // Master look sensitivity: 0.2 - 3.0 (default 1.0)
  yawSensitivity: number; // Horizontal / Yaw (sağa sola dönme): 0.2 - 3.0 (default 1.0)
  pitchSensitivity: number; // Vertical / Pitch (yukarı aşağı): 0.2 - 3.0 (default 0.85)
  scopeSensitivity: number; // Scope / Zoom sensitivity: 0.2 - 2.5 (default 0.65)
  joystickDeadzone: number; // Ölü bölge: 0.05 - 0.35 (default 0.12)
  sprintThreshold: number; // Hızlı koşma eşiği: 0.55 - 0.95 (default 0.75)
  clawFireEnabled: boolean; // Sol ateş tuşu (Claw): true / false (default true)
  hapticFeedback: boolean; // Titreşim feedback: true / false (default true)
}

const DEFAULT_SETTINGS: PubgControlSettings = {
  lookSensitivity: 1.0,
  yawSensitivity: 1.0,
  pitchSensitivity: 0.85,
  scopeSensitivity: 0.65,
  joystickDeadzone: 0.12,
  sprintThreshold: 0.75,
  clawFireEnabled: true,
  hapticFeedback: true
};

const STORAGE_KEY = 'decoded_pubg_settings';

export class InputManager {
  private keys: Set<string> = new Set();
  public yaw: number = 0;
  public pitch: number = 0;
  public isLocked: boolean = false;
  public isMobile: boolean = false;
  public isZoomed: boolean = false;

  // PUBG Control Settings
  public settings: PubgControlSettings = { ...DEFAULT_SETTINGS };

  // Left Mobile Virtual Joystick State (PUBG Floating & Sprint-Lock)
  private moveJoystickActive: boolean = false;
  private moveJoystickTouchId: number | null = null;
  private moveJoystickCenter: { x: number; y: number } = { x: 90, y: 0 };
  private moveVector: { x: number; z: number } = { x: 0, z: 0 };
  private isSprintLocked: boolean = false;

  // Right Free Camera Swipe State (PUBG Precision Touch Aim)
  private lookTouchId: number | null = null;
  private lastLookPos: { x: number; y: number } = { x: 0, y: 0 };

  // Mobile Action Button States
  public mobileSprinting: boolean = false;
  public mobileCrouching: boolean = false;
  public mobileJumping: boolean = false;

  // Callbacks
  public onDecodeToggle: (() => void) | null = null;
  public onScopeToggle: (() => void) | null = null;
  public onSmokeUse: (() => void) | null = null;
  public onOpenSettings: (() => void) | null = null;
  public onGadgetUse: ((slot: number) => void) | null = null;
  public onDebugToggle: ((key: string) => void) | null = null;

  private canvas: HTMLElement;
  private orientationDismissed: boolean = false;

  constructor(canvas: HTMLElement) {
    this.canvas = canvas;
    this.loadSettings();

    this.isMobile =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth <= 1024 ||
      window.innerHeight <= 650;

    this.setupDesktopControls();
    this.setupMobileControls();
    this.setupOrientationHandler();

    window.addEventListener('resize', () => {
      const mobileCheck =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.innerWidth <= 1024 ||
        window.innerHeight <= 650;
      if (mobileCheck !== this.isMobile) {
        this.isMobile = mobileCheck;
        this.updateControlsVisibility();
      }
      this.checkOrientation();
    });
  }

  // =========================================================
  // Settings Management (PUBG Presets & LocalStorage)
  // =========================================================
  public loadSettings(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  public saveSettings(newSettings?: Partial<PubgControlSettings>): void {
    if (newSettings) {
      this.settings = { ...this.settings, ...newSettings };
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Could not save settings to localStorage:', e);
    }
    this.applySettingsToUI();
  }

  public resetSettingsToDefaults(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveSettings();
  }

  public applyPreset(preset: 'low' | 'medium' | 'high'): void {
    if (preset === 'low') {
      this.settings = {
        ...this.settings,
        lookSensitivity: 0.65,
        yawSensitivity: 0.7,
        pitchSensitivity: 0.6,
        scopeSensitivity: 0.45,
        joystickDeadzone: 0.15,
        sprintThreshold: 0.8
      };
    } else if (preset === 'medium') {
      this.settings = {
        ...this.settings,
        lookSensitivity: 1.0,
        yawSensitivity: 1.0,
        pitchSensitivity: 0.85,
        scopeSensitivity: 0.65,
        joystickDeadzone: 0.12,
        sprintThreshold: 0.75
      };
    } else if (preset === 'high') {
      this.settings = {
        ...this.settings,
        lookSensitivity: 1.55,
        yawSensitivity: 1.6,
        pitchSensitivity: 1.3,
        scopeSensitivity: 1.0,
        joystickDeadzone: 0.08,
        sprintThreshold: 0.7
      };
    }
    this.saveSettings();
  }

  private applySettingsToUI(): void {
    const clawBtn = document.getElementById('btn-touch-claw-fire');
    if (clawBtn) {
      clawBtn.style.display = this.settings.clawFireEnabled ? 'flex' : 'none';
    }
  }

  private triggerHaptic(durationMs: number = 15): void {
    if (this.settings.hapticFeedback && 'vibrate' in navigator) {
      try {
        navigator.vibrate(durationMs);
      } catch (e) {
        // Ignored
      }
    }
  }

  // =========================================================
  // Desktop Controls
  // =========================================================
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
      } else if (
        e.code.startsWith('F') &&
        parseInt(e.code.substring(1)) >= 1 &&
        parseInt(e.code.substring(1)) <= 7
      ) {
        e.preventDefault();
        this.onDebugToggle?.(e.code);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

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
      const zoomFactor = this.isZoomed ? this.settings.scopeSensitivity : 1.0;
      const sensitivity = 0.0022 * this.settings.lookSensitivity * zoomFactor;
      this.yaw -= e.movementX * sensitivity * this.settings.yawSensitivity;
      this.pitch -= e.movementY * sensitivity * this.settings.pitchSensitivity;

      const maxPitch = (Math.PI / 2) * 0.92;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    });
  }

  // =========================================================
  // PUBG Mobile Controls (Dual-Touch / Virtual Joystick + Look + Buttons)
  // =========================================================
  private setupMobileControls(): void {
    this.updateControlsVisibility();
    this.applySettingsToUI();

    const moveZone = document.getElementById('joystick-move-zone');
    const moveBase = document.getElementById('joystick-move-base');
    const moveThumb = document.getElementById('joystick-move-thumb');
    const sprintLockTarget = document.getElementById('joystick-sprint-lock');
    const lookZone = document.getElementById('touch-look-zone');
    const touchControls = document.getElementById('touch-controls');

    if (!moveZone || !lookZone || !moveBase || !moveThumb) return;

    // Default anchor position for the virtual joystick (bottom-left)
    const defaultCenter = () => {
      const baseRadius = 48;
      const margin = 26;
      return {
        x: baseRadius + margin, // ~74px
        y: Math.max(120, window.innerHeight - baseRadius - margin) // ~innerHeight - 74px
      };
    };

    const setBasePosition = (cx: number, cy: number) => {
      moveBase.style.left = `${cx}px`;
      moveBase.style.top = `${cy}px`;
      moveBase.style.bottom = 'auto';
      moveBase.style.transform = 'translate(-50%, -50%)';
    };

    const resetBasePosition = () => {
      const def = defaultCenter();
      this.moveJoystickCenter = def;
      setBasePosition(def.x, def.y);
      moveThumb.style.transform = 'translate(0px, 0px)';
      moveBase.classList.remove('sprinting');
      if (!this.isSprintLocked) {
        moveBase.classList.remove('sprint-locked');
      }
    };

    resetBasePosition();
    window.addEventListener('resize', resetBasePosition);

    // -------------------------------------------------------
    // 1. LEFT VIRTUAL JOYSTICK MOVEMENT ENGINE
    // -------------------------------------------------------
    const startMove = (clientX: number, clientY: number, id: number | null) => {
      // If sprint lock was active, touching joystick area cancels it
      if (this.isSprintLocked) {
        this.isSprintLocked = false;
        moveBase.classList.remove('sprint-locked');
      }

      this.moveJoystickActive = true;
      this.moveJoystickTouchId = id;

      const def = defaultCenter();
      const distFromAnchor = Math.hypot(clientX - def.x, clientY - def.y);

      // If user touches near default anchor (< 85px), keep base locked there!
      // If user touches further away in the left zone, dynamically position base under thumb
      if (distFromAnchor <= 85) {
        this.moveJoystickCenter = def;
        setBasePosition(def.x, def.y);
      } else {
        const baseRadius = 48;
        const minX = baseRadius + 24;
        const maxX = Math.min(window.innerWidth * 0.45, 260);
        const minY = 110;
        const maxY = Math.max(120, window.innerHeight - baseRadius - 24);

        const clampedX = Math.max(minX, Math.min(maxX, clientX));
        const clampedY = Math.max(minY, Math.min(maxY, clientY));

        this.moveJoystickCenter = { x: clampedX, y: clampedY };
        setBasePosition(clampedX, clampedY);
      }

      processMove(clientX, clientY);
    };

    const processMove = (clientX: number, clientY: number) => {
      if (!this.moveJoystickActive) return;

      const dx = clientX - this.moveJoystickCenter.x;
      const dy = clientY - this.moveJoystickCenter.y;
      const maxDist = 44;
      const actualDist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const clampedDist = Math.min(maxDist, actualDist);

      const thumbX = Math.cos(angle) * clampedDist;
      const thumbY = Math.sin(angle) * clampedDist;

      moveThumb.style.transform = `translate(${thumbX}px, ${thumbY}px)`;

      // Auto-Sprint / Koşma Kilidi Detection
      const rawDeflection = actualDist / maxDist;
      const isUpwards = dy < -24;

      if (isUpwards && rawDeflection >= this.settings.sprintThreshold) {
        this.mobileSprinting = true;
        moveBase.classList.add('sprinting');

        // Pulled straight up into the sprint lock icon (> 56px vertical pull)
        if (dy < -56) {
          if (!this.isSprintLocked) {
            this.isSprintLocked = true;
            moveBase.classList.add('sprint-locked');
            this.triggerHaptic(20);
          }
        }
      } else if (!this.isSprintLocked) {
        this.mobileSprinting = false;
        moveBase.classList.remove('sprinting');
      }

      // Normalized Movement Vector with Deadzone Handling
      const deadzone = this.settings.joystickDeadzone;
      if (rawDeflection <= deadzone) {
        this.moveVector = { x: 0, z: 0 };
      } else {
        const normalized = Math.min(1.0, (rawDeflection - deadzone) / (1.0 - deadzone));
        // Power curve (1.15) for smooth walking transition to running
        const curved = Math.pow(normalized, 1.15);
        this.moveVector = {
          x: (thumbX / maxDist) * curved,
          z: -((thumbY / maxDist) * curved) // Pulling up (dy < 0) = forward (+Z)
        };
      }
    };

    const endMove = () => {
      this.moveJoystickActive = false;
      this.moveJoystickTouchId = null;

      if (!this.isSprintLocked) {
        this.moveVector = { x: 0, z: 0 };
        this.mobileSprinting = false;
        resetBasePosition();
      } else {
        // Sprint is locked: keep moving forward!
        this.moveVector = { x: 0, z: 1.0 };
        this.mobileSprinting = true;
        moveThumb.style.transform = 'translate(0px, 0px)';
      }
    };

    // -------------------------------------------------------
    // 2. RIGHT FREE LOOK / CAMERA SWIPE ENGINE (PUBG Mobile Precision)
    // -------------------------------------------------------
    const startLook = (clientX: number, clientY: number, id: number | null) => {
      this.lookTouchId = id;
      this.lastLookPos = { x: clientX, y: clientY };
    };

    const processLook = (clientX: number, clientY: number) => {
      if (this.lookTouchId === null) return;

      const deltaX = clientX - this.lastLookPos.x;
      const deltaY = clientY - this.lastLookPos.y;
      this.lastLookPos = { x: clientX, y: clientY };

      // Tuned for natural, responsive PUBG Mobile camera rotation speed
      const baseSensitivity = 0.0085;
      const zoomFactor = this.isZoomed ? this.settings.scopeSensitivity : 1.0;

      const sensX =
        baseSensitivity *
        this.settings.lookSensitivity *
        this.settings.yawSensitivity *
        zoomFactor;
      const sensY =
        baseSensitivity *
        this.settings.lookSensitivity *
        this.settings.pitchSensitivity *
        zoomFactor;

      this.yaw -= deltaX * sensX;
      this.pitch -= deltaY * sensY;

      // Clamped vertical pitch (no neck snap / flip)
      const maxPitch = (Math.PI / 2) * 0.88;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    };

    const endLook = () => {
      this.lookTouchId = null;
    };

    // -------------------------------------------------------
    // 3. UNIFIED MULTI-TOUCH EVENT DISPATCHER
    // -------------------------------------------------------
    const onTouchStart = (e: TouchEvent) => {
      const splitX = window.innerWidth * 0.48;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const target = touch.target as HTMLElement | null;

        // Ignore touches that hit tactical action buttons (let buttons handle them)
        if (target && target.closest('.pubg-touch-btn')) {
          continue;
        }

        if (touch.clientX < splitX) {
          // Left side: Movement Joystick
          if (this.moveJoystickTouchId === null) {
            startMove(touch.clientX, touch.clientY, touch.identifier);
          }
        } else {
          // Right side: Camera Free Look
          if (this.lookTouchId === null) {
            startLook(touch.clientX, touch.clientY, touch.identifier);
          }
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      // Prevent browser default pull-to-refresh or swipe navigation
      if (this.moveJoystickTouchId !== null || this.lookTouchId !== null) {
        e.preventDefault();
      }

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.moveJoystickTouchId) {
          processMove(touch.clientX, touch.clientY);
        } else if (touch.identifier === this.lookTouchId) {
          processLook(touch.clientX, touch.clientY);
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.moveJoystickTouchId) {
          endMove();
        } else if (touch.identifier === this.lookTouchId) {
          endLook();
        }
      }

      // Safety check: if all touches are released, ensure everything is clean
      if (e.touches.length === 0) {
        if (this.lookTouchId !== null) endLook();
        if (this.moveJoystickActive) endMove();
      }
    };

    // Attach touch listeners to touchControls container and window
    if (touchControls) {
      touchControls.addEventListener('touchstart', onTouchStart, { passive: false });
    }
    moveZone.addEventListener('touchstart', onTouchStart, { passive: false });
    lookZone.addEventListener('touchstart', onTouchStart, { passive: false });

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onTouchEnd, { passive: false });

    // Desktop mouse fallback for testing joystick with mouse
    moveZone.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startMove(e.clientX, e.clientY, null);
      const onMM = (me: MouseEvent) => processMove(me.clientX, me.clientY);
      const onMU = () => {
        window.removeEventListener('mousemove', onMM);
        window.removeEventListener('mouseup', onMU);
        endMove();
      };
      window.addEventListener('mousemove', onMM);
      window.addEventListener('mouseup', onMU);
    });

    // -------------------------------------------------------
    // 4. PUBG ACTION BUTTONS
    // -------------------------------------------------------
    this.setupTacticalButtons();
  }

  private setupTacticalButtons(): void {
    // Helper to attach touch & click listeners with haptic & sound
    const bindTouchAction = (
      elementId: string,
      onDown: () => void,
      onUp?: () => void
    ) => {
      const btn = document.getElementById(elementId);
      if (!btn) return;

      const handleDown = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.add('active');
        onDown();
      };

      const handleUp = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.remove('active');
        onUp?.();
      };

      btn.addEventListener('touchstart', handleDown, { passive: false });
      btn.addEventListener('touchend', handleUp, { passive: false });
      btn.addEventListener('touchcancel', handleUp, { passive: false });

      btn.addEventListener('mousedown', handleDown);
      btn.addEventListener('mouseup', handleUp);
      btn.addEventListener('mouseleave', handleUp);
    };

    // Primary Decode Button (Large PUBG Fire Button)
    bindTouchAction('btn-touch-decode', () => {
      this.triggerHaptic(25);
      this.onDecodeToggle?.();
    });

    // Left Claw Fire / Decode Button
    bindTouchAction('btn-touch-claw-fire', () => {
      this.triggerHaptic(25);
      this.onDecodeToggle?.();
    });

    // Jump Button
    bindTouchAction(
      'btn-touch-jump',
      () => {
        this.triggerHaptic(20);
        this.mobileJumping = true;
      },
      () => {
        this.mobileJumping = false;
      }
    );

    // Crouch Button (Toggle state with visual indicator)
    const crouchBtn = document.getElementById('btn-touch-crouch');
    bindTouchAction('btn-touch-crouch', () => {
      this.triggerHaptic(18);
      this.mobileCrouching = !this.mobileCrouching;
      if (crouchBtn) {
        crouchBtn.classList.toggle('toggled', this.mobileCrouching);
      }
    });

    // Scope / Binoculars Zoom Button
    bindTouchAction('btn-touch-scope', () => {
      this.triggerHaptic(20);
      this.onScopeToggle?.();
    });

    // Smoke / Tactical Gadget Button
    bindTouchAction('btn-touch-smoke', () => {
      this.triggerHaptic(22);
      this.onSmokeUse?.();
    });

    // Control Sensitivity Settings Button
    bindTouchAction('btn-touch-settings', () => {
      this.triggerHaptic(15);
      this.onOpenSettings?.();
    });
  }

  // =========================================================
  // Landscape Orientation Warning & Enforcement Overlay
  // =========================================================
  private setupOrientationHandler(): void {
    const overlay = document.getElementById('orientation-warning-overlay');
    const fullscreenBtn = document.getElementById('btn-orientation-fullscreen');
    const dismissBtn = document.getElementById('btn-orientation-dismiss');

    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', async () => {
        this.triggerHaptic(25);
        try {
          if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
          }
          if (screen.orientation && (screen.orientation as any).lock) {
            await (screen.orientation as any).lock('landscape');
          }
        } catch (err) {
          console.log('Fullscreen/Orientation lock:', err);
        }
      });
    }

    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        this.triggerHaptic(15);
        this.orientationDismissed = true;
        if (overlay) {
          overlay.classList.add('force-dismissed');
        }
      });
    }

    if (screen.orientation) {
      screen.orientation.addEventListener('change', () => {
        this.checkOrientation();
      });
    }

    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.checkOrientation(), 100);
    });

    this.checkOrientation();
  }

  public checkOrientation(): void {
    const overlay = document.getElementById('orientation-warning-overlay');
    if (!overlay) return;

    if (this.orientationDismissed) {
      overlay.classList.add('force-dismissed');
      return;
    }

    // A device is in portrait if height > width
    const isPortrait = window.innerHeight > window.innerWidth;
    const isTouchOrMobile =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth <= 1024;

    if (isPortrait && isTouchOrMobile) {
      overlay.classList.remove('force-dismissed');
      overlay.classList.add('visible');
    } else {
      overlay.classList.remove('visible');
    }
  }

  // =========================================================
  // Controls Visibility & Game Lifecycle
  // =========================================================
  public setTouchControlsVisible(visible: boolean): void {
    const controls = document.getElementById('touch-controls');
    if (controls) {
      const isMobileNow =
        this.isMobile ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.innerWidth <= 1024 ||
        window.innerHeight <= 650;

      if (visible && isMobileNow) {
        controls.classList.remove('hidden');
      } else {
        controls.classList.add('hidden');
      }
    }
  }

  private updateControlsVisibility(): void {
    this.setTouchControlsVisible(this.isMobile);
  }

  public update(delta: number): void {
    // Mobile direct swipe look is instantaneous; update hook reserved for damping if needed
  }

  public setupMobileActionButtons(): void {
    this.setupTacticalButtons();
  }

  public getMovementInput(): {
    moveX: number;
    moveZ: number;
    isSprinting: boolean;
    isCrouching: boolean;
    isJumping: boolean;
  } {
    let moveX = 0;
    let moveZ = 0;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveZ += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveZ -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveX += 1;

    // Merge mobile joystick movement vector
    if (this.moveJoystickActive) {
      moveX += this.moveVector.x;
      moveZ += this.moveVector.z;
    } else if (this.isSprintLocked) {
      moveZ += 1.0;
    }

    // Normalize diagonal velocity
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 1) {
      moveX /= len;
      moveZ /= len;
    }

    const isSprinting =
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      this.mobileSprinting ||
      this.isSprintLocked;
    const isCrouching =
      this.keys.has('KeyC') ||
      this.keys.has('ControlLeft') ||
      this.mobileCrouching;
    const isJumping = this.keys.has('Space') || this.mobileJumping;

    return { moveX, moveZ, isSprinting, isCrouching, isJumping };
  }
}
