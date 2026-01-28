/**
 * Turso Client using official LibSQL SDK via CDN
 */
import { createClient } from 'https://esm.sh/@libsql/client@0.6.0/web';

export class TursoClient {
    constructor(config) {
        this.client = createClient({
            url: config.url.replace('libsql://', 'https://'),
            authToken: config.authToken
        });
    }

    /**
     * Execute a SQL query
     */
    async execute(sql, args = []) {
        try {
            const result = await this.client.execute({ sql, args });

            // Standardize output to match our previous format if needed
            // The official client returns { columns: [], rows: [] } where rows are objects if configured?
            // Actually, @libsql/client/web returns rows as objects by default usually, or at least provides access.
            // Let's return the result directly, and rely on standard usage.
            // But my FeedbackAPI expects result.items or similar structure I built in the helper.
            // Let's map it to match what FeedbackAPI expects (arrays of objects).

            // The client returns: { columns: ['id', ...], rows: [{id: 1, ...}, ...] }
            // Check properties: result.rows is usually the array of objects if using standard client.

            return {
                items: result.rows,
                rows: result.rows,
                columns: result.columns,
                ...result
            };

        } catch (error) {
            console.error('Turso Query Error:', error);
            throw error;
        }
    }

    /**
     * Batch execute multiple queries
     */
    async batch(statements) {
        try {
            // official client supports batch(stmts, mode)
            return await this.client.batch(statements, 'write');
        } catch (error) {
            console.error('Turso Batch Error:', error);
            throw error;
        }
    }
}
