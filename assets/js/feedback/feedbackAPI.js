import { TursoClient } from './tursoClient.js';
import CONFIG from '../config.js';

class FeedbackService {
    constructor() {
        this.client = new TursoClient(CONFIG.turso);
        this.initialized = false;
    }

    /**
     * Initialize database tables if they don't exist
     */
    async init() {
        if (this.initialized) return;

        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id TEXT NOT NULL,
                rating INTEGER CHECK(rating >= 1 AND rating <= 5),
                comment TEXT,
                author_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `;

        try {
            await this.client.execute(createTableSQL);
            this.initialized = true;
            console.log('Feedback system initialized');
        } catch (error) {
            console.error('Failed to initialize feedback tables:', error);
        }
    }

    /**
     * Submit new feedback
     */
    async submitFeedback(gameId, rating, comment, authorName) {
        if (!this.initialized) await this.init();

        const sql = `
            INSERT INTO feedback (game_id, rating, comment, author_name)
            VALUES (?, ?, ?, ?)
            RETURNING id, created_at
        `;

        return await this.client.execute(sql, [gameId, rating, comment, authorName || 'Anonymous']);
    }

    /**
     * Get feedback for a specific game
     */
    async getFeedback(gameId) {
        if (!this.initialized) await this.init();

        const sql = `
            SELECT * FROM feedback 
            WHERE game_id = ? 
            ORDER BY created_at DESC 
            LIMIT 50
        `;

        return await this.client.execute(sql, [gameId]);
    }

    /**
     * Get aggregate stats for a game
     */
    async getStats(gameId) {
        if (!this.initialized) await this.init();

        const sql = `
            SELECT 
                COUNT(*) as count,
                AVG(rating) as average
            FROM feedback
            WHERE game_id = ?
        `;

        const result = await this.client.execute(sql, [gameId]);
        return result.rows[0]; // Access first row from results
    }
}

// Singleton instance
export const feedbackAPI = new FeedbackService();
