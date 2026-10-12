import { GameMode, PlayerPublicInfo, GadgetType } from '@shared/types/game';
import { GAME_CONSTANTS } from '@shared/constants/game';
import { SoundSystem } from '../audio/SoundSystem';

export class UIManager {
  private root: HTMLElement;
  private sound: SoundSystem;

  // Active state
  public playerName: string = 'Agent_' + Math.floor(100 + Math.random() * 900);
  public playerColor: string = '#3B82F6';
  public playerAccessory: 'fedora' | 'cap' | 'headset' | 'goggles' | 'none' = 'fedora';
  public gameMode: GameMode = 'deathmatch';

  public isKeypadOpen: boolean = false;
  public keypadInput: string = '';
  public currentTargetId: string = '';
  public currentTargetName: string = '';

  private cooldownTimerInterval: number | null = null;
  private cooldownRemaining: number = 0;

  // Callbacks to Game Controller
  public onCreateRoom: (() => void) | null = null;
  public onJoinRoom: ((code: string) => void) | null = null;
  public onSetReady: ((ready: boolean) => void) | null = null;
  public onStartGame: (() => void) | null = null;
  public onNumberSelected: ((num: string) => void) | null = null;
  public onEliminationAttempt: ((targetId: string, num: string) => void) | null = null;
  public onGadgetClick: ((gadget: GadgetType) => void) | null = null;
  public onQualityChange: ((quality: 'low' | 'medium' | 'high') => void) | null = null;
  public onOpenSensitivitySettings: (() => void) | null = null;
  public onKeypadToggle: ((isOpen: boolean) => void) | null = null;

  private gadgetCooldowns: Map<string, number> = new Map();

  constructor(sound: SoundSystem) {
    this.root = document.getElementById('ui-root')!;
    this.sound = sound;

    this.setupGlobalKeypadListener();
  }

  private setupGlobalKeypadListener(): void {
    window.addEventListener('keydown', (e) => {
      if (!this.isKeypadOpen) return;

      if (e.key >= '0' && e.key <= '9') {
        this.addKeypadDigit(e.key);
      } else if (e.key === 'Backspace') {
        this.removeKeypadDigit();
      } else if (e.key === 'Enter') {
        this.submitKeypadElimination();
      } else if (e.key === 'Escape') {
        this.closeKeypad();
      }
    });
  }

  public showMainMenu(): void {
    this.root.innerHTML = `
      <div class="screen-overlay">
        <div class="glass-card interactive menu-widescreen-card">
          <div class="menu-layout-grid">
            <!-- Left Column: Identity & Customization -->
            <div class="menu-col menu-col-profile">
              <div class="menu-brand-header">
                <h1 class="game-logo">DECODED</h1>
                <p class="game-tagline">3D Number Hunt &bull; Read &bull; Eliminate</p>
              </div>

              <div class="input-group compact">
                <label class="input-label">Agent Codename</label>
                <input type="text" id="menu-name-input" class="text-input" value="${this.playerName}" maxlength="14" />
              </div>

              <div class="input-group compact">
                <label class="input-label">Identity Color</label>
                <div class="swatches compact" id="color-swatches">
                  ${GAME_CONSTANTS.COLOR_PALETTE.map(
                    (c) => `<div class="swatch ${c === this.playerColor ? 'selected' : ''}" style="background-color: ${c}" data-color="${c}"></div>`
                  ).join('')}
                </div>
              </div>

              <div class="input-group compact">
                <label class="input-label">Tactical Accessory</label>
                <div class="accessory-options compact" id="accessory-options">
                  <button class="accessory-btn ${this.playerAccessory === 'fedora' ? 'selected' : ''}" data-acc="fedora">Fedora</button>
                  <button class="accessory-btn ${this.playerAccessory === 'cap' ? 'selected' : ''}" data-acc="cap">Cap</button>
                  <button class="accessory-btn ${this.playerAccessory === 'headset' ? 'selected' : ''}" data-acc="headset">Headset</button>
                  <button class="accessory-btn ${this.playerAccessory === 'none' ? 'selected' : ''}" data-acc="none">None</button>
                </div>
              </div>
            </div>

            <div class="menu-grid-divider"></div>

            <!-- Right Column: Mission Modes & Matchmaking -->
            <div class="menu-col menu-col-match">
              <div class="input-group compact">
                <label class="input-label">Mission Game Mode</label>
                <div class="accessory-options compact" id="mode-options">
                  <button class="accessory-btn ${this.gameMode === 'deathmatch' ? 'selected' : ''}" data-mode="deathmatch">Deathmatch</button>
                  <button class="accessory-btn ${this.gameMode === 'team_hunt' ? 'selected' : ''}" data-mode="team_hunt">Team Hunt</button>
                  <button class="accessory-btn ${this.gameMode === 'last_standing' ? 'selected' : ''}" data-mode="last_standing">Last Standing</button>
                </div>
              </div>

              <div id="menu-error-banner" style="display: none; color: #ff6b6b; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 8px; padding: 6px 10px; margin-bottom: 8px; font-size: 0.8rem; text-align: center;"></div>

              <div class="menu-action-btns">
                <button id="btn-create-room" class="btn btn-primary btn-room-action">🚀 Create Room</button>
                <button id="btn-join-room-modal" class="btn btn-secondary btn-room-action">🔑 Join Room</button>
              </div>

              <div class="menu-sub-actions">
                <button id="btn-instructions" class="btn btn-secondary btn-sub-action">❓ How To Play</button>
                <button id="btn-settings" class="btn btn-secondary btn-sub-action">🖥️ Graphics</button>
                <button id="btn-menu-sens" class="btn btn-secondary btn-sub-action btn-sens-highlight">⚙️ PUBG Hassasiyet</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    const nameInput = document.getElementById('menu-name-input') as HTMLInputElement;
    nameInput?.addEventListener('input', () => {
      this.playerName = nameInput.value.trim() || 'Agent';
    });

    document.querySelectorAll('#color-swatches .swatch').forEach((swatch) => {
      swatch.addEventListener('click', (e) => {
        const col = (e.currentTarget as HTMLElement).dataset.color!;
        this.playerColor = col;
        document.querySelectorAll('#color-swatches .swatch').forEach((s) => s.classList.remove('selected'));
        (e.currentTarget as HTMLElement).classList.add('selected');
        this.sound.playKeypadClick(1);
      });
    });

    document.querySelectorAll('#accessory-options .accessory-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.playerAccessory = (e.currentTarget as HTMLElement).dataset.acc as any;
        document.querySelectorAll('#accessory-options .accessory-btn').forEach((b) => b.classList.remove('selected'));
        (e.currentTarget as HTMLElement).classList.add('selected');
        this.sound.playKeypadClick(2);
      });
    });

    document.querySelectorAll('#mode-options .accessory-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.gameMode = (e.currentTarget as HTMLElement).dataset.mode as GameMode;
        document.querySelectorAll('#mode-options .accessory-btn').forEach((b) => b.classList.remove('selected'));
        (e.currentTarget as HTMLElement).classList.add('selected');
        this.sound.playKeypadClick(3);
      });
    });

    document.getElementById('btn-create-room')?.addEventListener('click', () => {
      this.sound.playKeypadClick(4);
      const btn = document.getElementById('btn-create-room') as HTMLButtonElement | null;
      if (btn) {
        btn.disabled = true;
        btn.innerText = 'Creating Room...';
      }
      const banner = document.getElementById('menu-error-banner');
      if (banner) banner.style.display = 'none';
      this.onCreateRoom?.();
    });

    document.getElementById('btn-join-room-modal')?.addEventListener('click', () => {
      this.sound.playKeypadClick(5);
      this.showJoinModal();
    });

    document.getElementById('btn-instructions')?.addEventListener('click', () => {
      this.showInstructionsModal();
    });

    document.getElementById('btn-settings')?.addEventListener('click', () => {
      this.showSettingsModal();
    });

    document.getElementById('btn-menu-sens')?.addEventListener('click', () => {
      this.sound.playKeypadClick(6);
      this.onOpenSensitivitySettings?.();
    });
  }

  public showMenuError(message: string): void {
    const banner = document.getElementById('menu-error-banner');
    if (banner) {
      banner.textContent = message;
      banner.style.display = 'block';
    } else {
      alert(message);
    }
    const createBtn = document.getElementById('btn-create-room') as HTMLButtonElement | null;
    if (createBtn) {
      createBtn.disabled = false;
      createBtn.innerText = 'Create Room';
    }
    const joinBtn = document.getElementById('btn-submit-join') as HTMLButtonElement | null;
    if (joinBtn) {
      joinBtn.disabled = false;
      joinBtn.innerText = 'Connect';
    }
  }

  public showJoinModal(): void {
    const modal = document.createElement('div');
    modal.className = 'decode-modal';
    modal.innerHTML = `
      <div class="glass-card interactive" style="max-width: 400px;">
        <h2 style="font-size: 1.6rem; margin-bottom: 12px;">JOIN ARENA</h2>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 18px;">Enter the 5-character room code from your squad leader</p>
        <div class="input-group">
          <input type="text" id="join-code-input" class="text-input" placeholder="e.g. X7K9P" maxlength="5" style="text-align: center; font-family: var(--font-mono); font-size: 1.6rem; letter-spacing: 4px; text-transform: uppercase;" />
        </div>
        <div style="display: flex; gap: 12px; margin-top: 20px;">
          <button id="btn-submit-join" class="btn btn-primary" style="flex: 1;">Connect</button>
          <button id="btn-cancel-join" class="btn btn-secondary" style="flex: 1;">Cancel</button>
        </div>
      </div>
    `;
    this.root.appendChild(modal);

    const input = modal.querySelector('#join-code-input') as HTMLInputElement;
    input.focus();

    modal.querySelector('#btn-submit-join')?.addEventListener('click', () => {
      const code = input.value.trim().toUpperCase();
      if (code.length > 0) {
        modal.remove();
        this.onJoinRoom?.(code);
      }
    });

    modal.querySelector('#btn-cancel-join')?.addEventListener('click', () => {
      modal.remove();
    });
  }

  public showInstructionsModal(): void {
    const modal = document.createElement('div');
    modal.className = 'decode-modal';
    modal.innerHTML = `
      <div class="glass-card interactive" style="max-width: 500px; text-align: left;">
        <h2 style="font-size: 1.6rem; color: var(--accent-cyan); margin-bottom: 12px;">MISSION RULES</h2>
        <ul style="color: var(--text-main); font-size: 0.9rem; line-height: 1.6; margin-bottom: 20px; padding-left: 20px;">
          <li>Every agent has a <strong>4-digit secret number</strong> on their forehead.</li>
          <li>Opponents' numbers can only be read when their <strong>forehead faces you</strong> and line-of-sight is unobstructed!</li>
          <li>Turn around or duck behind crates to <strong>protect your cipher</strong>.</li>
          <li>Aim at an opponent and press <strong>[E]</strong> or <strong>DECODE</strong> to type their 4 digits.</li>
          <li>Correct guess = <strong>Instant Elimination</strong> (+100 pts). Wrong guess = <strong>5-second security penalty</strong>!</li>
          <li>Gadgets: [1] Smoke, [2] Flashbang, [3] Spy Camera (snaps target code!), [4] Binoculars (3x Zoom).</li>
        </ul>
        <button id="btn-close-instructions" class="btn btn-primary" style="width: 100%;">Understood, Agent</button>
      </div>
    `;
    this.root.appendChild(modal);
    modal.querySelector('#btn-close-instructions')?.addEventListener('click', () => modal.remove());
  }

  public showSettingsModal(): void {
    const modal = document.createElement('div');
    modal.className = 'decode-modal';
    modal.innerHTML = `
      <div class="glass-card interactive" style="max-width: 420px;">
        <h2 style="font-size: 1.5rem; margin-bottom: 16px;">OYUN AYARLARI</h2>
        
        <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px; text-align: left;">GRAFİK KALİTESİ:</div>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
          <button class="btn btn-secondary quality-opt" data-q="low">DÜŞÜK (Mobil / Maksimum FPS)</button>
          <button class="btn btn-secondary quality-opt" data-q="medium">ORTA (Dengeli)</button>
          <button class="btn btn-primary quality-opt" data-q="high">YÜKSEK (Tam Gölgeler & Sis)</button>
        </div>

        <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); margin: 14px 0;"></div>

        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px;">
          <button id="btn-modal-open-sens" class="btn btn-primary" style="background: linear-gradient(135deg, #00f0ff 0%, #3b82f6 100%); color: #000; font-weight: 700;">
            ⚙️ PUBG KONTROL & HASSASİYET AYARLARI
          </button>
        </div>

        <button id="btn-close-settings" class="btn btn-secondary" style="width: 100%;">Geri Dön</button>
      </div>
    `;
    this.root.appendChild(modal);

    modal.querySelectorAll('.quality-opt').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const q = (e.currentTarget as HTMLElement).dataset.q as any;
        this.onQualityChange?.(q);
        modal.remove();
      });
    });

    modal.querySelector('#btn-modal-open-sens')?.addEventListener('click', () => {
      modal.remove();
      this.onOpenSensitivitySettings?.();
    });

    modal.querySelector('#btn-close-settings')?.addEventListener('click', () => modal.remove());
  }

  public showSensitivityModal(inputManager?: any): void {
    if (!inputManager) {
      this.onOpenSensitivitySettings?.();
      return;
    }

    // Remove any previously open sensitivity modal
    document.getElementById('pubg-sensitivity-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'pubg-sensitivity-modal';
    modal.className = 'decode-modal pubg-settings-modal';

    const s = inputManager.settings;

    modal.innerHTML = `
      <div class="glass-card interactive pubg-settings-card">
        <div class="settings-modal-header">
          <div class="settings-header-title">
            <span class="settings-icon">⚙️</span>
            <h3>PUBG KONTROL & HASSASİYET</h3>
          </div>
          <button class="settings-close-x" id="btn-sens-close-x">✕</button>
        </div>

        <!-- Presets Selector -->
        <div class="pubg-presets-bar">
          <span class="preset-label">HAZIR PROFİL:</span>
          <div class="preset-btns-group">
            <button class="btn-preset" data-preset="low">Düşük</button>
            <button class="btn-preset active" data-preset="medium">Orta (PUBG)</button>
            <button class="btn-preset" data-preset="high">Yüksek (Hızlı)</button>
          </div>
        </div>

        <!-- Sliders Grid -->
        <div class="settings-sliders-grid">
          <div class="slider-control-group">
            <div class="slider-info">
              <label class="slider-label">👁️ Genel Kamera Hassasiyeti</label>
              <span class="slider-val-badge" id="val-sens-look">${Math.round(s.lookSensitivity * 100)}%</span>
            </div>
            <input type="range" class="pubg-slider" id="slider-sens-look" min="20" max="300" step="5" value="${Math.round(s.lookSensitivity * 100)}" />
          </div>

          <div class="slider-control-group">
            <div class="slider-info">
              <label class="slider-label">↔️ Sağa / Sola Dönüş (Yatay Yaw)</label>
              <span class="slider-val-badge" id="val-sens-yaw">${Math.round(s.yawSensitivity * 100)}%</span>
            </div>
            <input type="range" class="pubg-slider" id="slider-sens-yaw" min="20" max="300" step="5" value="${Math.round(s.yawSensitivity * 100)}" />
          </div>

          <div class="slider-control-group">
            <div class="slider-info">
              <label class="slider-label">↕️ Yukarı / Aşağı Bakış (Dikey Pitch)</label>
              <span class="slider-val-badge" id="val-sens-pitch">${Math.round(s.pitchSensitivity * 100)}%</span>
            </div>
            <input type="range" class="pubg-slider" id="slider-sens-pitch" min="20" max="300" step="5" value="${Math.round(s.pitchSensitivity * 100)}" />
          </div>

          <div class="slider-control-group">
            <div class="slider-info">
              <label class="slider-label">🔭 Dürbün / Zoom Hassasiyeti</label>
              <span class="slider-val-badge" id="val-sens-scope">${Math.round(s.scopeSensitivity * 100)}%</span>
            </div>
            <input type="range" class="pubg-slider" id="slider-sens-scope" min="20" max="250" step="5" value="${Math.round(s.scopeSensitivity * 100)}" />
          </div>

          <div class="slider-control-group">
            <div class="slider-info">
              <label class="slider-label">🕹️ Joystick Ölü Bölge (Deadzone)</label>
              <span class="slider-val-badge" id="val-sens-deadzone">${Math.round(s.joystickDeadzone * 100)}%</span>
            </div>
            <input type="range" class="pubg-slider" id="slider-sens-deadzone" min="5" max="35" step="1" value="${Math.round(s.joystickDeadzone * 100)}" />
          </div>

          <div class="slider-control-group">
            <div class="slider-info">
              <label class="slider-label">🏃 Hızlı Koşma Tetik Eşiği</label>
              <span class="slider-val-badge" id="val-sens-sprint">${Math.round(s.sprintThreshold * 100)}%</span>
            </div>
            <input type="range" class="pubg-slider" id="slider-sens-sprint" min="50" max="95" step="5" value="${Math.round(s.sprintThreshold * 100)}" />
          </div>
        </div>

        <!-- Toggles Row -->
        <div class="settings-toggles-row">
          <label class="pubg-toggle-item">
            <input type="checkbox" id="toggle-sens-claw" ${s.clawFireEnabled ? 'checked' : ''} />
            <span class="toggle-custom"></span>
            <span class="toggle-text">Sol Ateş / Dekod Tuşu (Claw Grip)</span>
          </label>
          <label class="pubg-toggle-item">
            <input type="checkbox" id="toggle-sens-haptic" ${s.hapticFeedback ? 'checked' : ''} />
            <span class="toggle-custom"></span>
            <span class="toggle-text">Dokunma Titreşimi (Haptic)</span>
          </label>
        </div>

        <!-- Footer Action Buttons -->
        <div class="settings-actions-footer">
          <button class="btn btn-secondary" id="btn-sens-reset">Varsayılana Sıfırla</button>
          <button class="btn btn-primary" id="btn-sens-save">Kaydet & Uygula</button>
        </div>
      </div>
    `;

    this.root.appendChild(modal);

    const updateBadge = (id: string, text: string) => {
      const el = modal.querySelector(id);
      if (el) el.textContent = text;
    };

    const refreshInputsFromSettings = () => {
      const curr = inputManager.settings;
      const setVal = (id: string, v: number) => {
        const inp = modal.querySelector(id) as HTMLInputElement;
        if (inp) inp.value = Math.round(v * 100).toString();
      };
      setVal('#slider-sens-look', curr.lookSensitivity);
      updateBadge('#val-sens-look', `${Math.round(curr.lookSensitivity * 100)}%`);

      setVal('#slider-sens-yaw', curr.yawSensitivity);
      updateBadge('#val-sens-yaw', `${Math.round(curr.yawSensitivity * 100)}%`);

      setVal('#slider-sens-pitch', curr.pitchSensitivity);
      updateBadge('#val-sens-pitch', `${Math.round(curr.pitchSensitivity * 100)}%`);

      setVal('#slider-sens-scope', curr.scopeSensitivity);
      updateBadge('#val-sens-scope', `${Math.round(curr.scopeSensitivity * 100)}%`);

      setVal('#slider-sens-deadzone', curr.joystickDeadzone);
      updateBadge('#val-sens-deadzone', `${Math.round(curr.joystickDeadzone * 100)}%`);

      setVal('#slider-sens-sprint', curr.sprintThreshold);
      updateBadge('#val-sens-sprint', `${Math.round(curr.sprintThreshold * 100)}%`);

      const claw = modal.querySelector('#toggle-sens-claw') as HTMLInputElement;
      if (claw) claw.checked = curr.clawFireEnabled;

      const haptic = modal.querySelector('#toggle-sens-haptic') as HTMLInputElement;
      if (haptic) haptic.checked = curr.hapticFeedback;
    };

    const bindSlider = (
      id: string,
      badgeId: string,
      applyFn: (val: number) => void
    ) => {
      const el = modal.querySelector(id) as HTMLInputElement;
      el?.addEventListener('input', () => {
        const num = parseFloat(el.value);
        updateBadge(badgeId, `${num}%`);
        applyFn(num / 100);
        modal.querySelectorAll('.btn-preset').forEach((b) => b.classList.remove('active'));
      });
    };

    bindSlider('#slider-sens-look', '#val-sens-look', (v) => {
      inputManager.settings.lookSensitivity = v;
    });
    bindSlider('#slider-sens-yaw', '#val-sens-yaw', (v) => {
      inputManager.settings.yawSensitivity = v;
    });
    bindSlider('#slider-sens-pitch', '#val-sens-pitch', (v) => {
      inputManager.settings.pitchSensitivity = v;
    });
    bindSlider('#slider-sens-scope', '#val-sens-scope', (v) => {
      inputManager.settings.scopeSensitivity = v;
    });
    bindSlider('#slider-sens-deadzone', '#val-sens-deadzone', (v) => {
      inputManager.settings.joystickDeadzone = v;
    });
    bindSlider('#slider-sens-sprint', '#val-sens-sprint', (v) => {
      inputManager.settings.sprintThreshold = v;
    });

    modal.querySelector('#toggle-sens-claw')?.addEventListener('change', (e) => {
      inputManager.settings.clawFireEnabled = (e.target as HTMLInputElement).checked;
      inputManager.saveSettings();
    });

    modal.querySelector('#toggle-sens-haptic')?.addEventListener('change', (e) => {
      inputManager.settings.hapticFeedback = (e.target as HTMLInputElement).checked;
      inputManager.saveSettings();
    });

    modal.querySelectorAll('.btn-preset').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const p = target.dataset.preset as 'low' | 'medium' | 'high';
        modal.querySelectorAll('.btn-preset').forEach((b) => b.classList.remove('active'));
        target.classList.add('active');
        inputManager.applyPreset(p);
        refreshInputsFromSettings();
        this.sound.playKeypadClick(3);
      });
    });

    modal.querySelector('#btn-sens-reset')?.addEventListener('click', () => {
      inputManager.resetSettingsToDefaults();
      refreshInputsFromSettings();
      modal.querySelectorAll('.btn-preset').forEach((b) => {
        b.classList.toggle('active', (b as HTMLElement).dataset.preset === 'medium');
      });
      this.sound.playKeypadClick(1);
    });

    const closeAndSave = () => {
      inputManager.saveSettings();
      this.sound.playKeypadClick(5);
      modal.remove();
    };

    modal.querySelector('#btn-sens-save')?.addEventListener('click', closeAndSave);
    modal.querySelector('#btn-sens-close-x')?.addEventListener('click', closeAndSave);
  }

  public showLobby(
    roomId: string,
    isHost: boolean,
    players: PlayerPublicInfo[],
    gameMode: GameMode
  ): void {
    const isReady = players.find((p) => p.name === this.playerName)?.isReady || false;

    this.root.innerHTML = `
      <div class="screen-overlay">
        <div class="glass-card interactive lobby-widescreen-card">
          <div class="lobby-layout-grid">
            <!-- Left Column: Mission Controls & Room Info -->
            <div class="lobby-col lobby-col-info">
              <h2 class="lobby-title">MISSION LOBBY</h2>

              <div class="room-code-badge">
                <span class="room-code-label">CODE:</span>
                <span class="room-code-text" id="lobby-code">${roomId}</span>
                <button id="btn-copy-code" class="btn btn-secondary btn-copy-small">Copy</button>
              </div>

              <div class="lobby-meta-row">
                <span class="lobby-meta-pill">MODE: ${gameMode.toUpperCase()}</span>
                <span class="lobby-meta-pill">AGENTS: ${players.length}/16</span>
              </div>

              <div class="lobby-actions-stack">
                <button id="btn-ready-toggle" class="btn ${isReady ? 'btn-secondary' : 'btn-gold'} btn-lobby-action">
                  ${isReady ? 'Cancel Ready' : '⚡ Mark Ready'}
                </button>
                ${
                  isHost
                    ? '<button id="btn-start-game" class="btn btn-primary btn-lobby-action">🎯 Start Match</button>'
                    : '<div class="waiting-host-notice">Host will start the match when squad is ready...</div>'
                }
              </div>
            </div>

            <div class="lobby-grid-divider"></div>

            <!-- Right Column: Squad Agents Roster -->
            <div class="lobby-col lobby-col-roster">
              <div class="roster-header">SQUAD AGENTS (${players.length})</div>
              <div class="player-list compact-grid">
                ${players
                  .map(
                    (p) => `
                  <div class="player-card">
                    <div class="player-info">
                      <div class="player-dot" style="background-color: ${p.customization.color};"></div>
                      <span class="player-name">${p.name}</span>
                    </div>
                    <div class="player-status-badges">
                      ${p.id === players[0].id ? '<span class="player-badge badge-host">HOST</span>' : ''}
                      ${p.isReady ? '<span class="player-badge badge-ready">READY</span>' : ''}
                    </div>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-copy-code')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(roomId);
      const btn = document.getElementById('btn-copy-code');
      if (btn) btn.innerText = 'Copied!';
      setTimeout(() => { if (btn) btn.innerText = 'Copy'; }, 1500);
    });

    document.getElementById('btn-ready-toggle')?.addEventListener('click', () => {
      this.sound.playKeypadClick(1);
      this.onSetReady?.(!isReady);
    });

    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      this.sound.playRoundStart();
      this.onStartGame?.();
    });
  }

  public showChooseNumberScreen(durationSec: number = 10, isRespawn: boolean = false): void {
    let chosen = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    let timeLeft = durationSec;

    this.root.innerHTML = `
      <div class="screen-overlay">
        <div class="glass-card interactive cipher-widescreen-card">
          <div class="cipher-layout-grid">
            <!-- Left Column: Cipher Info & Lock-In -->
            <div class="cipher-col cipher-col-info">
              <h2 class="cipher-title">${isRespawn ? 'RESPAWN CIPHER' : 'ASSIGN CIPHER'}</h2>
              <p class="cipher-subtitle">Mounted on your forehead. Keep it hidden from opponents!</p>

              <div class="cipher-timer-chip">
                <span>LOCK-IN TIME:</span> <strong id="choose-num-timer">${timeLeft}s</strong>
              </div>

              <div class="number-selector-box compact" id="chosen-number-display">
                <div class="number-digit-slot">${chosen[0]}</div>
                <div class="number-digit-slot">${chosen[1]}</div>
                <div class="number-digit-slot">${chosen[2]}</div>
                <div class="number-digit-slot">${chosen[3]}</div>
              </div>

              <button id="btn-confirm-number" class="btn btn-primary btn-lock-in">
                🔒 Lock In Number
              </button>
            </div>

            <div class="cipher-grid-divider"></div>

            <!-- Right Column: Numeric Keypad -->
            <div class="cipher-col cipher-col-keypad">
              <div class="keypad-grid-compact" id="selection-keypad">
                <button class="keypad-key" data-k="1">1</button>
                <button class="keypad-key" data-k="2">2</button>
                <button class="keypad-key" data-k="3">3</button>
                <button class="keypad-key" data-k="4">4</button>
                <button class="keypad-key" data-k="5">5</button>
                <button class="keypad-key" data-k="6">6</button>
                <button class="keypad-key" data-k="7">7</button>
                <button class="keypad-key" data-k="8">8</button>
                <button class="keypad-key" data-k="9">9</button>
                <button class="keypad-key key-rnd" data-k="rand">RND</button>
                <button class="keypad-key" data-k="0">0</button>
                <button class="keypad-key key-back" data-k="back">&larr;</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const timerElem = document.getElementById('choose-num-timer');
    const interval = window.setInterval(() => {
      timeLeft--;
      if (timerElem) timerElem.innerText = `${timeLeft}s`;
      if (timeLeft <= 0) {
        clearInterval(interval);
        this.onNumberSelected?.(chosen);
      }
    }, 1000);

    const updateDisplay = () => {
      const slots = document.querySelectorAll('#chosen-number-display .number-digit-slot');
      slots.forEach((s, idx) => {
        (s as HTMLElement).innerText = chosen[idx] || '_';
      });
    };

    document.querySelectorAll('#selection-keypad .keypad-key').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const k = (e.currentTarget as HTMLElement).dataset.k!;
        if (k === 'rand') {
          chosen = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
          this.sound.playKeypadClick(7);
        } else if (k === 'back') {
          chosen = chosen.slice(0, -1);
          this.sound.playKeypadClick(0);
        } else if (chosen.length < 4) {
          chosen += k;
          this.sound.playKeypadClick(parseInt(k, 10));
        }
        updateDisplay();
      });
    });

    document.getElementById('btn-confirm-number')?.addEventListener('click', () => {
      while (chosen.length < 4) {
        chosen += Math.floor(Math.random() * 10).toString();
      }
      clearInterval(interval);
      this.sound.playKeypadClick(9);
      this.onNumberSelected?.(chosen);
    });
  }

  public showHUD(selfNumber: string): void {
    this.root.innerHTML = `
      <div class="hud-root">
        <!-- Top Bar -->
        <div class="hud-top-bar">
          <div class="hud-score-chip">
            <span style="color: var(--text-muted); font-size: 0.8rem;">SCORE</span>
            <span id="hud-score-val" style="color: #fff;">0</span>
          </div>
          <div class="hud-timer" id="hud-round-timer">05:00</div>
          <div class="hud-self-number">YOUR ID: <strong id="hud-self-num">${selfNumber}</strong></div>
          <div class="hud-score-chip">
            <span style="color: var(--text-muted); font-size: 0.8rem;">K / D</span>
            <span id="hud-kd-val" style="color: #fff;">0 / 0</span>
          </div>
        </div>

        <!-- Center Crosshair -->
        <div class="crosshair-container" id="hud-crosshair">
          <div class="crosshair-ring"></div>
          <div class="crosshair-dot"></div>
          <div class="target-read-indicator" id="target-indicator">TARGET FOREHEAD VISIBLE</div>
        </div>

        <!-- Elimination Feed -->
        <div class="elim-feed" id="elim-feed"></div>

        <!-- Gadget Slots Bar -->
        <div class="hud-gadgets-bar">
          <div class="gadget-slot" data-g="smoke">
            <span class="gadget-key-label">1</span>
            <span class="gadget-name">Smoke</span>
          </div>
          <div class="gadget-slot" data-g="flash">
            <span class="gadget-key-label">2</span>
            <span class="gadget-name">Flash</span>
          </div>
          <div class="gadget-slot" data-g="camera">
            <span class="gadget-key-label">3</span>
            <span class="gadget-name">Camera</span>
          </div>
          <div class="gadget-slot" data-g="binoculars">
            <span class="gadget-key-label">4</span>
            <span class="gadget-name">Zoom</span>
          </div>
        </div>

        <!-- Dedicated Tactical Decode Button -->
        <div class="hud-decode-btn-container">
          <button id="btn-hud-decode" class="btn btn-decode interactive" aria-label="Decode Target">
            <span class="decode-btn-icon">🎯</span>
            <span class="decode-btn-text">DECODE</span>
            <span class="decode-btn-key">[E]</span>
          </button>
        </div>

        <!-- Debug Overlay -->
        <div class="debug-overlay" id="debug-overlay">
          <div>FPS: <span id="debug-fps">60</span></div>
          <div>PING: <span id="debug-ping">0ms</span></div>
          <div>POS: <span id="debug-pos">0, 0, 0</span></div>
        </div>
      </div>
    `;

    document.getElementById('btn-hud-decode')?.addEventListener('click', () => {
      this.toggleKeypad();
    });

    document.querySelectorAll('.gadget-slot').forEach((slot) => {
      slot.addEventListener('click', (e) => {
        const g = (e.currentTarget as HTMLElement).dataset.g as GadgetType;
        if (this.isGadgetOnCooldown(g)) return;
        this.onGadgetClick?.(g);
      });
    });
  }

  public isGadgetOnCooldown(g: GadgetType): boolean {
    const until = this.gadgetCooldowns.get(g) || 0;
    return Date.now() < until;
  }

  public startGadgetCooldown(g: GadgetType, seconds: number = 15): void {
    const now = Date.now();
    const until = now + seconds * 1000;
    this.gadgetCooldowns.set(g, until);

    const slot = document.querySelector(`.gadget-slot[data-g="${g}"]`);
    if (!slot) return;

    slot.classList.add('cooldown');
    let badge = slot.querySelector('.gadget-cooldown-badge') as HTMLElement;
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'gadget-cooldown-badge';
      slot.appendChild(badge);
    }
    badge.innerText = `${seconds}s`;

    const interval = window.setInterval(() => {
      const remainingMs = (this.gadgetCooldowns.get(g) || 0) - Date.now();
      const remSec = Math.ceil(remainingMs / 1000);
      if (remSec <= 0) {
        clearInterval(interval);
        slot.classList.remove('cooldown');
        badge.remove();
        this.gadgetCooldowns.delete(g);
      } else {
        badge.innerText = `${remSec}s`;
      }
    }, 250);
  }

  public triggerFlashbang(intensity: number, durationSec: number = 4.5): void {
    let overlay = document.getElementById('flashbang-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'flashbang-overlay';
      document.body.appendChild(overlay);
    }

    // Force layout reflow and set blinding white opacity
    overlay.style.transition = 'none';
    overlay.style.opacity = Math.min(1.0, Math.max(0.4, intensity)).toString();
    void overlay.offsetWidth; // Force synchronous reflow

    // Hold the blinding flash for 80ms before fading out
    setTimeout(() => {
      if (overlay) {
        overlay.style.transition = `opacity ${durationSec}s cubic-bezier(0.1, 0.7, 0.1, 1)`;
        overlay.style.opacity = '0';
      }
    }, 80);
  }

  public triggerCameraShutterFlash(): void {
    let shutter = document.getElementById('camera-shutter-flash');
    if (!shutter) {
      shutter = document.createElement('div');
      shutter.id = 'camera-shutter-flash';
      document.body.appendChild(shutter);
    }
    shutter.style.transition = 'none';
    shutter.style.opacity = '0.9';
    void shutter.offsetWidth; // Force synchronous reflow

    setTimeout(() => {
      if (shutter) {
        shutter.style.transition = 'opacity 0.28s ease-out';
        shutter.style.opacity = '0';
      }
    }, 45);
  }

  public updateHUD(
    timerSec: number,
    score: number,
    kills: number,
    deaths: number,
    targetInfo: { name: string; isForeheadVisible: boolean } | null
  ): void {
    const timerElem = document.getElementById('hud-round-timer');
    if (timerElem) {
      const m = Math.floor(timerSec / 60);
      const s = timerSec % 60;
      timerElem.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    const scoreElem = document.getElementById('hud-score-val');
    if (scoreElem) scoreElem.innerText = score.toString();

    const kdElem = document.getElementById('hud-kd-val');
    if (kdElem) kdElem.innerText = `${kills} / ${deaths}`;

    const crosshair = document.getElementById('hud-crosshair');
    const indicator = document.getElementById('target-indicator');

    if (crosshair && indicator) {
      if (targetInfo && targetInfo.isForeheadVisible) {
        crosshair.classList.add('target-visible');
        indicator.innerText = `${targetInfo.name.toUpperCase()} FOREHEAD VISIBLE [E]`;
      } else {
        crosshair.classList.remove('target-visible');
      }
    }
  }

  public toggleKeypad(targetId?: string, targetName?: string): void {
    if (this.isKeypadOpen) {
      this.closeKeypad();
    } else {
      this.openKeypad(targetId, targetName);
    }
  }

  public openKeypad(targetId?: string, targetName?: string): void {
    if (this.cooldownRemaining > 0) {
      this.sound.playEliminationFail();
      return;
    }

    this.isKeypadOpen = true;
    this.keypadInput = '';
    this.currentTargetId = targetId || '';
    this.currentTargetName = targetName || 'Target in Sight';
    this.onKeypadToggle?.(true);

    const modal = document.createElement('div');
    modal.id = 'decode-keypad-modal';
    modal.className = 'decode-modal';
    modal.innerHTML = `
      <div class="glass-card interactive decode-widescreen-card">
        <div class="decode-layout-grid">
          <!-- Left Column: Target & Actions -->
          <div class="decode-col decode-col-info">
            <div class="decode-header-tag">DECODE & ELIMINATE</div>
            <h3 class="decode-target-name" id="keypad-target-label">
              ${this.currentTargetName}
            </h3>

            <div class="number-selector-box compact" id="keypad-digits-display">
              <div class="number-digit-slot">_</div>
              <div class="number-digit-slot">_</div>
              <div class="number-digit-slot">_</div>
              <div class="number-digit-slot">_</div>
            </div>

            <div class="decode-actions-stack">
              <button id="btn-keypad-confirm" class="btn btn-danger btn-confirm-attack">
                🎯 CONFIRM ATTACK
              </button>
              <button id="btn-keypad-cancel" class="btn btn-secondary btn-cancel-decode">
                Cancel
              </button>
            </div>

            <div id="keypad-error-msg" class="decode-error-alert" style="display: none;"></div>
          </div>

          <div class="decode-grid-divider"></div>

          <!-- Right Column: Keypad -->
          <div class="decode-col decode-col-keypad">
            <div class="keypad-grid-compact" id="modal-keypad-buttons">
              <button class="keypad-key" data-k="1">1</button>
              <button class="keypad-key" data-k="2">2</button>
              <button class="keypad-key" data-k="3">3</button>
              <button class="keypad-key" data-k="4">4</button>
              <button class="keypad-key" data-k="5">5</button>
              <button class="keypad-key" data-k="6">6</button>
              <button class="keypad-key" data-k="7">7</button>
              <button class="keypad-key" data-k="8">8</button>
              <button class="keypad-key" data-k="9">9</button>
              <button class="keypad-key key-clr" data-k="clear">CLR</button>
              <button class="keypad-key" data-k="0">0</button>
              <button class="keypad-key key-back" data-k="back">&larr;</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.root.appendChild(modal);

    modal.querySelectorAll('#modal-keypad-buttons .keypad-key').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const k = (e.currentTarget as HTMLElement).dataset.k!;
        if (k === 'clear') {
          this.keypadInput = '';
          this.sound.playKeypadClick(0);
        } else if (k === 'back') {
          this.removeKeypadDigit();
        } else if (this.keypadInput.length < 4) {
          this.addKeypadDigit(k);
        }
      });
    });

    modal.querySelector('#btn-keypad-confirm')?.addEventListener('click', () => {
      this.submitKeypadElimination();
    });

    modal.querySelector('#btn-keypad-cancel')?.addEventListener('click', () => {
      this.closeKeypad();
    });
  }

  public addKeypadDigit(d: string): void {
    if (this.keypadInput.length >= 4) return;
    this.keypadInput += d;
    this.sound.playKeypadClick(parseInt(d, 10));
    this.updateKeypadDisplay();
  }

  public removeKeypadDigit(): void {
    if (this.keypadInput.length === 0) return;
    this.keypadInput = this.keypadInput.slice(0, -1);
    this.sound.playKeypadClick(0);
    this.updateKeypadDisplay();
  }

  private updateKeypadDisplay(): void {
    const slots = document.querySelectorAll('#keypad-digits-display .number-digit-slot');
    slots.forEach((s, idx) => {
      (s as HTMLElement).innerText = this.keypadInput[idx] || '_';
    });
  }

  public submitKeypadElimination(): void {
    if (this.keypadInput.length !== 4) return;
    const code = this.keypadInput;
    const target = this.currentTargetId;
    this.closeKeypad();
    this.onEliminationAttempt?.(target, code);
  }

  public closeKeypad(): void {
    this.isKeypadOpen = false;
    document.getElementById('decode-keypad-modal')?.remove();
    this.onKeypadToggle?.(false);
  }

  public showEliminationRejected(message: string, cooldownSec: number): void {
    const errMsg = document.getElementById('keypad-error-msg');
    if (errMsg) {
      errMsg.innerText = message;
      errMsg.style.display = 'block';
    } else {
      const feed = document.getElementById('hud-elimination-feed');
      if (feed) {
        const toast = document.createElement('div');
        toast.className = 'elimination-feed-item';
        toast.style.background = 'rgba(239, 68, 68, 0.9)';
        toast.style.color = '#fff';
        toast.style.fontWeight = 'bold';
        toast.innerText = `[ATTACK FAILED] ${message}`;
        feed.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
      }
    }

    this.sound.playEliminationFail();

    if (cooldownSec > 0) {
      this.cooldownRemaining = cooldownSec;
      const decodeBtn = document.getElementById('btn-hud-decode');

      if (this.cooldownTimerInterval) clearInterval(this.cooldownTimerInterval);
      this.cooldownTimerInterval = window.setInterval(() => {
        this.cooldownRemaining--;
        if (decodeBtn) {
          decodeBtn.classList.add('cooldown');
          decodeBtn.innerText = `COOLDOWN (${this.cooldownRemaining}s)`;
        }
        if (this.cooldownRemaining <= 0) {
          clearInterval(this.cooldownTimerInterval!);
          if (decodeBtn) {
            decodeBtn.classList.remove('cooldown');
            decodeBtn.innerText = 'DECODE [E]';
          }
        }
      }, 1000);
    }

    setTimeout(() => {
      this.closeKeypad();
    }, 1200);
  }

  public showEliminationSuccess(victimName: string, num: string): void {
    this.closeKeypad();
    this.sound.playEliminationSuccess();

    const banner = document.createElement('div');
    banner.style.cssText = `
      position: absolute; top: 120px; left: 50%; transform: translateX(-50%);
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(6, 182, 212, 0.95));
      color: #031525; padding: 16px 32px; border-radius: 12px; font-weight: 900;
      font-size: 1.5rem; letter-spacing: 2px; box-shadow: 0 0 35px rgba(0, 240, 255, 0.6);
      pointer-events: none; z-index: 100; animation: popIn 0.3s ease-out;
    `;
    banner.innerHTML = `TARGET DECODED! [${num}] &bull; +100 PTS`;
    this.root.appendChild(banner);

    setTimeout(() => banner.remove(), 2500);
  }

  public addEliminationFeedItem(attacker: string, victim: string, num: string): void {
    const feed = document.getElementById('elim-feed');
    if (!feed) return;

    const item = document.createElement('div');
    item.className = 'elim-feed-item';
    item.innerHTML = `<span style="color: var(--accent-cyan);">${attacker}</span> decoded <span style="color: var(--accent-red);">${victim}</span> [${num}]`;
    feed.appendChild(item);

    setTimeout(() => item.remove(), 4500);
  }

  public showSpyCameraPhotoCard(capturedNumber: string): void {
    const card = document.createElement('div');
    card.id = 'spy-camera-photo-card';
    card.style.cssText = `
      position: absolute; bottom: 130px; right: 35px; z-index: 80;
      background: linear-gradient(135deg, rgba(10, 18, 36, 0.95), rgba(15, 23, 42, 0.95));
      border: 2px solid var(--accent-cyan); border-radius: 14px; padding: 18px 24px;
      box-shadow: 0 0 35px rgba(0, 240, 255, 0.45); text-align: center;
      backdrop-filter: blur(12px); animation: fadeIn 0.3s ease;
    `;
    card.innerHTML = `
      <div style="font-size: 0.75rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 2px; margin-bottom: 4px;">
        📸 SPY SATELLITE PHOTO INTEL
      </div>
      <div style="font-family: var(--font-mono); font-size: 2.2rem; font-weight: 900; color: #ffd700; letter-spacing: 6px; text-shadow: 0 0 15px rgba(255, 215, 0, 0.6); margin: 4px 0;">
        ${capturedNumber}
      </div>
      <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
        Press [E] to input this code and eliminate target!
      </div>
    `;

    document.getElementById('spy-camera-photo-card')?.remove();
    this.root.appendChild(card);
    this.sound.playCameraShutter();

    setTimeout(() => {
      card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      card.style.opacity = '0';
      card.style.transform = 'translateY(15px)';
      setTimeout(() => card.remove(), 600);
    }, 6000);
  }

  public showRoundEnd(players: PlayerPublicInfo[], winnerName: string): void {
    const sorted = [...players].sort((a, b) => b.score - a.score);

    this.root.innerHTML = `
      <div class="screen-overlay">
        <div class="glass-card interactive" style="max-width: 500px;">
          <h2 style="font-size: 2rem; color: var(--accent-gold); letter-spacing: 3px;">MISSION COMPLETE</h2>
          <p style="color: var(--accent-cyan); font-weight: 700; margin: 6px 0 18px 0;">WINNER: ${winnerName}</p>

          <div class="player-list">
            ${sorted
              .map(
                (p, idx) => `
              <div class="player-card">
                <div class="player-info">
                  <span style="font-family: var(--font-mono); font-weight: 800; color: ${idx === 0 ? 'var(--accent-gold)' : 'var(--text-muted)'};">#${idx + 1}</span>
                  <div class="player-dot" style="background-color: ${p.customization.color};"></div>
                  <span class="player-name">${p.name}</span>
                </div>
                <div style="font-family: var(--font-mono); font-weight: 700;">
                  <span style="color: var(--accent-cyan);">${p.score} PTS</span>
                  <span style="color: var(--text-muted); font-size: 0.8rem; margin-left: 8px;">(${p.kills}K / ${p.deaths}D)</span>
                </div>
              </div>
            `
              )
              .join('')}
          </div>

          <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 14px;">
            Returning to lobby in a few seconds...
          </div>
        </div>
      </div>
    `;
  }


  public showNotification(message: string): void {
    const feed = document.getElementById('hud-elimination-feed');
    if (feed) {
      const item = document.createElement('div');
      item.className = 'elimination-feed-item';
      item.style.background = 'rgba(14, 165, 233, 0.9)';
      item.style.color = '#fff';
      item.innerText = message;
      feed.appendChild(item);
      setTimeout(() => item.remove(), 3500);
    }
  }
}
