import type { PuzzleLayer, LayerId, LayerStatus, SolveResult } from '../core/types.js';
import { stateMachine } from '../core/state-machine.js';
import { normalizeAnswer } from '../core/answer-validator.js';

/**
 * SECURITY & PUZZLE ARCHITECTURE NOTE:
 *
 * This layer is an educational client-side puzzle demonstrating DOM inspection
 * and the browser MutationObserver API.
 *
 * DevTools inspection and attribute mutation are the intended solution mechanic:
 * the player opens DevTools -> Elements, locates the #evidence-seal element,
 * and changes data-seal="intact" to data-seal="verified".
 *
 * This design explicitly embraces the browser's transparent execution environment
 * rather than attempting to enforce an impossible client-side security boundary.
 */

const EXPECTED_ATTRIBUTE = 'data-seal';
const EXPECTED_VALUE = 'verified';
const INITIAL_VALUE = 'intact';

const HINTS: readonly string[] = [
  'Open Developer Tools (press F12, Ctrl+Shift+I on Windows, or right-click the seal container below and select "Inspect").',
  'In the Elements DOM tree, locate the container with id="evidence-seal". Notice its data-seal="intact" attribute.',
  'Double-click the value "intact" inside data-seal="..." and edit it directly to "verified", then press Enter.',
];

export class DomLayer implements PuzzleLayer {
  readonly id: LayerId = 'dom-inspect';
  readonly displayName = 'Digital Evidence Seal';
  status: LayerStatus = 'active';

  private container: HTMLElement | null = null;
  private root: HTMLElement | null = null;
  private targetElement: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private hintsRevealed = 0;
  private isSolved = false;
  private isSubmitting = false;

  // -- PuzzleLayer interface ------------------------------------------------

  mount(container: HTMLElement): void {
    this.container = container;
    this.root = this.buildDOM();
    container.appendChild(this.root);
    this.targetElement = this.root.querySelector<HTMLElement>('#evidence-seal');
    this.bindEvents();
  }

  activate(): void {
    this.status = 'active';
    if (!this.root) return;
    this.root.dataset.status = 'active';

    this.startObserving();

    // Check if the element was already mutated prior to activate call
    const currentVal = this.targetElement?.getAttribute(EXPECTED_ATTRIBUTE);
    if (currentVal && normalizeAnswer(currentVal) === 'VERIFIED' && !this.isSolved) {
      void this.handleSuccess();
    }

  }

  destroy(): void {

    this.stopObserving();
    if (this.root && this.container?.contains(this.root)) {
      this.container.removeChild(this.root);
    }
    this.root = null;
    this.targetElement = null;
    this.container = null;
  }

  async submitAnswer(answer: string): Promise<SolveResult> {
    return stateMachine.solve(this.id, answer);
  }

  // -- MutationObserver Logic -----------------------------------------------

  private startObserving(): void {
    if (!this.targetElement || this.observer || this.isSolved) return;

    this.observer = new MutationObserver(mutations => {
      this.handleMutations(mutations);
    });

    this.observer.observe(this.targetElement, {
      attributes: true,
      attributeFilter: [EXPECTED_ATTRIBUTE],
      attributeOldValue: true,
    });
  }

  private stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  private handleMutations(mutations: MutationRecord[]): void {
    if (this.isSolved || !this.targetElement) return;

    for (const mutation of mutations) {
      // Strictly validate mutation target and attribute name
      if (mutation.type !== 'attributes') continue;
      if (mutation.attributeName !== EXPECTED_ATTRIBUTE) continue;
      if (mutation.target !== this.targetElement) continue;

      const currentValue = this.targetElement.getAttribute(EXPECTED_ATTRIBUTE);
      if (currentValue === null) continue;

      this.updateVisualDisplay(currentValue);

      if (normalizeAnswer(currentValue) === 'VERIFIED') {
        void this.handleSuccess();
        break;
      } else {
        this.handleIncorrectMutation(currentValue);
      }

    }
  }

  private async handleSuccess(): Promise<void> {
    if (this.isSolved || this.isSubmitting) return;
    this.isSubmitting = true;

    const badge = this.root?.querySelector<HTMLElement>('#seal-status-badge');
    const msg = this.root?.querySelector<HTMLElement>('#seal-feedback-message');

    // Show neutral checking state while validating with state machine
    if (badge) {
      badge.className = 'evidence-seal__badge badge badge--active';
      badge.textContent = 'SEAL: CHECKING';
    }
    if (msg) {
      msg.className = 'evidence-seal__message evidence-seal__message--info';
      msg.textContent = 'Attribute verified. Validating seal clearance with state machine…';
    }

    const result = await this.submitAnswer(EXPECTED_VALUE);
    this.isSubmitting = false;

    if (result === 'accepted') {
      this.isSolved = true;
      this.stopObserving();

      this.status = 'solved';
      if (this.root) {
        this.root.dataset.status = 'solved';
      }

      if (badge) {
        badge.className = 'evidence-seal__badge badge badge--solved';
        badge.textContent = 'SEAL: VERIFIED';
      }
      const headerBadge = this.root?.querySelector<HTMLElement>('.layer-meta__badge');
      if (headerBadge) {
        headerBadge.className = 'layer-meta__badge badge badge--solved';
        headerBadge.textContent = 'VERIFIED';
      }
      if (msg) {
        msg.className = 'evidence-seal__message evidence-seal__message--success';
        msg.textContent = 'Seal integrity verified. Manual override authenticated. Clearance granted to Layer 03.';
      }
      this.showContinueButton();
    } else {
      // Roll back UI to neutral failure state and keep observing so player can retry
      if (badge) {
        badge.className = 'evidence-seal__badge badge badge--error';
        badge.textContent = 'SEAL: REJECTED';
      }
      if (msg) {
        msg.className = 'evidence-seal__message evidence-seal__message--error';
        msg.textContent = 'Seal override rejected by security policy. Modify the attribute to retry.';
      }
    }
  }

  private showContinueButton(): void {
    if (!this.root) return;
    let continueBtn = this.root.querySelector<HTMLButtonElement>('#dom-continue');
    if (!continueBtn) {
      continueBtn = document.createElement('button');
      continueBtn.type = 'button';
      continueBtn.className = 'btn btn--primary layer-card__continue';
      continueBtn.id = 'dom-continue';
      continueBtn.textContent = 'Continue to Next Stage';
      continueBtn.addEventListener('click', () => {
        this.root?.dispatchEvent(new CustomEvent('layer:continue', { bubbles: true }));
      });
      const content = this.root.querySelector('.evidence-seal__content');
      content?.appendChild(continueBtn);
    }
  }

  private handleIncorrectMutation(value: string): void {
    const badge = this.root?.querySelector<HTMLElement>('#seal-status-badge');
    const msg = this.root?.querySelector<HTMLElement>('#seal-feedback-message');

    if (badge) {
      badge.className = 'evidence-seal__badge badge badge--error';
      badge.textContent = 'SEAL: INVALID';
    }
    if (msg) {
      msg.className = 'evidence-seal__message evidence-seal__message--error';
      msg.textContent = `Attribute set to "${value}". Tamper-evident seal rejected.`;
    }
  }


  private updateVisualDisplay(value: string): void {
    const displaySpan = this.root?.querySelector<HTMLElement>('#seal-display-value');
    if (displaySpan) {
      displaySpan.textContent = value;
    }
  }

  // -- DOM Construction -----------------------------------------------------

  private buildDOM(): HTMLElement {
    const article = document.createElement('article');
    article.className = 'layer-card';
    article.dataset.status = 'active';
    article.setAttribute('aria-label', 'Evidence File 002 — Digital Evidence Seal');

    article.innerHTML = `
      <header class="layer-card__header">
        <div class="layer-meta">
          <span class="layer-meta__ref">REF&#x202F;#002</span>
          <span class="layer-meta__badge badge badge--active" role="status">ACTIVE</span>
        </div>
        <h2 class="layer-card__title">Digital Evidence Seal</h2>
        <p class="layer-card__layer-id">Layer 02 — DOM Inspection</p>
      </header>

      <div class="layer-card__body">
        <p class="narrative">
          The decrypted transmission references an evidence vault protected by a digital
          tamper-evident seal. Physical input has been disabled by security policy.
          Authentication requires inspecting the document structure and updating the seal status
          directly within the runtime DOM.
        </p>

        <!-- Dedicated Target Element for DevTools Mutation -->
        <div
          id="evidence-seal"
          class="evidence-seal"
          data-seal="${INITIAL_VALUE}"
          role="region"
          aria-label="Tamper-evident evidence seal target"
        >
          <div class="evidence-seal__header">
            <span class="evidence-seal__title">EVIDENCE VAULT #849-B // ACCESS SEAL</span>
            <span class="evidence-seal__badge badge badge--active" id="seal-status-badge">SEAL: INTACT</span>
          </div>

          <div class="evidence-seal__content">
            <div class="evidence-seal__code font-mono">
              &lt;div id="evidence-seal" <strong>data-seal="<span id="seal-display-value">${INITIAL_VALUE}</span>"</strong>&gt;
            </div>

            <p
              class="evidence-seal__message"
              id="seal-feedback-message"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              Access restricted. Tamper seal intact. Modify the data-seal attribute in DevTools to proceed.
            </p>
          </div>
        </div>

        <!-- DevTools Guidance Panel -->
        <div class="devtools-guide" role="note" aria-label="Workstation override instructions">
          <p class="devtools-guide__title font-mono">WORKSTATION MANUAL OVERRIDE PROTOCOL</p>
          <ol class="devtools-guide__steps">
            <li>Open Developer Tools using <kbd>F12</kbd> or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd> (or right-click the seal container above and select <em>Inspect</em>).</li>
            <li>In the <strong>Elements</strong> panel, locate the tag with <code>id="evidence-seal"</code>.</li>
            <li>Observe its attribute: <code>data-seal="${INITIAL_VALUE}"</code>.</li>
            <li>Double-click the attribute value and change it to the verified state indicated by the clue.</li>
          </ol>
        </div>

        <!-- Hints System -->
        <div class="hints">
          <button
            class="hints__toggle"
            type="button"
            aria-expanded="false"
            aria-controls="hints-list-dom"
          >
            <span class="hints__arrow" aria-hidden="true">▸</span>
            Reveal hint
          </button>
          <ol class="hints__list" id="hints-list-dom" hidden></ol>
        </div>
      </div>
    `;

    return article;
  }

  // -- Event Binding --------------------------------------------------------

  private bindEvents(): void {
    if (!this.root) return;

    const hintsToggle = this.root.querySelector<HTMLButtonElement>('.hints__toggle');
    const hintsList = this.root.querySelector<HTMLOListElement>('.hints__list');

    hintsToggle?.addEventListener('click', () => {
      if (this.hintsRevealed >= HINTS.length || !hintsList) return;

      hintsList.hidden = false;
      hintsToggle.setAttribute('aria-expanded', 'true');

      const li = document.createElement('li');
      li.className = 'hint';
      li.textContent = HINTS[this.hintsRevealed];
      hintsList.appendChild(li);
      this.hintsRevealed++;

      if (this.hintsRevealed >= HINTS.length) {
        hintsToggle.textContent = 'All hints revealed';
        hintsToggle.disabled = true;
      }
    });
  }
}
