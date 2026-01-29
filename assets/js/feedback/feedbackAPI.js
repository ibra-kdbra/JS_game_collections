/**
 * Feedback API Service
 * Uses Cloudflare Worker proxy for secure database access
 */

// TODO: Replace with your actual Cloudflare Worker URL after deployment
const API_URL = 'https://js-game-feedback-api.sonarfarouq.workers.dev';

class FeedbackService {
    constructor() {
        this.initialized = true; // No init needed with proxy
    }

    /**
     * Submit new feedback
     * @param {string} pageId - Page/game identifier
     * @param {number} rating - Rating (1-5)
     * @param {string} comment - Feedback comment
     * @param {string} authorName - Author's name
     */
    async submitFeedback(pageId, rating, comment, authorName) {
        try {
            const response = await fetch(`${API_URL}/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    page_id: pageId,
                    name: authorName || 'Anonymous',
                    message: comment,
                    rating: rating
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to submit feedback:', error);
            throw error;
        }
    }

    /**
     * Get feedback for a specific page
     * @param {string} pageId - Page/game identifier (optional filter)
     */
    async getFeedback(pageId) {
        try {
            const url = pageId
                ? `${API_URL}/feedback?page_id=${encodeURIComponent(pageId)}`
                : `${API_URL}/feedback`;

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return { rows: data.results?.[0]?.rows || data.rows || [] };
        } catch (error) {
            console.error('Failed to fetch feedback:', error);
            return { rows: [] };
        }
    }

    /**
     * Get aggregate stats for a page (placeholder - implement in worker if needed)
     */
    async getStats(pageId) {
        const feedback = await this.getFeedback(pageId);
        const rows = feedback.rows || [];
        const count = rows.length;
        const average = count > 0
            ? rows.reduce((sum, r) => sum + (r.rating || 0), 0) / count
            : 0;
        return { count, average };
    }

    /**
     * Init method (no-op, kept for compatibility)
     */
    async init() {
        // No initialization needed when using proxy
        return true;
    }
}

// Singleton instance
export const feedbackAPI = new FeedbackService();
