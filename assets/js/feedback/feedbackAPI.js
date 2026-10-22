/**
 * Feedback API Service
 * Uses Cloudflare Worker proxy for secure database access
 */
const API_URL = 'https://js-game-feedback-api.sonarfarouq.workers.dev';

class FeedbackService {
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

            // Parse the Turso response format
            // Response: [{ results: { columns: [...], rows: [[...], [...]] } }]
            const results = data[0]?.results || data.results || {};
            const columns = results.columns || ['id', 'game_id', 'rating', 'comment', 'author_name', 'created_at'];
            const rows = results.rows || [];

            // Convert array rows to objects
            const items = rows.map(row => {
                const obj = {};
                columns.forEach((col, i) => {
                    obj[col] = row[i];
                });
                return obj;
            });

            return { items };
        } catch (error) {
            console.error('Failed to fetch feedback:', error);
            return { items: [] };
        }
    }
}

// Singleton instance
export const feedbackAPI = new FeedbackService();
