import type { PuzzleLayer, LayerId, SolveResult } from '../core/types.js';
import { stateMachine } from '../core/state-machine.js';
import { VALIDATION_UNAVAILABLE_MESSAGE } from '../core/constants.js';

// ---------------------------------------------------------------------------
// Puzzle constants
// ---------------------------------------------------------------------------

const CIPHER_TEXT = 'ZLFGREL-OBK-BCRAF-JVGU-XABJYRQTR';

const HINTS: readonly string[] = [
  'The shift is 13. This is known as ROT-13.',
  'Each letter moves 13 positions forward. A→N, B→O … Z→M. Decode the first word: ZLFGREL.',
  'ZLFGREL = MYSTERY. Apply the same substitution to every letter. Hyphens are unchanged.',
];

// ---------------------------------------------------------------------------
// Layer implementation
// ---------------------------------------------------------------------------

export class CryptoLayer implements PuzzleLayer {
  readonly id: LayerId = 'crypto';
  readonly displayName = 'Encrypted Transmission';

  private container: HTMLElement | null = null;
  private root: HTMLElement | null = null;
  private hintsRevealed = 0;
  private isSolved = false;
  private formHandler: ((e: Event) => void) | null = null;

  // -- PuzzleLayer interface ------------------------------------------------

  mount(container: HTMLElement): void {
    this.container = container;
    this.root = this.buildDOM();
    container.appendChild(this.root);
    this.bindEvents();
  }

  activate(): void {
    if (!this.root) return;
    this.root.dataset.status = 'active';
    this.setInputsDisabled(false);
    const input = this.root.querySelector<HTMLInputElement>('#crypto-answer');
    input?.focus();
  }

  destroy(): void {

    if (this.root && this.container?.contains(this.root)) {
      this.container.removeChild(this.root);
    }
    this.root = null;
    this.container = null;
    this.formHandler = null;
  }

  async submitAnswer(answer: string): Promise<SolveResult> {
    return stateMachine.solve(this.id, answer);
  }


  // -- DOM construction -----------------------------------------------------

  private buildDOM(): HTMLElement {
    const article = document.createElement('article');
    article.className = 'layer-card';
    article.dataset.status = 'active';
    article.setAttribute('aria-label', 'Evidence File 001 — Encrypted Transmission');

    article.innerHTML = `
      <header class="layer-card__header">
        <div class="layer-meta">
          <span class="layer-meta__ref">REF&#x202F;#001</span>
          <span class="layer-meta__badge badge badge--active" role="status">ACTIVE</span>
        </div>
        <h2 class="layer-card__title">Encrypted Transmission</h2>
        <p class="layer-card__layer-id">Layer 01 — Cryptography</p>
      </header>

      <div class="layer-card__body">
        <p class="narrative">
          A message was recovered from the suspect's device during digital forensics.
          The encoding method shifts each letter by a fixed amount.
          The alphabet contains 26&nbsp;letters. The shift is exactly half its length.
        </p>

        <div class="artifact" role="region" aria-label="Intercepted message">
          <p class="artifact__label">
            <span>SIGINT INTERCEPT &bull; FREQ: 142.85 MHz</span>
            <span>CIPHER IDENT: ROT-13</span>
          </p>
          <div class="artifact__content">
            <code class="ciphertext" aria-label="Encrypted ciphertext: ${CIPHER_TEXT}">${CIPHER_TEXT}</code>
            <button
              class="btn btn--ghost btn--sm artifact__copy"
              type="button"
              aria-label="Copy ciphertext to clipboard"
              data-copy="${CIPHER_TEXT}"
            >Copy</button>
          </div>
        </div>

        <form class="answer-form" novalidate aria-label="Submit decrypted answer">
          <div class="answer-form__row">
            <label for="crypto-answer" class="sr-only">Enter the decrypted message</label>
            <input
              id="crypto-answer"
              type="text"
              class="answer-input"
              placeholder="Enter decrypted message…"
              autocomplete="off"
              spellcheck="false"
              aria-describedby="crypto-status"
            />
            <button type="submit" class="btn btn--primary" id="crypto-submit">Submit</button>
          </div>
          <div
            id="crypto-status"
            class="answer-form__status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          ></div>
        </form>

        <div class="hints">
          <button
            class="hints__toggle"
            type="button"
            aria-expanded="false"
            aria-controls="hints-list"
          >
            <span class="hints__arrow" aria-hidden="true">▸</span>
            Reveal hint
          </button>
          <ol class="hints__list" id="hints-list" hidden></ol>
        </div>
      </div>
    `;

    return article;
  }

  // -- Event binding --------------------------------------------------------

  private bindEvents(): void {
    if (!this.root) return;

    // Copy button
    const copyBtn = this.root.querySelector<HTMLButtonElement>('.artifact__copy');
    copyBtn?.addEventListener('click', () => this.handleCopy(copyBtn));

    // Progressive hints
    const hintsToggle = this.root.querySelector<HTMLButtonElement>('.hints__toggle');
    const hintsList = this.root.querySelector<HTMLOListElement>('.hints__list');
    hintsToggle?.addEventListener('click', () =>
      this.handleHintReveal(hintsToggle, hintsList),
    );

    // Answer form
    const form = this.root.querySelector<HTMLFormElement>('.answer-form');
    this.formHandler = (e: Event) => {
      e.preventDefault();
      void this.handleSubmit();
    };
    form?.addEventListener('submit', this.formHandler);
  }

  private handleCopy(btn: HTMLButtonElement): void {
    const text = btn.dataset.copy ?? CIPHER_TEXT;
    const original = btn.textContent;

    if (!navigator.clipboard?.writeText) {
      btn.textContent = 'Failed';
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = original;
        btn.disabled = false;
      }, 2000);
      return;
    }

    navigator.clipboard.writeText(text).then(
      () => {
        btn.textContent = 'Copied';
        btn.disabled = true;
        setTimeout(() => {
          btn.textContent = original;
          btn.disabled = false;
        }, 2000);
      },
      () => {
        btn.textContent = 'Failed';
        btn.disabled = true;
        setTimeout(() => {
          btn.textContent = original;
          btn.disabled = false;
        }, 2000);
      },
    );
  }

  private handleHintReveal(
    toggle: HTMLButtonElement,
    list: HTMLOListElement | null,
  ): void {
    if (this.hintsRevealed >= HINTS.length || !list) return;

    list.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');

    const li = document.createElement('li');
    li.className = 'hint';
    li.textContent = HINTS[this.hintsRevealed];
    list.appendChild(li);
    this.hintsRevealed++;

    if (this.hintsRevealed >= HINTS.length) {
      toggle.textContent = 'All hints revealed';
      toggle.disabled = true;
    }
  }

  private async handleSubmit(): Promise<void> {
    if (!this.root) return;

    const input = this.root.querySelector<HTMLInputElement>('#crypto-answer');
    const submitBtn = this.root.querySelector<HTMLButtonElement>('#crypto-submit');
    const statusEl = this.root.querySelector<HTMLElement>('#crypto-status');
    const answer = input?.value ?? '';

    if (!answer.trim()) {
      this.setStatus(statusEl, 'info', 'Please enter a decrypted message.');
      input?.focus();
      return;
    }

    // Disable form during async validation.
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Checking…'; }

    const result = await this.submitAnswer(answer);

    if (result === 'accepted') {
      this.setStatus(statusEl, 'success', 'Transmission decoded. Clearance granted.');
      this.markSolved();
    } else if (result === 'incorrect') {
      this.setStatus(statusEl, 'error', 'Transmission still encrypted. Check your decoding.');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit'; }
      input?.focus();
    } else if (result === 'error') {
      this.setStatus(statusEl, 'error', VALIDATION_UNAVAILABLE_MESSAGE);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit'; }
      input?.focus();
    } else {
      // 'busy' or 'cancelled': do not show misleading "still encrypted" error.
      if (submitBtn && !this.isSolved) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
      }
    }
  }

  // -- UI helpers -----------------------------------------------------------

  private setStatus(
    el: HTMLElement | null,
    type: 'success' | 'error' | 'info',
    message: string,
  ): void {
    if (!el) return;
    el.className = `answer-form__status answer-form__status--${type}`;
    el.textContent = message;
  }

  private markSolved(): void {
    if (!this.root) return;
    this.isSolved = true;
    this.root.dataset.status = 'solved';

    const badge = this.root.querySelector<HTMLElement>('.layer-meta__badge');
    if (badge) {
      badge.className = 'layer-meta__badge badge badge--solved';
      badge.textContent = 'DECODED';
    }

    const input = this.root.querySelector<HTMLInputElement>('#crypto-answer');
    const submitBtn = this.root.querySelector<HTMLButtonElement>('#crypto-submit');
    if (input) input.disabled = true;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Solved'; }

    const artifact = this.root.querySelector('.artifact');
    if (artifact && !this.root.querySelector('.decoded-banner')) {
      const banner = document.createElement('div');
      banner.className = 'decoded-banner';
      banner.innerHTML = `
        <span style="font-weight: 700; color: var(--col-success);">&#x2713; DECODED PLAINTEXT:</span>
        <code style="color: var(--col-text-1); font-weight: 700; letter-spacing: 0.08em;">MYSTERY-BOX-OPENS-WITH-KNOWLEDGE</code>
      `;
      artifact.appendChild(banner);
    }

    this.showContinueButton();
  }

  private showContinueButton(): void {
    if (!this.root) return;
    let continueBtn = this.root.querySelector<HTMLButtonElement>('#crypto-continue');
    if (!continueBtn) {
      continueBtn = document.createElement('button');
      continueBtn.type = 'button';
      continueBtn.className = 'btn btn--primary layer-card__continue';
      continueBtn.id = 'crypto-continue';
      continueBtn.textContent = 'Continue to Next Stage';
      continueBtn.addEventListener('click', () => {
        this.root?.dispatchEvent(new CustomEvent('layer:continue', { bubbles: true }));
      });
      const form = this.root.querySelector('.answer-form');
      form?.appendChild(continueBtn);
    }
    // The answer input was disabled while focused, so hand focus to Continue.
    continueBtn.focus();
  }


  private setInputsDisabled(disabled: boolean): void {
    if (!this.root) return;
    const input = this.root.querySelector<HTMLInputElement>('#crypto-answer');
    const submitBtn = this.root.querySelector<HTMLButtonElement>('#crypto-submit');
    if (input) input.disabled = disabled;
    if (submitBtn) submitBtn.disabled = disabled;
  }
}
