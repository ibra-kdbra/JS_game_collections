import { feedbackAPI } from './feedbackAPI.js';

const PROFANITY = /b[i1]tch|f[u*]ck|sh[i1]t|c[u*]nt|asshole|dick|cock|pussy|whore|slut|wanker/i;

/**
 * Community feedback in a native <dialog>: focus is trapped and restored,
 * Escape closes it, and everything from the server is rendered as text.
 */
export class FeedbackUI {
  constructor(pageId, { spriteBase }) {
    this.pageId = pageId;
    this.icon = (id) => `<svg class="icon" aria-hidden="true"><use href="${spriteBase}#i-${id}"></use></svg>`;
    this.dialog = this.build();
    document.body.append(this.dialog);
  }

  build() {
    const dialog = document.createElement('dialog');
    dialog.className = 'feedback';
    dialog.setAttribute('aria-labelledby', 'feedback-title');
    dialog.innerHTML = `
      <div class="feedback-head">
        <h2 id="feedback-title">Feedback</h2>
        <p class="feedback-stats" data-stats aria-live="polite"></p>
        <button class="icon-btn feedback-close" type="button" aria-label="Close">${this.icon('close')}</button>
      </div>

      <form class="feedback-form" novalidate>
        <fieldset class="feedback-rating">
          <legend>Your rating</legend>
          ${[1, 2, 3, 4, 5]
            .map(
              (n) => `<label><input type="radio" name="rating" value="${n}" required>${this.icon('star')}<span class="visually-hidden">${n} star${n > 1 ? 's' : ''}</span></label>`,
            )
            .join('')}
        </fieldset>

        <label class="feedback-field">
          <span>Name</span>
          <input name="author" type="text" maxlength="40" autocomplete="nickname" required>
        </label>

        <label class="feedback-field">
          <span>What should we keep, fix or add?</span>
          <textarea name="comment" rows="3" maxlength="600" required></textarea>
        </label>

        <div class="feedback-submit">
          <button class="btn btn-accent" type="submit">Post feedback</button>
          <p class="feedback-message" data-message role="status"></p>
        </div>
      </form>

      <h3 class="feedback-list-title">Recent feedback</h3>
      <ul class="feedback-list" data-list aria-busy="true"></ul>`;

    dialog.querySelector('.feedback-close').addEventListener('click', () => dialog.close());
    // Clicking the backdrop (the dialog element itself, outside its content) closes it.
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => this.opener?.focus());
    dialog.querySelector('form').addEventListener('submit', (e) => this.submit(e));
    return dialog;
  }

  open(opener) {
    this.opener = opener;
    this.dialog.showModal();
    this.load();
  }

  message(text, kind = '') {
    const el = this.dialog.querySelector('[data-message]');
    el.textContent = text;
    el.dataset.kind = kind;
  }

  async submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const rating = Number(form.elements.rating.value);
    const author = form.elements.author.value.trim();
    const comment = form.elements.comment.value.trim();

    if (!rating) return this.message('Pick a rating from one to five stars.', 'error');
    if (!author) return this.message('Add a name so others know who wrote it.', 'error');
    if (!comment) return this.message('Write a few words about what you think.', 'error');
    if (PROFANITY.test(author) || PROFANITY.test(comment)) {
      return this.message('Please keep it friendly.', 'error');
    }

    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    this.message('Posting…');
    try {
      await feedbackAPI.submitFeedback(this.pageId, rating, comment, author);
      form.reset();
      this.message('Thanks, your feedback is posted.', 'success');
      this.load();
    } catch {
      this.message('Couldn’t post right now. Check your connection and try again.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  async load() {
    const list = this.dialog.querySelector('[data-list]');
    const stats = this.dialog.querySelector('[data-stats]');
    list.setAttribute('aria-busy', 'true');

    const { items } = await feedbackAPI.getFeedback(this.pageId);
    list.removeAttribute('aria-busy');

    if (items.length === 0) {
      stats.textContent = 'No ratings yet';
      list.replaceChildren(Object.assign(document.createElement('li'), {
        className: 'feedback-empty',
        textContent: 'Nothing here yet. Be the first to leave a note.',
      }));
      return;
    }

    const average = items.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) / items.length;
    stats.textContent = `${average.toFixed(1)} out of 5 · ${items.length} ${items.length === 1 ? 'review' : 'reviews'}`;
    list.replaceChildren(...items.map((item) => this.item(item)));
  }

  /** Builds one entry with textContent only: comments come from the public and must never be parsed as HTML. */
  item(entry) {
    const li = document.createElement('li');
    li.className = 'feedback-item';

    const head = document.createElement('p');
    head.className = 'feedback-item-head';
    const name = document.createElement('strong');
    name.textContent = entry.author_name || 'Anonymous';
    const date = document.createElement('time');
    const created = new Date(entry.created_at);
    if (!Number.isNaN(created.getTime())) {
      date.dateTime = created.toISOString();
      date.textContent = created.toLocaleDateString();
    }
    head.append(name, date);

    const rating = Math.max(0, Math.min(5, Math.round(Number(entry.rating) || 0)));
    const stars = document.createElement('p');
    stars.className = 'feedback-item-stars';
    stars.textContent = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    stars.setAttribute('aria-label', `${rating} out of 5`);

    const text = document.createElement('p');
    text.textContent = entry.comment ?? '';

    li.append(head, stars, text);
    return li;
  }
}
