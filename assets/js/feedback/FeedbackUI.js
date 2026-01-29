import { feedbackAPI } from './feedbackAPI.js';

export class FeedbackUI {
    constructor(gameId) {
        this.gameId = gameId;
        this.isOpen = false;

        // Multi-solution regex for bad words (matching various formats)
        this.profanityRegex = /b[i1]tch|f[u\*]ck|sh[i1]t|c[u\*]nt|uncensored|badword|testbad|fuck|shit|bitch|asshole|dick|cock|pussy|whore|slut|wanker/gi;

        this.init();
    }

    init() {
        // 1. Create Modal DOM
        this.createModal();

        // 2. Inject Trigger Button if configured
        this.autoAttach();
    }

    autoAttach() {
        // Try to attach to corner-nav in both layouts
        const nav = document.querySelector('.corner-nav');
        if (nav) {
            // Check if already attached
            if (nav.querySelector('.feedback-trigger')) return;

            // If a group container exists, append there (keeps icons together)
            const group = nav.querySelector('.nav-icons-group');
            const target = group || nav;

            const btn = document.createElement('a');
            btn.className = 'corner-link feedback-trigger';
            // Use javascript:void(0) to act like a link but prevent nav
            btn.href = 'javascript:void(0)';
            btn.innerHTML = '<i class="fas fa-comments"></i>';
            btn.title = "Community Feedback";

            btn.onclick = (e) => {
                e.preventDefault();
                this.toggle();
            };

            // Insert at the end
            target.appendChild(btn);
        }
    }

    createModal() {
        // Remove existing if any
        const existing = document.getElementById('feedback-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'feedback-modal';
        modal.className = 'feedback-modal';
        modal.innerHTML = `
            <div class="feedback-modal-content">
                <button class="modal-close">&times;</button>
                
                <div class="feedback-header">
                    <h3><i class="fas fa-comments"></i> Community Feedback</h3>
                    <div class="feedback-stats" id="feedback-stats">
                        <span>Loading stats...</span>
                    </div>
                </div>

                <div class="feedback-body">
                    <form id="feedback-form" class="feedback-form">
                        <div class="rating-input">
                            <span>Rate:</span>
                            <div class="stars">
                                <input type="radio" name="rating" value="5" id="star5"><label for="star5">★</label>
                                <input type="radio" name="rating" value="4" id="star4"><label for="star4">★</label>
                                <input type="radio" name="rating" value="3" id="star3"><label for="star3">★</label>
                                <input type="radio" name="rating" value="2" id="star2"><label for="star2">★</label>
                                <input type="radio" name="rating" value="1" id="star1"><label for="star1">★</label>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <input type="text" id="author-name" placeholder="Your Name (Required)" class="feedback-input" required>
                        </div>
                        
                        <div class="form-group">
                            <textarea id="feedback-comment" placeholder="Share your thoughts..." class="feedback-input" rows="3" required></textarea>
                        </div>

                        <button type="submit" class="btn-submit">Post Feedback</button>
                        <div id="form-message" class="form-message"></div>
                    </form>

                    <div class="feedback-list-container">
                        <div id="feedback-list" class="feedback-list">
                            <div class="loading-spinner"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event Listeners
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.onclick = () => this.close();

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.close();
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        });

        const form = modal.querySelector('#feedback-form');
        form.addEventListener('submit', (e) => this.handleSubmit(e));

        this.modal = modal;
    }

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }

    open() {
        this.modal.classList.add('active');
        this.isOpen = true;
        this.loadFeedback();
        document.body.style.overflow = 'hidden'; // Prevent background scroll
    }

    close() {
        this.modal.classList.remove('active');
        this.isOpen = false;
        document.body.style.overflow = '';
    }

    validateInput(text) {
        if (this.profanityRegex.test(text)) {
            return false;
        }
        return true;
    }

    async handleSubmit(e) {
        e.preventDefault();
        const btn = this.modal.querySelector('.btn-submit');

        // Get values
        const ratingEl = this.modal.querySelector('input[name="rating"]:checked');
        const rating = ratingEl ? parseInt(ratingEl.value) : null;
        const comment = this.modal.querySelector('#feedback-comment').value;
        const author = this.modal.querySelector('#author-name').value.trim();

        // Validation
        if (!rating) {
            this.showMessage('Please select a rating', 'error');
            return;
        }
        if (!author) {
            this.showMessage('Name is required', 'error');
            return;
        }
        if (!this.validateInput(author) || !this.validateInput(comment)) {
            this.showMessage('Please express yourself politely.', 'error');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';

        try {
            await feedbackAPI.submitFeedback(this.gameId, rating, comment, author);
            this.showMessage('Thanks for your feedback!', 'success');
            e.target.reset();
            this.loadFeedback(); // Reload list
        } catch (error) {
            console.error(error);
            this.showMessage('Failed to post feedback. Try again.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Post Feedback';
        }
    }

    showMessage(text, type) {
        const el = this.modal.querySelector('#form-message');
        el.textContent = text;
        el.className = `form-message ${type}`;
        setTimeout(() => el.textContent = '', 3000);
    }

    async loadFeedback() {
        const listContainer = this.modal.querySelector('#feedback-list');
        const statsContainer = this.modal.querySelector('#feedback-stats');

        try {
            // Load list
            const result = await feedbackAPI.getFeedback(this.gameId);

            if (!result.items || result.items.length === 0) {
                listContainer.innerHTML = '<div class="empty-state">No feedback yet. Be the first!</div>';
            } else {
                listContainer.innerHTML = result.items.map(item => this.createFeedbackItem(item)).join('');
            }

            // Load stats
            const stats = await feedbackAPI.getStats(this.gameId);
            const statsData = stats.items ? stats.items[0] : { count: 0, average: 0 };

            const count = statsData.count || 0;
            const avg = statsData.average ? parseFloat(statsData.average).toFixed(1) : '0.0';

            statsContainer.innerHTML = `
                <div class="stat-badge"><i class="fas fa-star"></i> ${avg}</div>
                <div class="stat-count">${count} reviews</div>
            `;

        } catch (error) {
            console.error('Check your config.js or network.', error);
            listContainer.innerHTML = '<div class="error-state">Failed to load feedback.</div>';
        }
    }

    createFeedbackItem(item) {
        const date = new Date(item.created_at).toLocaleDateString();
        const stars = '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating);

        return `
            <div class="feedback-item">
                <div class="feedback-item-header">
                    <span class="author">${item.author_name || 'Anonymous'}</span>
                    <span class="date">${date}</span>
                </div>
                <div class="star-display">${stars}</div>
                <p class="comment-text">${item.comment}</p>
            </div>
        `;
    }
}
