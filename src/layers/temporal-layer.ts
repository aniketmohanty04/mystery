import type { PuzzleLayer, LayerId, SolveResult } from '../core/types.js';
import { stateMachine } from '../core/state-machine.js';
import { VALIDATION_UNAVAILABLE_MESSAGE } from '../core/constants.js';
import { normalizeAnswer } from '../core/answer-validator.js';

export interface TimelineEvent {
  id: string;
  title: string;
  source: string;
  rawTimestamp: string;
  normalizedUtc: string;
  clockDriftNote: string;
  evidenceType: string;
  description: string;
  forensicNote: string;
  trueOrder: number;
}

export const TIMELINE_EVENTS: readonly TimelineEvent[] = [
  {
    id: 'EV-302',
    title: 'Perimeter Optical Fence Trip',
    source: 'Physical Security // Sector 7 Perimeter',
    rawTimestamp: '02:15 UTC',
    normalizedUtc: '02:15 UTC',
    clockDriftNote: '±0m (NTP Synchronized Baseline)',
    evidenceType: 'OPTICAL SENSOR',
    description: 'Infrared perimeter beam interrupted at ground intrusion point. External sensor circuit severed 12 seconds later.',
    forensicNote: 'Hardware timer verified synchronized against National Time Protocol (NTP). Reference baseline: 02:15 UTC.',
    trueOrder: 1,
  },
  {
    id: 'EV-814',
    title: 'Terminal Console Authentication Override',
    source: 'Mainframe Gateway // Sublevel 2 Control Room',
    rawTimestamp: '01:55 UTC (Hardware RTC)',
    normalizedUtc: '02:55 UTC',
    clockDriftNote: '+60m RTC Drift (Dead CMOS battery caused clock to lag 60m)',
    evidenceType: 'AUDIT LOG',
    description: 'Administrative terminal session initiated via forensic bypass key. Privilege escalation commands executed.',
    forensicNote: 'Console motherboard battery failure caused an internal RTC drift of -60 minutes across all system logs. True timestamp is exactly +1h00m relative to logged time (02:55 UTC).',
    trueOrder: 2,
  },
  {
    id: 'EV-409',
    title: 'Data Vault Archive Exfiltration',
    source: 'Storage Node // High-Speed Fiber Gateway',
    rawTimestamp: '03:08 UTC',
    normalizedUtc: '03:08 UTC',
    clockDriftNote: '±0m (NTP Synchronized Network Switch)',
    evidenceType: 'NETWORK TELEMETRY',
    description: 'Burst transmission initiated toward external dark relay. 4.2 GB of encrypted telemetry extracted.',
    forensicNote: 'Network switch clock verified synchronized via NTP broadcast. Telemetry stream recorded immediately following console elevation.',
    trueOrder: 3,
  },
  {
    id: 'EV-127',
    title: 'Evidence Locker Magnetic Seal Severed',
    source: 'Regional Dispatch // Station Monitor',
    rawTimestamp: '23:22 EST (UTC-4)',
    normalizedUtc: '03:22 UTC',
    clockDriftNote: '+4h Timezone Offset (EST is UTC-4 -> add 4 hours to convert to UTC)',
    evidenceType: 'ACCESS CONTROL',
    description: 'Physical vault door lock mechanically forced. Secondary tamper sensor severed.',
    forensicNote: 'Recorded in Eastern Standard Time (EST / UTC-4) by regional dispatch server. To convert to UTC reference standard, add 4 hours (23:22 EST = 03:22 UTC).',
    trueOrder: 4,
  },
  {
    id: 'EV-955',
    title: 'Emergency Facility Lockdown Initiated',
    source: 'Emergency Response System // Master Core',
    rawTimestamp: '03:45 UTC',
    normalizedUtc: '03:45 UTC',
    clockDriftNote: '±0m (Station Alarm Synchronized)',
    evidenceType: 'STATION ALARM',
    description: 'Total automated perimeter lockdown and hermetic door seals deployed across all sectors.',
    forensicNote: 'Triggered automatically 23 minutes after physical vault compromise. Final telemetry event before station communications severed.',
    trueOrder: 5,
  },
];

export const CORRECT_CHRONOLOGY: readonly string[] = [
  'EV-302',
  'EV-814',
  'EV-409',
  'EV-127',
  'EV-955',
];

export const INITIAL_SCRAMBLE: readonly string[] = [
  'EV-127',
  'EV-814',
  'EV-955',
  'EV-302',
  'EV-409',
];

export const TOTAL_DURATION_MS = 90_000;
export const TIMER_TICK_INTERVAL_MS = 100;

export type EntropyTier = '1' | '2' | '3' | '4' | 'expired';

export function getEntropyTier(remainingMs: number): EntropyTier {
  if (remainingMs <= 0) return 'expired';
  if (remainingMs <= 10_000) return '4';
  if (remainingMs <= 30_000) return '3';
  if (remainingMs <= 60_000) return '2';
  return '1';
}

export function formatRemainingTime(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((clamped % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

const HINTS: readonly string[] = [
  'All evidence events must be aligned to a single unified reference clock: Universal Coordinated Time (UTC).',
  'EV-814 console motherboard had a dead battery and logged time 60 minutes slow. Add 1 hour to its logged time (01:55 + 1h = 02:55 UTC).',
  'EV-127 was logged in Eastern Standard Time (EST = UTC-4). Convert to UTC by adding 4 hours (23:22 EST = 03:22 UTC).',
];

export class TemporalLayer implements PuzzleLayer {
  readonly id: LayerId = 'temporal';
  readonly displayName = 'Temporal Logic';

  private container: HTMLElement | null = null;
  private root: HTMLElement | null = null;
  private isSolved = false;
  private isSubmitting = false;
  private hintsRevealed = 0;
  private currentOrder: string[] = [...INITIAL_SCRAMBLE];
  private currentScrubberIndex = 0;

  // Deadline-based entropy timer state
  private deadline: number | null = null;
  private timerInterval: number | null = null;
  private isExpired = false;
  private runId = 0;

  // Drag-and-drop state
  private draggedIndex: number | null = null;

  // Handlers for cleanup
  private formHandler: ((e: Event) => void) | null = null;
  private visibilityHandler: (() => void) | null = null;
  private listItemHandlers: Map<HTMLElement, EventListener> = new Map();
  private panelHandlers: Map<HTMLElement, () => void> = new Map();
  private scrubberHandlers: Map<HTMLElement, { type: string; fn: EventListener }> = new Map();
  private dragHandlers: Array<{ el: HTMLElement; type: string; fn: EventListener }> = [];

  mount(container: HTMLElement): void {
    this.container = container;
    this.root = document.createElement('article');
    this.root.className = 'layer-card';
    this.root.dataset.status = 'active';
    this.root.dataset.entropyTier = '1';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', 'Evidence File 004 — Temporal State Scrubber & Chronology Reconstruction');

    this.root.innerHTML = `
      <header class="layer-card__header">
        <div class="layer-meta">
          <span class="layer-meta__ref">REF&#x202F;#004</span>
          <span id="temporal-badge" class="layer-meta__badge badge badge--active">CHRONOLOGY PENDING</span>
        </div>
        <h2 class="layer-card__title">Temporal Logic</h2>
        <p class="layer-card__layer-id">Layer 04 &bull; Incident Timeline Reconstruction</p>
      </header>

      <div class="layer-card__body">
        <!-- Entropy countdown & stability gauge banner -->
        <div class="entropy-gauge" role="timer" aria-live="off" aria-label="Temporal Subsystem Stability Gauge">
          <div class="entropy-gauge__header">
            <span class="entropy-gauge__title">SUBSYSTEM: TEMPORAL_STATE_SCRUBBER // V4.2</span>
            <div class="entropy-gauge__status">
              <span id="entropy-tier-badge" class="entropy-gauge__tier-badge">TIER 1 &bull; COHERENT</span>
              <span id="entropy-timer-display" class="entropy-gauge__timer">01:30.00</span>
            </div>
          </div>
          <div class="entropy-gauge__track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">
            <div id="entropy-meter-fill" class="entropy-gauge__fill" style="width: 100%;"></div>
          </div>
        </div>

        <div class="evidence-record">
          <p class="narrative">
            Following the cross-channel signal intercept, station forensic servers recovered five critical telemetry
            records detailing the intrusion. However, hardware clock drifts, battery depletion, and cross-station
            timezone disparities have corrupted the event timestamps.
          </p>
          <p class="narrative narrative--dim">
            Analyze the forensic notes, normalize all incident logs to a unified <strong>UTC reference timeline</strong>,
            and scrub through the timeline to sequence the events in strict chronological order before temporal coherence collapses.
          </p>
        </div>

        <!-- Interactive Scrubber & Timeline Panel -->
        <section class="temporal-subsystem" aria-label="Temporal State Scrubber Workspace">
          <div id="temporal-scrubber-mount"></div>

          <!-- Sequence Preview Bar -->
          <div class="timeline-preview" style="padding: 0.75rem 1rem; background: var(--col-mono-bg); border: 1px dashed var(--col-border-2); border-radius: 4px; font-family: monospace;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
              <span style="font-size: 0.75rem; color: var(--col-text-3); text-transform: uppercase;">
                Reconstructed Incident Chronology:
              </span>
              <button id="reset-order-btn" type="button" class="btn btn--ghost btn--sm" style="font-size: 0.75rem;">
                Reset Order
              </button>
            </div>
            <strong id="timeline-sequence-preview" style="font-size: 0.95rem; color: var(--col-accent); word-break: break-all;">
              <!-- Populated by updateSequencePreview() -->
            </strong>
          </div>

          <!-- Full Event List with Card Controls & Drag-Drop -->
          <div style="margin-top: 1rem;">
            <span style="font-family: monospace; font-size: 0.8rem; color: var(--col-text-3); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 0.5rem;">
              All Telemetry Evidence Records (Drag or use controls to reorder):
            </span>
            <ol id="timeline-list" class="timeline-list" style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem;">
              <!-- Dynamically rendered by renderEventList() -->
            </ol>
          </div>
        </section>

        <!-- Progressive Hints -->
        <div class="hints-section" style="margin-top: 1rem; margin-bottom: 1.5rem;">
          <button id="temporal-hint-btn" type="button" class="btn btn--ghost hint-toggle">
            Reveal Clue (0/3)
          </button>
          <div id="temporal-hints-list" class="hints-list"></div>
        </div>

        <!-- Answer Form -->
        <form class="answer-form" id="temporal-form" novalidate aria-label="Submit reconstructed timeline">
          <label for="temporal-answer" class="sr-only">Reconstructed Event Sequence</label>
          <div class="answer-form__input-group">
            <input
              id="temporal-answer"
              type="text"
              class="input font-mono"
              placeholder="EV-302-EV-814-EV-409-EV-127-EV-955"
              autocomplete="off"
              spellcheck="false"
              aria-describedby="temporal-status"
            />
            <button id="temporal-submit" type="submit" class="btn btn--primary">
              Verify Chronology
            </button>
          </div>
          <p id="temporal-status" class="status-msg" aria-live="polite" aria-atomic="true"></p>
        </form>
      </div>
    `;

    this.container.appendChild(this.root);
    this.renderScrubber();
    this.renderEventList();
    this.bindEvents();
  }

  activate(): void {
    if (!this.root) return;
    this.root.dataset.status = 'active';
    if (!this.isSolved && !this.isExpired && this.timerInterval === null) {
      this.startTimer(TOTAL_DURATION_MS);
    }
  }

  destroy(): void {
    this.stopTimer();

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    this.cleanupScrubberHandlers();
    this.cleanupDragHandlers();
    this.cleanupListItemHandlers();
    this.cleanupPanelHandlers();

    if (this.formHandler && this.root) {
      const form = this.root.querySelector<HTMLFormElement>('#temporal-form');
      form?.removeEventListener('submit', this.formHandler);
      this.formHandler = null;
    }

    if (this.root && this.container?.contains(this.root)) {
      this.container.removeChild(this.root);
    }
    this.root = null;
    this.container = null;
  }

  // ---------------------------------------------------------------------------
  // Deadline Entropy Timer
  // ---------------------------------------------------------------------------

  startTimer(durationMs: number = TOTAL_DURATION_MS): void {
    this.stopTimer();
    this.deadline = Date.now() + durationMs;
    this.isExpired = false;

    // Immediately update visuals
    this.updateTimerTick();

    this.timerInterval = window.setInterval(() => {
      this.updateTimerTick();
    }, TIMER_TICK_INTERVAL_MS);
  }

  stopTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  getRemainingTime(): number {
    if (this.deadline === null) return 0;
    return Math.max(0, this.deadline - Date.now());
  }

  getEntropyTier(): EntropyTier {
    return getEntropyTier(this.getRemainingTime());
  }

  private updateTimerTick(): void {
    if (this.isSolved || this.deadline === null || !this.root) return;

    const remainingMs = Math.max(0, this.deadline - Date.now());
    this.renderTimerDisplay(remainingMs);

    if (remainingMs <= 0 && !this.isExpired) {
      this.handleTimeout();
    }
  }

  private renderTimerDisplay(remainingMs: number): void {
    if (!this.root) return;

    const tier = getEntropyTier(remainingMs);
    this.root.dataset.entropyTier = tier;

    const timerDisplay = this.root.querySelector<HTMLElement>('#entropy-timer-display');
    if (timerDisplay) {
      timerDisplay.textContent = formatRemainingTime(remainingMs);
    }

    const fillEl = this.root.querySelector<HTMLElement>('#entropy-meter-fill');
    if (fillEl) {
      const percentage = Math.max(0, Math.min(100, (remainingMs / TOTAL_DURATION_MS) * 100));
      fillEl.style.width = `${percentage}%`;
    }

    const tierBadge = this.root.querySelector<HTMLElement>('#entropy-tier-badge');
    if (tierBadge) {
      switch (tier) {
        case '1':
          tierBadge.textContent = 'TIER 1 \u2022 COHERENT';
          break;
        case '2':
          tierBadge.textContent = 'TIER 2 \u2022 JITTER DETECTED';
          break;
        case '3':
          tierBadge.textContent = 'TIER 3 \u2022 INTERFERENCE HIGH';
          break;
        case '4':
          tierBadge.textContent = 'TIER 4 \u2022 CRITICAL INSTABILITY';
          break;
        case 'expired':
          tierBadge.textContent = 'COLLAPSE // TIMEOUT';
          break;
      }
    }
  }

  private handleTimeout(): void {
    this.isExpired = true;
    this.stopTimer();

    if (!this.root) return;

    this.root.dataset.entropyTier = 'expired';
    const timerDisplay = this.root.querySelector<HTMLElement>('#entropy-timer-display');
    if (timerDisplay) {
      timerDisplay.textContent = '00:00.00';
    }

    const fillEl = this.root.querySelector<HTMLElement>('#entropy-meter-fill');
    if (fillEl) {
      fillEl.style.width = '0%';
    }

    const tierBadge = this.root.querySelector<HTMLElement>('#entropy-tier-badge');
    if (tierBadge) {
      tierBadge.textContent = 'COLLAPSE // TIMEOUT';
    }

    // Render prominent timeout banner with reboot button
    this.renderTimeoutBanner();

    // Disable verification button and input
    const submitBtn = this.root.querySelector<HTMLButtonElement>('#temporal-submit');
    if (submitBtn) submitBtn.disabled = true;

    const input = this.root.querySelector<HTMLInputElement>('#temporal-answer');
    if (input) input.disabled = true;

    const statusEl = this.root.querySelector<HTMLElement>('#temporal-status');
    this.setStatus(
      statusEl,
      'error',
      'TEMPORAL COHERENCE COLLAPSED (00:00.00) \u2014 Telemetry buffer purged. Reconstruct timeline and reboot scrubber subsystem.'
    );

    // Re-render scrubber & event list to disable controls
    this.renderScrubber();
    this.renderEventList();
  }

  private renderTimeoutBanner(): void {
    if (!this.root) return;
    let banner = this.root.querySelector<HTMLElement>('#temporal-timeout-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'temporal-timeout-banner';
      banner.className = 'temporal-timeout-panel';
      banner.setAttribute('role', 'alert');
      banner.innerHTML = `
        <div class="temporal-timeout-panel__title">&#x26A0; TEMPORAL COHERENCE COLLAPSED</div>
        <p class="temporal-timeout-panel__msg">
          The 90-second operational window has elapsed. Hardware clock drift and telemetry desynchronization
          have corrupted the chronology buffer. Subsystem reboot is required to re-establish reference lock.
        </p>
        <button id="temporal-restart-btn" type="button" class="btn btn--primary">
          Reboot Scrubber Subsystem
        </button>
      `;

      const restartBtn = banner.querySelector<HTMLButtonElement>('#temporal-restart-btn');
      if (restartBtn) {
        restartBtn.addEventListener('click', () => this.restart());
      }

      const body = this.root.querySelector('.layer-card__body');
      const gauge = body?.querySelector('.entropy-gauge');
      if (gauge && gauge.nextSibling) {
        body?.insertBefore(banner, gauge.nextSibling);
      } else {
        body?.prepend(banner);
      }
    }
  }

  restart(): void {
    if (this.isSolved) return;

    this.runId++;
    this.isExpired = false;
    this.isSubmitting = false;
    this.currentOrder = [...INITIAL_SCRAMBLE];
    this.currentScrubberIndex = 0;

    const banner = this.root?.querySelector('#temporal-timeout-banner');
    banner?.remove();

    const statusEl = this.root?.querySelector<HTMLElement>('#temporal-status');
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.className = 'status-msg';
    }

    const input = this.root?.querySelector<HTMLInputElement>('#temporal-answer');
    if (input) {
      input.disabled = false;
      input.value = this.currentOrder.join('-');
    }

    const submitBtn = this.root?.querySelector<HTMLButtonElement>('#temporal-submit');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Verify Chronology';
    }

    this.renderScrubber();
    this.renderEventList();

    // Start fresh 90s deadline
    this.startTimer(TOTAL_DURATION_MS);
  }

  // ---------------------------------------------------------------------------
  // Answer Submission
  // ---------------------------------------------------------------------------

  async submitAnswer(answer: string): Promise<SolveResult> {
    if (this.isSolved) {
      return 'accepted';
    }

    if (this.isSubmitting) {
      return 'error';
    }

    const now = Date.now();
    if (this.isExpired || (this.deadline !== null && now >= this.deadline)) {
      this.handleTimeout();
      return 'incorrect';
    }

    const currentRunId = this.runId;
    this.isSubmitting = true;

    const statusEl = this.root?.querySelector<HTMLElement>('#temporal-status');
    const submitBtn = this.root?.querySelector<HTMLButtonElement>('#temporal-submit');
    const input = this.root?.querySelector<HTMLInputElement>('#temporal-answer');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying\u2026';
    }

    const result = await stateMachine.solve(this.id, answer);

    // Stale check: if restarted or expired during validation, discard result
    if (this.runId !== currentRunId || this.isExpired) {
      this.isSubmitting = false;
      return 'incorrect';
    }

    this.isSubmitting = false;

    if (result === 'accepted') {
      this.stopTimer();
      this.markSolved();
    } else if (result === 'incorrect') {
      const feedback = this.generateDiagnosticFeedback(answer);
      this.setStatus(statusEl, 'error', feedback);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Verify Chronology';
      }
      input?.focus();
    } else if (result === 'error') {
      this.setStatus(statusEl, 'error', VALIDATION_UNAVAILABLE_MESSAGE);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Verify Chronology';
      }
      input?.focus();
    } else {
      if (submitBtn && !this.isSolved) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Verify Chronology';
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Reordering & Scrubber Logic
  // ---------------------------------------------------------------------------

  setScrubberIndex(index: number): void {
    if (index < 0 || index >= this.currentOrder.length) return;
    this.currentScrubberIndex = index;
    this.renderScrubber();
    this.highlightScrubbedCard();
  }

  moveUp(index: number): void {
    if (index <= 0 || index >= this.currentOrder.length || this.isSolved || this.isExpired) return;
    const temp = this.currentOrder[index];
    this.currentOrder[index] = this.currentOrder[index - 1];
    this.currentOrder[index - 1] = temp;

    // Follow the moved event in the scrubber
    if (this.currentScrubberIndex === index) {
      this.currentScrubberIndex = index - 1;
    } else if (this.currentScrubberIndex === index - 1) {
      this.currentScrubberIndex = index;
    }

    this.renderScrubber();
    this.renderEventList(this.currentOrder[index - 1]);
  }

  moveDown(index: number): void {
    if (index < 0 || index >= this.currentOrder.length - 1 || this.isSolved || this.isExpired) return;
    const temp = this.currentOrder[index];
    this.currentOrder[index] = this.currentOrder[index + 1];
    this.currentOrder[index + 1] = temp;

    // Follow the moved event in the scrubber
    if (this.currentScrubberIndex === index) {
      this.currentScrubberIndex = index + 1;
    } else if (this.currentScrubberIndex === index + 1) {
      this.currentScrubberIndex = index;
    }

    this.renderScrubber();
    this.renderEventList(this.currentOrder[index + 1]);
  }

  resetOrder(): void {
    if (this.isSolved || this.isExpired) return;
    this.currentOrder = [...INITIAL_SCRAMBLE];
    this.currentScrubberIndex = 0;
    this.renderScrubber();
    this.renderEventList();
    const statusEl = this.root?.querySelector<HTMLElement>('#temporal-status');
    this.setStatus(statusEl, 'info', 'Event order reset to initial scrambled state.');
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private renderScrubber(): void {
    if (!this.root) return;
    const mountEl = this.root.querySelector<HTMLElement>('#temporal-scrubber-mount');
    if (!mountEl) return;

    this.cleanupScrubberHandlers();

    const eventsMap = new Map<string, TimelineEvent>();
    for (const ev of TIMELINE_EVENTS) {
      eventsMap.set(ev.id, ev);
    }

    const activeEventId = this.currentOrder[this.currentScrubberIndex];
    const activeEv = eventsMap.get(activeEventId);

    mountEl.innerHTML = `
      <div class="scrubber-panel" aria-label="Incident Timeline Scrubber">
        <div class="scrubber-panel__header">
          <span>TEMPORAL STATE SCRUBBER // 5-STAGE CHRONO AXIS</span>
          <span style="color: var(--col-accent); font-family: monospace;">
            INSPECTION SLOT ${this.currentScrubberIndex + 1} / 5
          </span>
        </div>

        <div class="scrubber-slider-container">
          <input
            type="range"
            id="temporal-scrubber-slider"
            class="scrubber-slider"
            min="1"
            max="5"
            step="1"
            value="${this.currentScrubberIndex + 1}"
            aria-label="Timeline position scrubber cursor"
            ${this.isSolved || this.isExpired ? 'disabled' : ''}
          />

          <div class="scrubber-nodes" role="tablist" aria-label="Timeline slots">
            ${this.currentOrder
              .map((id, idx) => {
                const isActive = idx === this.currentScrubberIndex;
                return `
                  <button
                    type="button"
                    class="scrubber-node ${isActive ? 'is-active' : ''}"
                    data-slot-index="${idx}"
                    role="tab"
                    aria-selected="${isActive ? 'true' : 'false'}"
                    aria-label="Chrono slot ${idx + 1}: ${id}"
                    ${this.isSolved || this.isExpired ? 'disabled' : ''}
                  >
                    <span class="scrubber-node__slot">SLOT 0${idx + 1}</span>
                    <span class="scrubber-node__id">${id}</span>
                  </button>
                `;
              })
              .join('')}
          </div>
        </div>

        <!-- Scrubber Inspector Panel -->
        ${
          activeEv
            ? `
          <div class="scrubber-inspector" aria-live="polite">
            <div class="inspector-meta">
              <div>
                <span class="badge badge--active" style="font-family: monospace; font-size: 0.75rem;">
                  SLOT #${this.currentScrubberIndex + 1} &bull; ${activeEv.evidenceType}
                </span>
                <span style="font-family: monospace; font-size: 0.8rem; color: var(--col-text-3); margin-left: 0.5rem;">
                  ${activeEv.source}
                </span>
              </div>
              <strong style="color: var(--col-accent); font-family: monospace; font-size: 1rem;">
                ${activeEv.id}
              </strong>
            </div>

            <div class="inspector-title">
              ${activeEv.title}
            </div>

            <p style="margin: 0; font-size: 0.85rem; color: var(--col-text-2); line-height: 1.5;">
              ${activeEv.description}
            </p>

            <div class="inspector-timestamps">
              <div class="timestamp-field">
                <span class="timestamp-field__label">RAW RECORDED LOG:</span>
                <span class="timestamp-field__val timestamp-field__val--raw">${activeEv.rawTimestamp}</span>
              </div>
              <div class="timestamp-field">
                <span class="timestamp-field__label">CLOCK DRIFT / OFFSET:</span>
                <span class="timestamp-field__val timestamp-field__val--drift">${activeEv.clockDriftNote}</span>
              </div>
              <div class="timestamp-field">
                <span class="timestamp-field__label">NORMALIZED UTC STANDARD:</span>
                <span class="timestamp-field__val timestamp-field__val--utc">${activeEv.normalizedUtc}</span>
              </div>
            </div>

            <div class="inspector-note">
              <strong>FORENSIC CLUE:</strong> ${activeEv.forensicNote}
            </div>

            <div class="inspector-actions">
              <span style="font-family: monospace; font-size: 0.75rem; color: var(--col-text-3); margin-right: auto;">
                Sequence Position Controls:
              </span>
              <button
                type="button"
                id="inspector-move-up-btn"
                class="btn btn--secondary btn--sm"
                ${this.currentScrubberIndex === 0 || this.isSolved || this.isExpired ? 'disabled' : ''}
                aria-label="Shift ${activeEv.id} earlier in timeline"
              >
                &#x25B2; Shift Earlier
              </button>
              <button
                type="button"
                id="inspector-move-down-btn"
                class="btn btn--secondary btn--sm"
                ${this.currentScrubberIndex === this.currentOrder.length - 1 || this.isSolved || this.isExpired ? 'disabled' : ''}
                aria-label="Shift ${activeEv.id} later in timeline"
              >
                &#x25BC; Shift Later
              </button>
            </div>
          </div>
        `
            : ''
        }
      </div>
    `;

    // Bind slider input
    const slider = mountEl.querySelector<HTMLInputElement>('#temporal-scrubber-slider');
    if (slider) {
      const sliderHandler = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const newIdx = parseInt(target.value, 10) - 1;
        this.setScrubberIndex(newIdx);
      };
      slider.addEventListener('input', sliderHandler);
      this.scrubberHandlers.set(slider, { type: 'input', fn: sliderHandler as EventListener });
    }

    // Bind slot node buttons
    const nodeButtons = mountEl.querySelectorAll<HTMLButtonElement>('.scrubber-node');
    nodeButtons.forEach(btn => {
      const clickHandler = () => {
        const slotIdx = parseInt(btn.dataset.slotIndex ?? '0', 10);
        this.setScrubberIndex(slotIdx);
      };
      btn.addEventListener('click', clickHandler);
      this.scrubberHandlers.set(btn, { type: 'click', fn: clickHandler as EventListener });
    });

    // Bind inspector shift buttons
    const inspUpBtn = mountEl.querySelector<HTMLButtonElement>('#inspector-move-up-btn');
    if (inspUpBtn) {
      const inspUpHandler = () => this.moveUp(this.currentScrubberIndex);
      inspUpBtn.addEventListener('click', inspUpHandler);
      this.scrubberHandlers.set(inspUpBtn, { type: 'click', fn: inspUpHandler as EventListener });
    }

    const inspDownBtn = mountEl.querySelector<HTMLButtonElement>('#inspector-move-down-btn');
    if (inspDownBtn) {
      const inspDownHandler = () => this.moveDown(this.currentScrubberIndex);
      inspDownBtn.addEventListener('click', inspDownHandler);
      this.scrubberHandlers.set(inspDownBtn, { type: 'click', fn: inspDownHandler as EventListener });
    }
  }

  private renderEventList(focusTargetId?: string): void {
    if (!this.root) return;
    const listEl = this.root.querySelector<HTMLOListElement>('#timeline-list');
    if (!listEl) return;

    this.cleanupListItemHandlers();
    this.cleanupDragHandlers();
    listEl.innerHTML = '';

    const eventsMap = new Map<string, TimelineEvent>();
    for (const ev of TIMELINE_EVENTS) {
      eventsMap.set(ev.id, ev);
    }

    this.currentOrder.forEach((eventId, index) => {
      const ev = eventsMap.get(eventId);
      if (!ev) return;

      const isFirst = index === 0;
      const isLast = index === this.currentOrder.length - 1;
      const isInspected = index === this.currentScrubberIndex;

      const li = document.createElement('li');
      li.className = `timeline-event-card ${isInspected ? 'is-inspected' : ''}`;
      li.dataset.eventId = ev.id;
      li.dataset.index = String(index);
      li.draggable = !this.isSolved && !this.isExpired;
      li.style.cssText = `
        padding: 1rem;
        background: rgba(30, 41, 59, 0.7);
        border: 1px solid #334155;
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        cursor: grab;
      `;

      li.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span class="badge badge--active" style="font-family: monospace; font-size: 0.75rem;">
              POS #${index + 1}
            </span>
            <strong style="color: var(--col-accent); font-family: monospace;">${ev.id}</strong>
            <span style="font-size: 0.75rem; background: var(--col-surface-2); color: var(--col-accent); border: 1px solid var(--col-border); padding: 0.15rem 0.4rem; border-radius: 3px; font-family: monospace;">
              ${ev.evidenceType}
            </span>
            <span style="font-family: monospace; font-size: 0.8rem; color: #fbbf24;">
              [RAW: ${ev.rawTimestamp}]
            </span>
            <span style="font-family: monospace; font-size: 0.8rem; color: var(--col-accent);">
              [UTC: ${ev.normalizedUtc}]
            </span>
          </div>

          <div class="timeline-controls" style="display: flex; gap: 0.25rem;">
            <button
              type="button"
              class="btn btn--secondary btn--sm btn-move-up"
              data-index="${index}"
              ${isFirst || this.isSolved || this.isExpired ? 'disabled' : ''}
              aria-label="Move ${ev.id} up in timeline"
              style="padding: 0.2rem 0.5rem; font-size: 0.75rem;"
            >▲</button>
            <button
              type="button"
              class="btn btn--secondary btn--sm btn-move-down"
              data-index="${index}"
              ${isLast || this.isSolved || this.isExpired ? 'disabled' : ''}
              aria-label="Move ${ev.id} down in timeline"
              style="padding: 0.2rem 0.5rem; font-size: 0.75rem;"
            >▼</button>
          </div>
        </div>

        <div style="font-weight: 600; color: var(--col-text-1); font-size: 0.95rem;">
          ${ev.title}
        </div>

        <p style="margin: 0; font-size: 0.85rem; color: var(--col-text-2); line-height: 1.4;">
          ${ev.description}
        </p>

        <div style="font-size: 0.78rem; color: var(--col-text-2); background: var(--col-mono-bg); padding: 0.4rem 0.6rem; border-left: 3px solid var(--col-accent); border-radius: 2px; font-family: monospace;">
          <strong>FORENSIC NOTE:</strong> ${ev.forensicNote}
        </div>
      `;

      listEl.appendChild(li);

      // Click card to inspect
      const cardClickHandler = (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.closest('button')) return;
        this.setScrubberIndex(index);
      };
      li.addEventListener('click', cardClickHandler);
      this.listItemHandlers.set(li, cardClickHandler);

      // Drag and drop handlers
      const dragStartHandler = (e: DragEvent) => {
        if (this.isSolved || this.isExpired) return;
        this.draggedIndex = index;
        li.classList.add('is-dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(index));
        }
      };
      const dragOverHandler = (e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        li.classList.add('is-drag-over');
      };
      const dragLeaveHandler = () => {
        li.classList.remove('is-drag-over');
      };
      const dropHandler = (e: DragEvent) => {
        e.preventDefault();
        li.classList.remove('is-drag-over');
        if (this.draggedIndex !== null && this.draggedIndex !== index) {
          const item = this.currentOrder.splice(this.draggedIndex, 1)[0];
          this.currentOrder.splice(index, 0, item);
          this.currentScrubberIndex = index;
          this.renderScrubber();
          this.renderEventList(item);
        }
        this.draggedIndex = null;
      };
      const dragEndHandler = () => {
        li.classList.remove('is-dragging');
        li.classList.remove('is-drag-over');
        this.draggedIndex = null;
      };

      li.addEventListener('dragstart', dragStartHandler as EventListener);
      li.addEventListener('dragover', dragOverHandler as EventListener);
      li.addEventListener('dragleave', dragLeaveHandler as EventListener);
      li.addEventListener('drop', dropHandler as EventListener);
      li.addEventListener('dragend', dragEndHandler as EventListener);

      this.dragHandlers.push(
        { el: li, type: 'dragstart', fn: dragStartHandler as EventListener },
        { el: li, type: 'dragover', fn: dragOverHandler as EventListener },
        { el: li, type: 'dragleave', fn: dragLeaveHandler as EventListener },
        { el: li, type: 'drop', fn: dropHandler as EventListener },
        { el: li, type: 'dragend', fn: dragEndHandler as EventListener }
      );

      // Event listener bindings for list items
      const upBtn = li.querySelector<HTMLButtonElement>('.btn-move-up');
      if (upBtn) {
        const handler = () => this.moveUp(index);
        upBtn.addEventListener('click', handler);
        this.listItemHandlers.set(upBtn, handler);
      }

      const downBtn = li.querySelector<HTMLButtonElement>('.btn-move-down');
      if (downBtn) {
        const handler = () => this.moveDown(index);
        downBtn.addEventListener('click', handler);
        this.listItemHandlers.set(downBtn, handler);
      }
    });

    this.updateSequencePreview();

    // Re-focus target element if requested
    if (focusTargetId && this.root) {
      const targetCard = this.root.querySelector<HTMLElement>(`[data-event-id="${focusTargetId}"]`);
      const targetBtn = targetCard?.querySelector<HTMLButtonElement>('.btn-move-up, .btn-move-down');
      targetBtn?.focus();
    }
  }

  private highlightScrubbedCard(): void {
    if (!this.root) return;
    const cards = this.root.querySelectorAll<HTMLElement>('.timeline-event-card');
    cards.forEach((card, idx) => {
      if (idx === this.currentScrubberIndex) {
        card.classList.add('is-inspected');
      } else {
        card.classList.remove('is-inspected');
      }
    });
  }

  private updateSequencePreview(): void {
    if (!this.root) return;
    const previewEl = this.root.querySelector<HTMLElement>('#timeline-sequence-preview');
    const input = this.root.querySelector<HTMLInputElement>('#temporal-answer');

    const sequenceString = this.currentOrder.join('-');
    const displayString = this.currentOrder.join(' \u2192 ');

    if (previewEl) {
      previewEl.textContent = displayString;
    }
    if (input && !this.isSolved) {
      input.value = sequenceString;
    }
  }

  // ---------------------------------------------------------------------------
  // Event Bindings
  // ---------------------------------------------------------------------------

  private bindEvents(): void {
    if (!this.root) return;

    // Form submission
    const form = this.root.querySelector<HTMLFormElement>('#temporal-form');
    this.formHandler = (e: Event) => {
      e.preventDefault();
      const input = this.root?.querySelector<HTMLInputElement>('#temporal-answer');
      const val = input?.value ?? this.currentOrder.join('-');
      void this.submitAnswer(val);
    };
    form?.addEventListener('submit', this.formHandler);

    // Reset Order button
    const resetOrderBtn = this.root.querySelector<HTMLButtonElement>('#reset-order-btn');
    if (resetOrderBtn) {
      const resetHandler = () => this.resetOrder();
      resetOrderBtn.addEventListener('click', resetHandler);
      this.panelHandlers.set(resetOrderBtn, resetHandler);
    }

    // Progressive Hint button
    const hintBtn = this.root.querySelector<HTMLButtonElement>('#temporal-hint-btn');
    if (hintBtn) {
      const hintHandler = () => this.revealNextHint();
      hintBtn.addEventListener('click', hintHandler);
      this.panelHandlers.set(hintBtn, hintHandler);
    }

    // Visibility change listener to compensate for background throttling
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && !this.isSolved && !this.isExpired) {
        this.updateTimerTick();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private cleanupScrubberHandlers(): void {
    for (const [el, { type, fn }] of this.scrubberHandlers.entries()) {
      el.removeEventListener(type, fn);
    }
    this.scrubberHandlers.clear();
  }

  private cleanupDragHandlers(): void {
    for (const { el, type, fn } of this.dragHandlers) {
      el.removeEventListener(type, fn);
    }
    this.dragHandlers = [];
  }

  private cleanupListItemHandlers(): void {
    for (const [el, handler] of this.listItemHandlers.entries()) {
      el.removeEventListener('click', handler);
    }
    this.listItemHandlers.clear();
  }

  private cleanupPanelHandlers(): void {
    for (const [el, handler] of this.panelHandlers.entries()) {
      el.removeEventListener('click', handler);
    }
    this.panelHandlers.clear();
  }

  // ---------------------------------------------------------------------------
  // Clues & Diagnostic Feedback
  // ---------------------------------------------------------------------------

  private revealNextHint(): void {
    if (this.hintsRevealed >= HINTS.length || !this.root) return;

    const list = this.root.querySelector('#temporal-hints-list');
    const btn = this.root.querySelector<HTMLButtonElement>('#temporal-hint-btn');
    if (!list) return;

    const hintEl = document.createElement('p');
    hintEl.className = 'hint-item';
    hintEl.innerHTML = `<strong>CLUE ${this.hintsRevealed + 1}:</strong> ${HINTS[this.hintsRevealed]}`;
    list.appendChild(hintEl);

    this.hintsRevealed++;

    if (btn) {
      if (this.hintsRevealed >= HINTS.length) {
        btn.textContent = 'All Clues Revealed (3/3)';
        btn.disabled = true;
      } else {
        btn.textContent = `Reveal Clue (${this.hintsRevealed}/${HINTS.length})`;
      }
    }
  }

  private generateDiagnosticFeedback(rawInput: string): string {
    const normalized = normalizeAnswer(rawInput);
    if (!normalized) {
      return 'Invalid timeline format. Arrange all 5 evidence events (e.g. EV-302-EV-814-EV-409-EV-127-EV-955).';
    }

    // Extract EV-xxx patterns
    const matches = normalized.match(/EV-\d+/g);
    if (!matches || matches.length !== 5) {
      return 'Incomplete sequence. The timeline must contain all 5 distinct evidence events.';
    }

    const uniqueSet = new Set(matches);
    if (uniqueSet.size !== 5) {
      return 'Duplicate events detected. Every event must appear exactly once in the sequence.';
    }

    // Check if player sorted by raw recorded timestamp strings without adjustments:
    // Raw strings: EV-814 (01:55), EV-302 (02:15), EV-409 (03:08), EV-955 (03:45), EV-127 (23:22)
    const isRawSorted = matches[0] === 'EV-814' || matches[4] === 'EV-127';
    if (isRawSorted) {
      return 'Temporal paradox detected: Raw timestamps contain hardware clock drift and timezone skew. Convert EST to UTC and inspect RTC battery notes.';
    }

    // Calculate positional match count without revealing positions
    let correctSlots = 0;
    for (let i = 0; i < 5; i++) {
      if (matches[i] === CORRECT_CHRONOLOGY[i]) {
        correctSlots++;
      }
    }

    return `Chronology rejected: ${correctSlots} of 5 events in correct position. Align timestamps to unified UTC and verify causal order.`;
  }

  private markSolved(): void {
    if (!this.root) return;
    this.isSolved = true;
    this.root.dataset.status = 'solved';

    const badge = this.root.querySelector<HTMLElement>('#temporal-badge');
    if (badge) {
      badge.className = 'layer-meta__badge badge badge--success';
      badge.textContent = 'CHRONOLOGY VERIFIED';
    }

    const tierBadge = this.root.querySelector<HTMLElement>('#entropy-tier-badge');
    if (tierBadge) {
      tierBadge.textContent = 'COHERENCE STABILIZED';
      tierBadge.className = 'entropy-gauge__tier-badge badge badge--success';
    }

    // Disable reordering controls
    const buttons = this.root.querySelectorAll<HTMLButtonElement>(
      '.btn-move-up, .btn-move-down, #reset-order-btn, #inspector-move-up-btn, #inspector-move-down-btn, .scrubber-node'
    );
    buttons.forEach(btn => {
      btn.disabled = true;
    });

    const slider = this.root.querySelector<HTMLInputElement>('#temporal-scrubber-slider');
    if (slider) slider.disabled = true;

    const input = this.root.querySelector<HTMLInputElement>('#temporal-answer');
    if (input) input.disabled = true;

    const submitBtn = this.root.querySelector<HTMLButtonElement>('#temporal-submit');
    if (submitBtn) submitBtn.style.display = 'none';

    const statusEl = this.root.querySelector<HTMLElement>('#temporal-status');
    this.setStatus(
      statusEl,
      'success',
      'Temporal sequence verified. Event causality aligned to UTC standard. Clearance granted to Layer 05.'
    );

    // Append Continue button
    let continueBtn = this.root.querySelector<HTMLButtonElement>('#temporal-continue');
    if (!continueBtn) {
      continueBtn = document.createElement('button');
      continueBtn.id = 'temporal-continue';
      continueBtn.type = 'button';
      continueBtn.className = 'btn btn--primary';
      continueBtn.textContent = 'Continue to Final Stage';
      continueBtn.addEventListener('click', () => {
        this.container?.dispatchEvent(new CustomEvent('layer:continue', { bubbles: true }));
      });
      const form = this.root.querySelector('.answer-form');
      form?.appendChild(continueBtn);
    }
    continueBtn.focus();
  }

  private setStatus(el: HTMLElement | null | undefined, type: 'error' | 'success' | 'info', text: string): void {
    if (!el) return;
    el.className = `status-msg status-msg--${type}`;
    el.textContent = text;
  }
}
