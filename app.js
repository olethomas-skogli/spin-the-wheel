/**
 * Union Wheel of Fortune
 * A two-round spin-the-wheel game for selecting players and assigning punishments.
 */

// ===================================
// Game State
// ===================================

const GameState = {
    players: [],
    remainingPlayers: [],
    selectedPlayers: [],
    punishments: [75, 75, 75, 75, 75, 100, 100, 100, 100, 100, 100, 150, 150, 150, 150, 150],
    assignedPunishments: [],
    currentRound: 1,
    currentSpin: 0,
    isSpinning: false,
    isDbConnected: false,
    isTestMode: false
};

// ===================================
// Configuration
// ===================================

const Config = {
    wheel: {
        colors: {
            primary: '#D32F2F',
            secondary: '#FFFFFF',
            text: {
                onPrimary: '#FFFFFF',
                onSecondary: '#212121'
            }
        },
        spinDuration: 5000,
        minRotations: 4,
        maxRotations: 7
    },
    audio: {
        enabled: false
    }
};

// ===================================
// Cryptographically Secure Random
// ===================================

const SecureRandom = {
    /**
     * Generate a cryptographically secure random number between 0 and 1
     * Uses Web Crypto API (crypto.getRandomValues)
     * @returns {number} Random float between 0 (inclusive) and 1 (exclusive)
     */
    random() {
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return array[0] / (0xFFFFFFFF + 1);
    },

    /**
     * Generate a cryptographically secure random integer
     * @param {number} min - Minimum value (inclusive)
     * @param {number} max - Maximum value (exclusive)
     * @returns {number} Random integer in range [min, max)
     */
    randomInt(min, max) {
        const range = max - min;
        const bytesNeeded = Math.ceil(Math.log2(range) / 8) || 1;
        const maxValid = Math.floor(256 ** bytesNeeded / range) * range - 1;

        const array = new Uint8Array(bytesNeeded);
        let value;

        // Rejection sampling to ensure uniform distribution
        do {
            crypto.getRandomValues(array);
            value = array.reduce((acc, byte, i) => acc + byte * (256 ** i), 0);
        } while (value > maxValid);

        return min + (value % range);
    },

    /**
     * Generate a cryptographically secure random float in a range
     * @param {number} min - Minimum value (inclusive)
     * @param {number} max - Maximum value (exclusive)
     * @returns {number} Random float in range [min, max)
     */
    randomFloat(min, max) {
        return min + this.random() * (max - min);
    }
};

// ===================================
// DOM Elements
// ===================================

const Elements = {
    // Screens
    loginScreen: document.getElementById('login-screen'),
    setupScreen: document.getElementById('setup-screen'),
    gameScreen: document.getElementById('game-screen'),
    resultsScreen: document.getElementById('results-screen'),
    statsScreen: document.getElementById('stats-screen'),

    // Navigation
    mainNav: document.getElementById('main-nav'),
    navButtons: document.querySelectorAll('.nav-btn[data-screen]'),
    logoutBtn: document.getElementById('logout-btn'),

    // Database Status
    dbStatus: document.getElementById('db-status'),

    // Setup - Player Selection (DB mode)
    playerSelection: document.getElementById('player-selection'),
    activePlayersList: document.getElementById('active-players-list'),

    // Setup - Manual Input (offline mode)
    manualInput: document.getElementById('manual-input'),
    playerInput: document.getElementById('player-input'),

    // Setup - Common
    playerCountDisplay: document.getElementById('player-count-display'),
    startBtn: document.getElementById('start-btn'),
    testBtn: document.getElementById('test-btn'),

    // Game
    roundTitle: document.getElementById('round-title'),
    roundSubtitle: document.getElementById('round-subtitle'),
    wheelCanvas: document.getElementById('wheel-canvas'),
    spinBtn: document.getElementById('spin-btn'),
    currentAction: document.getElementById('current-action'),
    selectedPlayersList: document.getElementById('selected-players'),
    punishmentSection: document.getElementById('punishment-section'),
    assignedPunishmentsList: document.getElementById('assigned-punishments'),

    // Results
    resultsCards: document.getElementById('results-cards'),
    playAgainBtn: document.getElementById('play-again-btn'),

    // Result Modal
    modal: document.getElementById('result-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalMessage: document.getElementById('modal-message'),
    modalContinueBtn: document.getElementById('modal-continue-btn'),

    // Player Management Modal
    playerModal: document.getElementById('player-modal')
};

// ===================================
// Navigation Controller
// ===================================

const Navigation = {
    /**
     * Navigate to a screen
     * @param {string} screenName - 'login', 'setup', 'stats', 'game', or 'results'
     */
    goto(screenName) {
        // Update nav buttons
        Elements.navButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.screen === screenName);
        });

        // Hide all screens
        const screens = ['login', 'setup', 'game', 'results', 'stats'];
        screens.forEach(name => {
            const screen = document.getElementById(`${name}-screen`);
            if (screen) screen.classList.remove('active');
        });

        // Show target screen
        const targetScreen = document.getElementById(`${screenName}-screen`);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }

        // Show/hide navigation based on login state
        if (Elements.mainNav) {
            Elements.mainNav.classList.toggle('hidden', screenName === 'login');
        }

        // Load stats when navigating to stats screen
        if (screenName === 'stats' && window.StatsController) {
            StatsController.loadStats();
        }
    }
};

// Make Navigation globally available
window.Navigation = Navigation;

// ===================================
// Player Management Modal Functions
// ===================================

async function openPlayerManagement() {
    // Check auth if Supabase is connected
    if (GameState.isDbConnected && window.SupabaseDB && window.SupabaseDB.auth) {
        const session = await SupabaseDB.auth.getSession();
        if (!session) {
            alert('Admin login required');
            Navigation.goto('login');
            return;
        }
    }

    Elements.playerModal.classList.add('active');
    if (window.PlayerManagement) {
        PlayerManagement.loadPlayers();
    }
}

function closePlayerManagement() {
    Elements.playerModal.classList.remove('active');
}

// Make modal functions globally available
window.openPlayerManagement = openPlayerManagement;
window.closePlayerManagement = closePlayerManagement;

// ===================================
// Authentication Functions
// ===================================

/**
 * Handle login form submission
 * @param {Event} event - Form submit event
 */
async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorElement = document.getElementById('login-error');
    const submitBtn = event.target.querySelector('button[type="submit"]');

    // Clear previous errors
    errorElement.textContent = '';

    if (!window.SupabaseDB || !SupabaseDB.isConnected()) {
        errorElement.textContent = 'Database not connected. Please configure Supabase.';
        return;
    }

    // Disable button during login
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';
    }

    try {
        const { data, error } = await SupabaseDB.auth.login(email, password);

        if (error) {
            errorElement.textContent = error.message || 'Login failed. Please check your credentials.';
            return;
        }

        // Login successful
        Navigation.goto('setup');

        // Reload players after login
        if (window.gameController) {
            gameController.loadPlayersFromDB();
        }
    } catch (err) {
        console.error('Login error:', err);
        errorElement.textContent = 'An unexpected error occurred. Please try again.';
    } finally {
        // Re-enable button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    }
}

/**
 * Handle logout button click
 */
async function handleLogout() {
    if (window.SupabaseDB && SupabaseDB.isConnected() && SupabaseDB.auth) {
        await SupabaseDB.auth.logout();
    }
    Navigation.goto('login');
}

/**
 * Initialize authentication state
 */
async function initAuth() {
    // If Supabase is not connected, skip auth (offline mode)
    if (!window.SupabaseDB || !SupabaseDB.isConnected()) {
        Navigation.goto('setup');
        return;
    }

    // Listen for auth state changes (handles session restoration from localStorage)
    SupabaseDB.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event);

        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            if (session) {
                Navigation.goto('setup');
            }
        } else if (event === 'SIGNED_OUT') {
            Navigation.goto('login');
        }
    });

    // Check for existing session (fallback)
    const session = await SupabaseDB.auth.getSession();

    if (session) {
        Navigation.goto('setup');
    } else {
        Navigation.goto('login');
    }
}

// Make auth functions globally available
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;

// ===================================
// Mobile Menu Functions
// ===================================

/**
 * Toggle mobile menu open/closed
 */
function toggleMobileMenu() {
    document.getElementById('nav-links').classList.toggle('open');
    document.getElementById('hamburger-btn').classList.toggle('open');
}

/**
 * Close mobile menu
 */
function closeMobileMenu() {
    document.getElementById('nav-links').classList.remove('open');
    document.getElementById('hamburger-btn').classList.remove('open');
}

// Make mobile menu functions globally available
window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu = closeMobileMenu;

// ===================================
// Player Selection Functions
// ===================================

/**
 * Select all visible players
 */
function togglePlayerSelection() {
    const body = document.getElementById('player-selection-body');
    const btn = document.getElementById('toggle-players-btn');
    const isExpanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', !isExpanded);
    body.classList.toggle('collapsed', isExpanded);
}

function selectAllPlayers() {
    const checkboxes = Elements.activePlayersList.querySelectorAll('.player-checkbox:not(.hidden) input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
        checkbox.closest('.player-checkbox').classList.add('selected');
    });
    if (window.gameController) {
        gameController.updatePlayerCount();
    }
}

/**
 * Deselect all visible players
 */
function deselectAllPlayers() {
    const checkboxes = Elements.activePlayersList.querySelectorAll('.player-checkbox:not(.hidden) input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
        checkbox.closest('.player-checkbox').classList.remove('selected');
    });
    if (window.gameController) {
        gameController.updatePlayerCount();
    }
}

/**
 * Filter players by search term
 * @param {string} searchTerm - The search term
 */
function filterPlayers(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    const playerCheckboxes = Elements.activePlayersList.querySelectorAll('.player-checkbox');

    playerCheckboxes.forEach(checkbox => {
        const playerName = checkbox.dataset.playerName || '';
        if (term === '' || playerName.includes(term)) {
            checkbox.classList.remove('hidden');
        } else {
            checkbox.classList.add('hidden');
        }
    });
}

// Make player selection functions globally available
window.selectAllPlayers = selectAllPlayers;
window.deselectAllPlayers = deselectAllPlayers;
window.filterPlayers = filterPlayers;
window.togglePlayerSelection = togglePlayerSelection;

// ===================================
// Wheel Renderer
// ===================================

class WheelRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.segments = [];
        this.currentRotation = 0;
    }

    /**
     * Set up the wheel with given segments
     * @param {string[]} items - Array of segment labels
     */
    setSegments(items) {
        this.segments = items;
        this.draw();
    }

    /**
     * Draw the wheel on the canvas
     * @param {number} rotation - Current rotation in radians
     */
    draw(rotation = this.currentRotation) {
        const { canvas, ctx, segments } = this;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (segments.length === 0) return;

        const segmentAngle = (2 * Math.PI) / segments.length;

        // Draw segments
        segments.forEach((segment, index) => {
            const startAngle = index * segmentAngle + rotation - Math.PI / 2;
            const endAngle = startAngle + segmentAngle;

            // Segment fill
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();

            const isEven = index % 2 === 0;
            ctx.fillStyle = isEven
                ? Config.wheel.colors.primary
                : Config.wheel.colors.secondary;
            ctx.fill();

            // Segment border
            ctx.strokeStyle = '#B71C1C';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Segment text
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + segmentAngle / 2);

            const textRadius = radius * 0.65;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Dynamic font size based on number of segments and text length
            const maxFontSize = segments.length > 20 ? 16 : segments.length > 10 ? 20 : 24;
            const textLength = String(segment).length;
            const fontSize = Math.min(maxFontSize, Math.floor(180 / textLength));

            ctx.font = `bold ${fontSize}px 'Segoe UI', system-ui, sans-serif`;
            ctx.fillStyle = isEven
                ? Config.wheel.colors.text.onPrimary
                : Config.wheel.colors.text.onSecondary;

            // Truncate long text
            const displayText = String(segment).length > 12
                ? String(segment).substring(0, 10) + '...'
                : String(segment);

            ctx.fillText(displayText, textRadius, 0);
            ctx.restore();
        });

        // Draw outer ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = '#B71C1C';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Draw center circle (behind the logo overlay)
        ctx.beginPath();
        ctx.arc(centerX, centerY, 50, 0, 2 * Math.PI);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#D32F2F';
        ctx.lineWidth = 4;
        ctx.stroke();

        this.currentRotation = rotation;
    }

    /**
     * Animate the wheel spin
     * @param {number} targetRotation - Target rotation in radians
     * @param {number} duration - Animation duration in ms
     * @returns {Promise<number>} - Resolves with winning segment index
     */
    spin(targetRotation, duration) {
        return new Promise((resolve) => {
            const startRotation = this.currentRotation;
            const startTime = performance.now();

            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Cubic ease-out for natural deceleration
                const easeOut = 1 - Math.pow(1 - progress, 3);
                const currentRotation = startRotation + (targetRotation - startRotation) * easeOut;

                this.draw(currentRotation);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.currentRotation = currentRotation;
                    const winningIndex = this.getWinningSegment();
                    resolve(winningIndex);
                }
            };

            requestAnimationFrame(animate);
        });
    }

    /**
     * Calculate which segment is at the top (pointer position)
     * @returns {number} - Index of winning segment
     */
    getWinningSegment() {
        const segmentAngle = (2 * Math.PI) / this.segments.length;

        // Normalize rotation to 0-2π range
        let normalizedRotation = this.currentRotation % (2 * Math.PI);
        if (normalizedRotation < 0) normalizedRotation += 2 * Math.PI;

        // The pointer is at the top (12 o'clock), which is -π/2 in standard position
        // We need to find which segment is under the pointer
        const pointerAngle = (2 * Math.PI - normalizedRotation) % (2 * Math.PI);
        const winningIndex = Math.floor(pointerAngle / segmentAngle) % this.segments.length;

        return winningIndex;
    }
}

// ===================================
// Game Controller
// ===================================

class GameController {
    constructor() {
        this.wheel = new WheelRenderer(Elements.wheelCanvas);
        this.dbPlayers = []; // Players from database
        this.initPromise = null; // Track initialization
        this.bindEvents();
        this.initPromise = this.initDatabase();
    }

    /**
     * Wait for initialization to complete
     * @returns {Promise<void>}
     */
    async waitForInit() {
        if (this.initPromise) {
            await this.initPromise;
        }
    }

    /**
     * Initialize database connection
     */
    async initDatabase() {
        // Try to connect to Supabase
        if (window.SupabaseDB) {
            GameState.isDbConnected = SupabaseDB.init();
        }

        this.updateDbStatus();

        if (GameState.isDbConnected) {
            // Show DB player selection mode
            Elements.playerSelection.classList.remove('hidden');
            Elements.manualInput.classList.add('hidden');
            await this.loadPlayersFromDB();
            // Load leaderboard on setup screen
            if (window.StatsController?.loadSetupLeaderboard) {
                StatsController.loadSetupLeaderboard();
            }
        } else {
            // Show manual input mode
            Elements.playerSelection.classList.add('hidden');
            Elements.manualInput.classList.remove('hidden');
            this.updatePlayerCount();
        }
    }

    /**
     * Update the database status indicator
     */
    updateDbStatus() {
        const indicator = Elements.dbStatus.querySelector('.status-indicator');
        const text = Elements.dbStatus.querySelector('.status-text');

        if (GameState.isDbConnected) {
            indicator.classList.add('online');
            indicator.classList.remove('offline');
            text.textContent = 'Connected to union database 👀';
        } else {
            indicator.classList.add('offline');
            indicator.classList.remove('online');
            text.textContent = 'Offline mode (configure Supabase to enable sync)';
        }
    }

    /**
     * Load players from database
     */
    async loadPlayersFromDB() {
        if (!GameState.isDbConnected) return;

        Elements.activePlayersList.innerHTML = '<p class="loading-text">Loading Union squad...</p>';

        try {
            const players = await SupabaseDB.players.getAll(true); // Only active players
            this.dbPlayers = players;
            this.renderPlayerCheckboxes(players);
            this.updatePlayerCount();
        } catch (error) {
            console.error('Error loading players:', error);
            Elements.activePlayersList.innerHTML = '<p class="error-text">Error loading players</p>';
        }
    }

    /**
     * Render player checkboxes for selection
     * @param {Array} players - Array of player objects
     */
    renderPlayerCheckboxes(players) {
        if (players.length === 0) {
            Elements.activePlayersList.innerHTML = `
                <p class="empty-state">No players added yet. Click "Manage Players" to add players.</p>
            `;
            return;
        }

        // Sort players alphabetically
        const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));

        const checkboxes = sortedPlayers.map(player => `
            <label class="player-checkbox selected" data-player-name="${this.escapeHtml(player.name).toLowerCase()}">
                <input type="checkbox" value="${player.id}" data-name="${this.escapeHtml(player.name)}" checked>
                <span>${this.escapeHtml(player.name)}</span>
            </label>
        `).join('');

        Elements.activePlayersList.innerHTML = `<div class="players-grid">${checkboxes}</div>`;

        // Add event listeners for checkboxes
        Elements.activePlayersList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                e.target.closest('.player-checkbox').classList.toggle('selected', e.target.checked);
                this.updatePlayerCount();
            });
        });
    }

    /**
     * Get selected players (from checkboxes or text input)
     * @returns {string[]} Array of player names
     */
    getSelectedPlayers() {
        if (GameState.isDbConnected) {
            const checkboxes = Elements.activePlayersList.querySelectorAll('input[type="checkbox"]:checked');
            return Array.from(checkboxes).map(cb => cb.dataset.name);
        } else {
            return this.parsePlayerInput(Elements.playerInput.value);
        }
    }

    /**
     * Bind all event listeners
     */
    bindEvents() {
        if (Elements.playerInput) {
            Elements.playerInput.addEventListener('input', () => this.updatePlayerCount());
        }
        Elements.startBtn.addEventListener('click', () => this.startGame(false));
        Elements.testBtn.addEventListener('click', () => this.startGame(true));
        Elements.spinBtn.addEventListener('click', () => this.handleSpin());
        Elements.playAgainBtn.addEventListener('click', () => this.resetGame());
        Elements.modalContinueBtn.addEventListener('click', () => this.closeModal());

        // Exit game button
        const exitGameBtn = document.getElementById('exit-game-btn');
        if (exitGameBtn) {
            exitGameBtn.addEventListener('click', () => {
                this.showScreen('setup');
            });
        }

        // Handle Enter key in player name input
        const newPlayerInput = document.getElementById('new-player-name');
        if (newPlayerInput) {
            newPlayerInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && window.PlayerManagement) {
                    PlayerManagement.addPlayer();
                }
            });
        }

        // Player search functionality
        const playerSearch = document.getElementById('player-search');
        if (playerSearch) {
            playerSearch.addEventListener('input', (e) => {
                filterPlayers(e.target.value);
            });
        }
    }

    /**
     * Parse player names from input text
     * @param {string} text - Input text with names
     * @returns {string[]} - Array of unique player names
     */
    parsePlayerInput(text) {
        if (!text) return [];

        const names = text
            .split(/[,\n]+/)
            .map(name => name.trim())
            .filter(name => name.length > 0);

        // Remove duplicates
        return [...new Set(names)];
    }

    /**
     * Update the player count display and button state
     */
    updatePlayerCount() {
        const players = this.getSelectedPlayers();
        const count = players.length;

        Elements.playerCountDisplay.textContent = `${count} selected`;
        Elements.startBtn.disabled = count < 3;
        Elements.testBtn.disabled = count < 3;
    }

    /**
     * Start the game
     * @param {boolean} testMode - If true, results won't be saved to database
     */
    async startGame(testMode = false) {
        // Check auth if Supabase is connected (skip for test mode)
        if (!testMode && GameState.isDbConnected && window.SupabaseDB && window.SupabaseDB.auth) {
            const session = await SupabaseDB.auth.getSession();
            if (!session) {
                alert('Admin login required');
                Navigation.goto('login');
                return;
            }
        }

        const players = this.getSelectedPlayers();

        if (players.length < 3) {
            alert('Please select at least 3 players.');
            return;
        }

        // Initialize game state
        GameState.players = [...players];
        GameState.remainingPlayers = [...players];
        GameState.selectedPlayers = [];
        GameState.assignedPunishments = [];
        GameState.currentRound = 1;
        GameState.currentSpin = 0;
        GameState.isTestMode = testMode;

        // Set up the wheel with players
        this.wheel.setSegments(GameState.remainingPlayers);

        // Update UI
        this.updateSelectedPlayersList();
        this.showScreen('game');
        this.updateRoundDisplay();
    }

    /**
     * Handle spin button click
     */
    async handleSpin() {
        if (GameState.isSpinning) return;

        GameState.isSpinning = true;
        Elements.spinBtn.disabled = true;
        Elements.spinBtn.classList.add('spinning');

        // Calculate random target rotation using cryptographically secure RNG
        const segments = GameState.currentRound === 1
            ? GameState.remainingPlayers
            : GameState.punishments;

        const segmentAngle = (2 * Math.PI) / segments.length;
        const randomSegment = SecureRandom.randomInt(0, segments.length);
        const baseRotation = SecureRandom.randomFloat(
            Config.wheel.minRotations,
            Config.wheel.maxRotations
        );
        const segmentOffset = SecureRandom.randomFloat(
            segmentAngle * 0.1,
            segmentAngle * 0.9
        );
        const targetRotation = this.wheel.currentRotation +
            (baseRotation * 2 * Math.PI) +
            (randomSegment * segmentAngle) +
            segmentOffset;

        // Spin the wheel
        const winningIndex = await this.wheel.spin(targetRotation, Config.wheel.spinDuration);
        const winner = segments[winningIndex];

        // Process result
        this.processResult(winner);

        GameState.isSpinning = false;
        Elements.spinBtn.classList.remove('spinning');
    }

    /**
     * Process the spin result
     * @param {string|number} winner - The winning segment value
     */
    processResult(winner) {
        if (GameState.currentRound === 1) {
            this.handlePlayerSelection(winner);
        } else {
            this.handlePunishmentAssignment(winner);
        }
    }

    /**
     * Handle player selection (Round 1)
     * @param {string} playerName - Selected player name
     */
    handlePlayerSelection(playerName) {
        // Add to selected players
        GameState.selectedPlayers.push(playerName);
        GameState.currentSpin++;

        // Remove from remaining players
        const index = GameState.remainingPlayers.indexOf(playerName);
        if (index > -1) {
            GameState.remainingPlayers.splice(index, 1);
        }

        // Update UI
        this.updateSelectedPlayersList();

        // Show modal with result
        this.showModal(
            `Player ${GameState.currentSpin} Selected!🤣`,
            `${playerName} 🤡`
        );

        // Check if we need to continue or move to next round
        if (GameState.currentSpin >= 3) {
            Elements.modalContinueBtn.textContent = 'Start Round 2';
        } else {
            // Update wheel for next spin
            this.wheel.setSegments(GameState.remainingPlayers);
        }
    }

    /**
     * Handle punishment assignment (Round 2)
     * @param {number} punishment - Selected punishment value
     */
    handlePunishmentAssignment(punishment) {
        const playerIndex = GameState.currentSpin;
        const playerName = GameState.selectedPlayers[playerIndex];

        // Record assignment
        GameState.assignedPunishments.push({
            player: playerName,
            punishment: punishment
        });

        GameState.currentSpin++;

        // Update UI
        this.updateAssignedPunishmentsList();

        // Show modal
        this.showModal(
            `${playerName}'s Fine🎉🥳`,
            punishment.toString()
        );

        // Check if game is complete
        if (GameState.currentSpin >= 3) {
            Elements.modalContinueBtn.textContent = 'See Results';
        }
    }

    /**
     * Update the selected players list UI
     */
    updateSelectedPlayersList() {
        const items = Elements.selectedPlayersList.querySelectorAll('li');

        items.forEach((item, index) => {
            if (index < GameState.selectedPlayers.length) {
                item.textContent = GameState.selectedPlayers[index];
                item.classList.remove('empty-slot');
                item.classList.add('filled');
            } else {
                item.textContent = 'Waiting...';
                item.classList.add('empty-slot');
                item.classList.remove('filled');
            }

            // Highlight current player in Round 2
            if (GameState.currentRound === 2 && index === GameState.currentSpin) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    /**
     * Update the assigned punishments list UI
     */
    updateAssignedPunishmentsList() {
        Elements.assignedPunishmentsList.innerHTML = '';

        GameState.assignedPunishments.forEach(({ player, punishment }) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="player-name">${this.escapeHtml(player)}</span>
                <span class="punishment-value">${punishment}</span>
            `;
            Elements.assignedPunishmentsList.appendChild(li);
        });
    }

    /**
     * Update the round display
     */
    updateRoundDisplay() {
        const testPrefix = GameState.isTestMode ? '🧪 TEST MODE - ' : '';

        if (GameState.currentRound === 1) {
            Elements.roundTitle.textContent = `${testPrefix}Round 1: Select Players`;
            Elements.roundSubtitle.textContent = `Spin to select 3 players for fine🤑 (${GameState.currentSpin}/3)`;
            this.updateCurrentAction('Ready to spin', 'Click the button to select a player');
            Elements.punishmentSection.classList.add('hidden');
        } else {
            Elements.roundTitle.textContent = `${testPrefix}Round 2: Expensive Fines`;
            const currentPlayer = GameState.selectedPlayers[GameState.currentSpin] || '';
            Elements.roundSubtitle.textContent = `Assigning punishment ${GameState.currentSpin + 1}/3`;
            this.updateCurrentAction(`${currentPlayer}'s Turn`, 'Click to spin for their fines');
            Elements.punishmentSection.classList.remove('hidden');
            this.updateSelectedPlayersList();
        }
    }

    /**
     * Update the current action display
     * @param {string} title - Action title
     * @param {string} description - Action description
     */
    updateCurrentAction(title, description) {
        Elements.currentAction.querySelector('h3').textContent = title;
        Elements.currentAction.querySelector('p').textContent = description;
    }

    /**
     * Transition to Round 2
     */
    transitionToRound2() {
        GameState.currentRound = 2;
        GameState.currentSpin = 0;

        // Set up punishment wheel
        this.wheel.setSegments(GameState.punishments);

        // Re-enable spin button for Round 2
        Elements.spinBtn.disabled = false;

        this.updateRoundDisplay();
    }

    /**
     * Show the modal
     * @param {string} title - Modal title
     * @param {string} message - Modal message
     */
    showModal(title, message) {
        Elements.modalTitle.textContent = title;
        Elements.modalMessage.textContent = message;
        Elements.modal.classList.add('active');
    }

    /**
     * Close the modal and continue game
     */
    closeModal() {
        Elements.modal.classList.remove('active');
        Elements.modalContinueBtn.textContent = 'Continue';

        if (GameState.currentRound === 1) {
            if (GameState.currentSpin >= 3) {
                // Move to Round 2
                this.transitionToRound2();
            } else {
                // Continue Round 1
                Elements.spinBtn.disabled = false;
                this.updateRoundDisplay();
            }
        } else {
            if (GameState.currentSpin >= 3) {
                // Game complete - save and show results
                this.saveGameResults();
                this.showResults();
            } else {
                // Continue Round 2
                Elements.spinBtn.disabled = false;
                this.updateRoundDisplay();
            }
        }
    }

    /**
     * Save game results to database
     */
    async saveGameResults() {
        if (!GameState.isDbConnected || GameState.isTestMode) {
            if (GameState.isTestMode) {
                console.log('Test mode - results not saved');
            }
            return;
        }

        try {
            await SupabaseDB.games.saveGame(GameState.assignedPunishments);
            console.log('Game results saved successfully');
        } catch (error) {
            console.error('Error saving game results:', error);
        }
    }

    /**
     * Show the results screen
     */
    showResults() {
        Elements.resultsCards.innerHTML = '';

        GameState.assignedPunishments.forEach(({ player, punishment }) => {
            const card = document.createElement('div');
            card.className = 'result-card';
            card.innerHTML = `
                <div class="player-name">${this.escapeHtml(player)}</div>
                <div class="punishment-value">${punishment}</div>
            `;
            Elements.resultsCards.appendChild(card);
        });

        this.showScreen('results');
    }

    /**
     * Reset the game to initial state
     */
    resetGame() {
        // Reset state
        GameState.players = [];
        GameState.remainingPlayers = [];
        GameState.selectedPlayers = [];
        GameState.assignedPunishments = [];
        GameState.currentRound = 1;
        GameState.currentSpin = 0;
        GameState.isSpinning = false;
        GameState.isTestMode = false;

        // Reset UI
        Elements.spinBtn.disabled = false;
        Elements.selectedPlayersList.innerHTML = `
            <li class="empty-slot">Waiting...</li>
            <li class="empty-slot">Waiting...</li>
            <li class="empty-slot">Waiting...</li>
        `;
        Elements.assignedPunishmentsList.innerHTML = '';
        this.wheel.currentRotation = 0;

        // Reload players if DB connected
        if (GameState.isDbConnected) {
            this.loadPlayersFromDB();
        }

        this.showScreen('setup');
    }

    /**
     * Show a specific screen
     * @param {string} screenName - 'setup', 'game', 'stats', or 'results'
     */
    showScreen(screenName) {
        const screens = {
            setup: Elements.setupScreen,
            game: Elements.gameScreen,
            results: Elements.resultsScreen,
            stats: Elements.statsScreen
        };

        Object.entries(screens).forEach(([name, screen]) => {
            if (screen) {
                screen.classList.toggle('active', name === screenName);
            }
        });

        // Update nav buttons
        Elements.navButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.screen === screenName);
        });

        // Toggle fullscreen game mode
        document.body.classList.toggle('game-active', screenName === 'game');
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ===================================
// Initialize Application
// ===================================

let gameController;

document.addEventListener('DOMContentLoaded', async () => {
    gameController = new GameController();

    // Make controller accessible globally for PlayerManagement
    window.GameController = {
        loadPlayersFromDB: () => gameController.loadPlayersFromDB()
    };

    // Wait for database initialization to complete, then check auth
    // The GameController constructor calls initDatabase() which is async
    // We need to wait a tick for it to complete before checking auth
    await gameController.waitForInit();
    await initAuth();
});
