/**
 * Union Wheel of Fortune - Supabase Data Layer
 * Handles all database operations for players, games, and statistics.
 */

// ===================================
// Supabase Configuration
// ===================================

const SUPABASE_URL = 'https://mivnvbinxjgsqhyojmxt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pdm52YmlueGpnc3FoeW9qbXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzMxODEsImV4cCI6MjA4NDU0OTE4MX0._AWoICzkyxASsNW1XT8srfz7QfepjiySSa8IBityC1c';

// ===================================
// Supabase Client Initialization
// ===================================

let supabaseClient = null;

/**
 * Initialize the Supabase client
 * Uses the Supabase CDN for browser environments
 */
function initSupabase() {
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
        console.warn('Supabase credentials not configured. Running in offline mode.');
        return false;
    }

    if (typeof window.supabase !== 'undefined') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    }

    console.error('Supabase library not loaded');
    return false;
}

/**
 * Check if Supabase is configured and connected
 * @returns {boolean}
 */
function isSupabaseConnected() {
    return supabaseClient !== null;
}

// ===================================
// Player Operations
// ===================================

const PlayerService = {
    /**
     * Fetch all players
     * @param {boolean} activeOnly - If true, only return active players
     * @returns {Promise<Array>} Array of player objects
     */
    async getAll(activeOnly = false) {
        if (!isSupabaseConnected()) return [];

        let query = supabaseClient
            .from('players')
            .select('*')
            .order('name');

        if (activeOnly) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching players:', error);
            return [];
        }

        return data || [];
    },

    /**
     * Add a new player
     * @param {string} name - Player name
     * @returns {Promise<Object|null>} Created player or null on error
     */
    async add(name) {
        if (!isSupabaseConnected()) return null;

        const { data, error } = await supabaseClient
            .from('players')
            .insert([{ name: name.trim() }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new Error('A player with this name already exists');
            }
            console.error('Error adding player:', error);
            throw error;
        }

        return data;
    },

    /**
     * Update a player
     * @param {string} id - Player UUID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object|null>} Updated player or null on error
     */
    async update(id, updates) {
        if (!isSupabaseConnected()) return null;

        const { data, error } = await supabaseClient
            .from('players')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating player:', error);
            return null;
        }

        return data;
    },

    /**
     * Toggle player active status
     * @param {string} id - Player UUID
     * @param {boolean} isActive - New active status
     * @returns {Promise<Object|null>}
     */
    async toggleActive(id, isActive) {
        return this.update(id, { is_active: isActive });
    },

    /**
     * Delete a player
     * @param {string} id - Player UUID
     * @returns {Promise<boolean>} Success status
     */
    async delete(id) {
        if (!isSupabaseConnected()) return false;

        const { error } = await supabaseClient
            .from('players')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting player:', error);
            return false;
        }

        return true;
    },

    /**
     * Get player by name
     * @param {string} name - Player name
     * @returns {Promise<Object|null>}
     */
    async getByName(name) {
        if (!isSupabaseConnected()) return null;

        const { data, error } = await supabaseClient
            .from('players')
            .select('*')
            .eq('name', name.trim())
            .single();

        if (error) {
            return null;
        }

        return data;
    }
};

// ===================================
// Game Operations
// ===================================

const GameService = {
    /**
     * Save a completed game with results
     * @param {Array} results - Array of { player: string, punishment: number }
     * @returns {Promise<Object|null>} Created game or null on error
     */
    async saveGame(results) {
        if (!isSupabaseConnected()) return null;

        // Validate input
        if (!Array.isArray(results) || results.length !== 3) {
            console.error('Invalid results: expected array of 3 items');
            return null;
        }

        // First, verify all players exist before creating the game
        const playerLookups = await Promise.all(
            results.map(result => PlayerService.getByName(result.player))
        );

        // Check if any player wasn't found
        const missingPlayers = results.filter((result, i) => !playerLookups[i]);
        if (missingPlayers.length > 0) {
            console.error('Players not found in database:', missingPlayers.map(p => p.player));
            return null;
        }

        // All players exist, now create the game record
        const { data: game, error: gameError } = await supabaseClient
            .from('games')
            .insert([{}])
            .select()
            .single();

        if (gameError) {
            console.error('Error creating game:', gameError);
            return null;
        }

        // Create result records
        const gameResults = playerLookups.map((player, i) => ({
            game_id: game.id,
            player_id: player.id,
            punishment_value: results[i].punishment,
            selection_order: i + 1
        }));

        const { error: resultsError } = await supabaseClient
            .from('game_results')
            .insert(gameResults);

        if (resultsError) {
            console.error('Error saving game results:', resultsError);
        }

        return game;
    },

    /**
     * Get recent games with results
     * @param {number} limit - Number of games to fetch
     * @returns {Promise<Array>}
     */
    async getRecentGames(limit = 10) {
        if (!isSupabaseConnected()) return [];

        const { data, error } = await supabaseClient
            .from('games')
            .select(`
                id,
                played_at,
                game_results (
                    punishment_value,
                    selection_order,
                    players (
                        name
                    )
                )
            `)
            .order('played_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching recent games:', error);
            return [];
        }

        // Transform data for easier consumption
        return (data || []).map(game => ({
            id: game.id,
            playedAt: new Date(game.played_at),
            results: (game.game_results || [])
                .sort((a, b) => a.selection_order - b.selection_order)
                .map(r => ({
                    player: r.players?.name || 'Unknown',
                    punishment: r.punishment_value,
                    order: r.selection_order
                }))
        }));
    },

    /**
     * Get total number of games played
     * @returns {Promise<number>}
     */
    async getTotalGames() {
        if (!isSupabaseConnected()) return 0;

        const { count, error } = await supabaseClient
            .from('games')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('Error counting games:', error);
            return 0;
        }

        return count || 0;
    }
};

// ===================================
// Statistics Operations
// ===================================

const StatsService = {
    /**
     * Get player statistics (leaderboard)
     * @returns {Promise<Array>}
     */
    async getPlayerStats() {
        if (!isSupabaseConnected()) return [];

        const { data, error } = await supabaseClient
            .from('player_stats')
            .select('*');

        if (error) {
            // View might not exist, fall back to manual query
            return this.getPlayerStatsManual();
        }

        return data || [];
    },

    /**
     * Manual player stats calculation (fallback if view doesn't exist)
     * @returns {Promise<Array>}
     */
    async getPlayerStatsManual() {
        if (!isSupabaseConnected()) return [];

        const { data: players, error: playersError } = await supabaseClient
            .from('players')
            .select('id, name');

        if (playersError) return [];

        const { data: results, error: resultsError } = await supabaseClient
            .from('game_results')
            .select('player_id, punishment_value, game_id');

        if (resultsError) return [];

        // Calculate stats manually
        const statsMap = new Map();

        players.forEach(player => {
            statsMap.set(player.id, {
                id: player.id,
                name: player.name,
                times_selected: 0,
                total_punishment_points: 0,
                avg_punishment: 0,
                highest_single_punishment: 0,
                games_played: new Set()
            });
        });

        results.forEach(result => {
            const stat = statsMap.get(result.player_id);
            if (stat) {
                stat.times_selected++;
                stat.total_punishment_points += result.punishment_value;
                stat.highest_single_punishment = Math.max(
                    stat.highest_single_punishment,
                    result.punishment_value
                );
                stat.games_played.add(result.game_id);
            }
        });

        return Array.from(statsMap.values())
            .map(stat => ({
                ...stat,
                avg_punishment: stat.times_selected > 0
                    ? Math.round(stat.total_punishment_points / stat.times_selected)
                    : 0,
                games_played: stat.games_played.size
            }))
            .sort((a, b) => b.total_punishment_points - a.total_punishment_points);
    },

    /**
     * Get punishment distribution stats
     * @returns {Promise<Object>}
     */
    async getPunishmentDistribution() {
        if (!isSupabaseConnected()) {
            return { 75: 0, 100: 0, 200: 0, 250: 0, 500: 0 };
        }

        const { data, error } = await supabaseClient
            .from('game_results')
            .select('punishment_value');

        if (error) {
            return { 75: 0, 100: 0, 200: 0, 250: 0, 500: 0 };
        }

        const distribution = { 75: 0, 100: 0, 200: 0, 250: 0, 500: 0 };

        (data || []).forEach(result => {
            if (distribution.hasOwnProperty(result.punishment_value)) {
                distribution[result.punishment_value]++;
            }
        });

        return distribution;
    },

    /**
     * Get overall statistics summary
     * @returns {Promise<Object>}
     */
    async getSummary() {
        const [totalGames, playerStats, distribution] = await Promise.all([
            GameService.getTotalGames(),
            this.getPlayerStats(),
            this.getPunishmentDistribution()
        ]);

        const totalPunishments = Object.values(distribution).reduce((a, b) => a + b, 0);
        const totalPoints = playerStats.reduce((sum, p) => sum + p.total_punishment_points, 0);

        return {
            totalGames,
            totalPlayers: playerStats.length,
            totalPunishmentsGiven: totalPunishments,
            totalPointsAwarded: totalPoints,
            distribution
        };
    }
};

// ===================================
// Authentication Service
// ===================================

const AuthService = {
    /**
     * Login with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} { data, error }
     */
    async login(email, password) {
        if (!isSupabaseConnected()) {
            return { data: null, error: { message: 'Database not connected' } };
        }

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            return { data, error };
        } catch (err) {
            console.error('Login error:', err);
            return { data: null, error: { message: 'Connection error. Please try again.' } };
        }
    },

    /**
     * Logout current user
     * @returns {Promise<Object>}
     */
    async logout() {
        if (!isSupabaseConnected()) return { error: null };
        return await supabaseClient.auth.signOut();
    },

    /**
     * Get current session
     * @returns {Promise<Object|null>} Session or null
     */
    async getSession() {
        if (!isSupabaseConnected()) return null;

        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            return session;
        } catch (error) {
            console.error('Error getting session:', error);
            return null;
        }
    },

    /**
     * Check if user is authenticated
     * @returns {Promise<boolean>}
     */
    async isAuthenticated() {
        const session = await this.getSession();
        return !!session;
    },

    /**
     * Get current user
     * @returns {Promise<Object|null>}
     */
    async getCurrentUser() {
        const session = await this.getSession();
        return session?.user || null;
    }
};

// ===================================
// Export for use in other modules
// ===================================

window.SupabaseDB = {
    init: initSupabase,
    isConnected: isSupabaseConnected,
    players: PlayerService,
    games: GameService,
    stats: StatsService,
    auth: AuthService
};
