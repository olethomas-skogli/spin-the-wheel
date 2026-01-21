/**
 * Union Wheel of Fortune - Statistics Display
 * Handles rendering of leaderboards, player stats, and game history.
 */

// ===================================
// Stats Controller
// ===================================

const StatsController = {
    /**
     * Initialize the stats display
     */
    async init() {
        await this.loadStats();
    },

    /**
     * Load just the leaderboard (for setup screen)
     */
    async loadSetupLeaderboard() {
        if (!window.SupabaseDB?.isConnected()) {
            const container = document.getElementById('setup-leaderboard');
            if (container) {
                container.innerHTML = '<p class="empty-state">Connect to database to view leaderboard</p>';
            }
            return;
        }

        try {
            const playerStats = await window.SupabaseDB.stats.getPlayerStats();
            this.renderLeaderboard(playerStats, 'setup-leaderboard');
        } catch (error) {
            console.error('Error loading setup leaderboard:', error);
            const container = document.getElementById('setup-leaderboard');
            if (container) {
                container.innerHTML = '<p class="empty-state">Error loading leaderboard</p>';
            }
        }
    },

    /**
     * Load and display all statistics
     */
    async loadStats() {
        if (!window.SupabaseDB?.isConnected()) {
            this.showOfflineMessage();
            return;
        }

        // Show loading state
        this.showLoading();

        try {
            // Load all data in parallel
            const [playerStats, recentGames, summary] = await Promise.all([
                window.SupabaseDB.stats.getPlayerStats(),
                window.SupabaseDB.games.getRecentGames(10),
                window.SupabaseDB.stats.getSummary()
            ]);

            // Hide loading and show sections
            this.hideLoading();

            // Render all sections
            this.renderSummary(summary);
            this.renderLeaderboard(playerStats);
            this.renderRecentGames(recentGames);
            this.renderDistribution(summary.distribution);

        } catch (error) {
            console.error('Error loading stats:', error);
            this.hideLoading();
            this.showError();
        }
    },

    /**
     * Show loading state
     */
    showLoading() {
        // Hide all sections and show a loading overlay instead of replacing content
        const sections = document.querySelectorAll('.stats-section');
        sections.forEach(section => section.style.display = 'none');

        // Create or show loading overlay
        let loader = document.getElementById('stats-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'stats-loader';
            loader.className = 'stats-loading';
            loader.innerHTML = `
                <div class="spinner"></div>
                <p>Loading statistics...</p>
            `;
            const container = document.getElementById('stats-content');
            if (container) {
                container.insertBefore(loader, container.firstChild);
            }
        }
        loader.style.display = 'block';
    },

    /**
     * Hide loading state and show sections
     */
    hideLoading() {
        const loader = document.getElementById('stats-loader');
        if (loader) {
            loader.style.display = 'none';
        }
        const sections = document.querySelectorAll('.stats-section');
        sections.forEach(section => section.style.display = 'block');
    },

    /**
     * Show offline message
     */
    showOfflineMessage() {
        const container = document.getElementById('stats-content');
        if (container) {
            container.innerHTML = `
                <div class="stats-offline">
                    <h3>Database Not Connected</h3>
                    <p>Statistics are unavailable. Please configure Supabase credentials in supabase.js to enable player tracking and statistics.</p>
                </div>
            `;
        }
    },

    /**
     * Show error message
     */
    showError() {
        const container = document.getElementById('stats-content');
        if (container) {
            container.innerHTML = `
                <div class="stats-error">
                    <h3>Error Loading Statistics</h3>
                    <p>Something went wrong. Please try again later.</p>
                    <button class="btn btn-primary" onclick="StatsController.loadStats()">Retry</button>
                </div>
            `;
        }
    },

    /**
     * Render summary cards
     * @param {Object} summary - Summary statistics
     */
    renderSummary(summary) {
        const container = document.getElementById('stats-summary');
        if (!container) return;

        container.innerHTML = `
            <div class="summary-card">
                <span class="summary-value">${summary.totalGames}</span>
                <span class="summary-label">Games Played</span>
            </div>
            <div class="summary-card">
                <span class="summary-value">${summary.totalPlayers}</span>
                <span class="summary-label">Total Players</span>
            </div>
            <div class="summary-card">
                <span class="summary-value">${summary.totalPunishmentsGiven}</span>
                <span class="summary-label">Fines Given</span>
            </div>
            <div class="summary-card">
                <span class="summary-value">${summary.totalPointsAwarded.toLocaleString()}</span>
                <span class="summary-label">Total Points</span>
            </div>
        `;
    },

    /**
     * Render the leaderboard
     * @param {Array} playerStats - Array of player statistics
     * @param {string} containerId - Optional specific container ID
     */
    renderLeaderboard(playerStats, containerId = null) {
        const containerIds = containerId ? [containerId] : ['stats-leaderboard', 'setup-leaderboard'];

        const html = this.generateLeaderboardHtml(playerStats);

        containerIds.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = html;
            }
        });
    },

    /**
     * Generate leaderboard HTML
     * @param {Array} playerStats - Array of player statistics
     * @returns {string} HTML string
     */
    generateLeaderboardHtml(playerStats) {
        if (playerStats.length === 0) {
            return '<p class="empty-state">No games played yet</p>';
        }

        const rows = playerStats.map((player, index) => {
            const medal = index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : `${index + 1}th`;
            const medalClass = index < 3 ? `medal-${index + 1}` : '';

            return `
                <tr class="${medalClass}">
                    <td class="rank">${medal}</td>
                    <td class="player-name">${this.escapeHtml(player.name)}</td>
                    <td class="stat">${player.times_selected}</td>
                    <td class="stat">${player.total_punishment_points.toLocaleString()}</td>
                    <td class="stat">${Math.round(player.avg_punishment)}</td>
                    <td class="stat">${player.highest_single_punishment}</td>
                </tr>
            `;
        }).join('');

        return `
            <table class="leaderboard-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        <th>Selected</th>
                        <th>Total Pts</th>
                        <th>Avg</th>
                        <th>Highest</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    },

    /**
     * Render recent games list
     * @param {Array} games - Array of recent games
     */
    renderRecentGames(games) {
        const container = document.getElementById('stats-recent-games');
        if (!container) return;

        if (games.length === 0) {
            container.innerHTML = '<p class="empty-state">No games played yet</p>';
            return;
        }

        const gameCards = games.map(game => {
            const date = this.formatDate(game.playedAt);
            const results = game.results.map(r =>
                `<span class="game-result">${this.escapeHtml(r.player)}: <strong>${r.punishment}</strong></span>`
            ).join('');

            return `
                <div class="game-card">
                    <div class="game-date">${date}</div>
                    <div class="game-results">${results}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = gameCards;
    },

    /**
     * Render punishment distribution chart
     * @param {Object} distribution - Punishment distribution counts
     */
    renderDistribution(distribution) {
        const container = document.getElementById('stats-distribution');
        if (!container) return;

        const total = Object.values(distribution).reduce((a, b) => a + b, 0);

        if (total === 0) {
            container.innerHTML = '<p class="empty-state">No data yet</p>';
            return;
        }

        const bars = Object.entries(distribution).map(([value, count]) => {
            const percentage = total > 0 ? (count / total * 100) : 0;
            return `
                <div class="distribution-bar">
                    <span class="bar-label">${value}</span>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: ${percentage}%"></div>
                    </div>
                    <span class="bar-count">${count} (${percentage.toFixed(1)}%)</span>
                </div>
            `;
        }).join('');

        container.innerHTML = bars;
    },

    /**
     * Format a date for display
     * @param {Date} date - Date to format
     * @returns {string} Formatted date string
     */
    formatDate(date) {
        // Handle invalid dates
        if (!date || isNaN(date.getTime())) {
            return 'Unknown date';
        }

        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return 'Today at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return `${days} days ago`;
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        }
    },

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// ===================================
// Player Management Controller
// ===================================

const PlayerManagement = {
    /**
     * Load and display players in management modal
     */
    async loadPlayers() {
        const container = document.getElementById('player-list');
        if (!container) return;

        if (!window.SupabaseDB?.isConnected()) {
            container.innerHTML = '<p class="empty-state">Database not connected</p>';
            return;
        }

        container.innerHTML = '<p class="loading-text">Loading players...</p>';

        try {
            const players = await window.SupabaseDB.players.getAll();
            this.renderPlayerList(players);
        } catch (error) {
            console.error('Error loading players:', error);
            container.innerHTML = '<p class="error-text">Error loading players</p>';
        }
    },

    /**
     * Render the player list
     * @param {Array} players - Array of player objects
     */
    renderPlayerList(players) {
        const container = document.getElementById('player-list');
        if (!container) return;

        // Update player count
        const countEl = document.getElementById('modal-player-count');
        if (countEl) {
            const activeCount = players.filter(p => p.is_active).length;
            countEl.textContent = `${activeCount} active / ${players.length} total`;
        }

        if (players.length === 0) {
            container.innerHTML = '<p class="empty-state">No players added yet. Add your first player above!</p>';
            return;
        }

        // Sort players alphabetically
        const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));

        const items = sortedPlayers.map(player => `
            <div class="player-item ${player.is_active ? 'active' : 'inactive'}" data-id="${player.id}" data-name="${this.escapeHtml(player.name)}" data-search-name="${this.escapeHtml(player.name).toLowerCase()}">
                <label class="player-toggle">
                    <input type="checkbox" ${player.is_active ? 'checked' : ''} data-player-id="${player.id}">
                    <span class="player-name">${this.escapeHtml(player.name)}</span>
                </label>
                <button class="btn-icon btn-delete" data-delete-id="${player.id}" title="Delete player">
                    &times;
                </button>
            </div>
        `).join('');

        container.innerHTML = items;

        // Use event delegation for toggle and delete actions
        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const playerId = e.target.dataset.playerId;
                this.togglePlayer(playerId, e.target.checked);
            });
        });

        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const playerItem = e.target.closest('.player-item');
                const playerId = e.target.dataset.deleteId;
                const playerName = playerItem.dataset.name;
                this.deletePlayer(playerId, playerName);
            });
        });

        // Setup modal search functionality
        this.setupModalSearch();
    },

    /**
     * Setup search functionality for modal player list
     */
    setupModalSearch() {
        const searchInput = document.getElementById('manage-player-search');
        if (searchInput && !searchInput.hasAttribute('data-listener-added')) {
            searchInput.setAttribute('data-listener-added', 'true');
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase().trim();
                const playerItems = document.querySelectorAll('#player-list .player-item');

                playerItems.forEach(item => {
                    const playerName = item.dataset.searchName || '';
                    if (term === '' || playerName.includes(term)) {
                        item.classList.remove('hidden');
                    } else {
                        item.classList.add('hidden');
                    }
                });
            });
        }
    },

    /**
     * Add a new player
     */
    async addPlayer() {
        const input = document.getElementById('new-player-name');
        const name = input?.value.trim();

        if (!name) {
            this.showMessage('Please enter a player name', 'error');
            return;
        }

        try {
            await window.SupabaseDB.players.add(name);
            input.value = '';
            this.showMessage(`Added ${name}`, 'success');
            await this.loadPlayers();

            // Refresh the game's player list if on setup screen
            if (typeof window.GameController !== 'undefined') {
                window.GameController.loadPlayersFromDB();
            }
        } catch (error) {
            this.showMessage(error.message || 'Error adding player', 'error');
        }
    },

    /**
     * Toggle player active status
     * @param {string} id - Player ID
     * @param {boolean} isActive - New active status
     */
    async togglePlayer(id, isActive) {
        try {
            await window.SupabaseDB.players.toggleActive(id, isActive);

            // Refresh the game's player list if on setup screen
            if (typeof window.GameController !== 'undefined') {
                window.GameController.loadPlayersFromDB();
            }
        } catch (error) {
            console.error('Error toggling player:', error);
            this.showMessage('Error updating player', 'error');
            await this.loadPlayers(); // Reload to reset checkbox
        }
    },

    /**
     * Delete a player
     * @param {string} id - Player ID
     * @param {string} name - Player name for confirmation
     */
    async deletePlayer(id, name) {
        if (!confirm(`Delete ${name}? This will also remove their game history.`)) {
            return;
        }

        try {
            await window.SupabaseDB.players.delete(id);
            this.showMessage(`Deleted ${name}`, 'success');
            await this.loadPlayers();

            // Refresh the game's player list if on setup screen
            if (typeof window.GameController !== 'undefined') {
                window.GameController.loadPlayersFromDB();
            }
        } catch (error) {
            console.error('Error deleting player:', error);
            this.showMessage('Error deleting player', 'error');
        }
    },

    /**
     * Show a temporary message
     * @param {string} message - Message to show
     * @param {string} type - 'success' or 'error'
     */
    showMessage(message, type) {
        const container = document.getElementById('player-message');
        if (!container) return;

        container.textContent = message;
        container.className = `player-message ${type}`;
        container.style.display = 'block';

        setTimeout(() => {
            container.style.display = 'none';
        }, 3000);
    },

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Make controllers globally available
window.StatsController = StatsController;
window.PlayerManagement = PlayerManagement;
