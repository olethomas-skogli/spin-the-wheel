 Union Wheel of Fortune - Project Summary

  What You Built

  A professional two-round spin-the-wheel game for selecting 3 players from ~30 participants and assigning punishment values.

  ---
  Game Flow

  1. SETUP → Select players (from database or manual input)
  2. ROUND 1 → Spin wheel 3x to select 3 players (removed after selection)
  3. ROUND 2 → Each player spins for their punishment (sequential)
  4. RESULTS → Display final matchups with "Play Again" / "View Stats"

  ---
  Features Implemented

  Core Game

  - Canvas-based spinning wheel with smooth cubic-ease animation
  - Red/white color scheme with center logo space
  - Pointer at 12 o'clock position
  - 5-second spin duration with 4-7 rotations

  Punishment Wheel Distribution
  ┌───────┬───────┐
  │ Value │ Count │
  ├───────┼───────┤
  │ 75    │ 3x    │
  ├───────┼───────┤
  │ 100   │ 3x    │
  ├───────┼───────┤
  │ 200   │ 1x    │
  ├───────┼───────┤
  │ 250   │ 1x    │
  ├───────┼───────┤
  │ 500   │ 1x    │
  └───────┴───────┘
  Cryptographically Secure Randomness

  - Uses crypto.getRandomValues() (Web Crypto API)
  - Rejection sampling for perfect uniform distribution
  - Same standard as lottery systems

  Supabase Backend

  - Player management (add/remove/toggle active)
  - Auto-save game results after each game
  - Full statistics tracking

  Statistics Dashboard

  - Overview: Games played, total players, punishments given, total points
  - Leaderboard: Ranked by total punishment points
  - Distribution Chart: Visual breakdown of punishment frequency
  - Recent Games: Last 10 games with timestamps

  ---
  Project Structure

  spin-the-wheel/
  ├── index.html      (236 lines) - HTML structure with all screens
  ├── style.css       (1270 lines) - Professional styling
  ├── app.js          (913 lines) - Game logic & wheel mechanics
  ├── supabase.js     (340 lines) - Database client & services
  ├── stats.js        (400 lines) - Statistics display
  └── schema.sql      (80 lines) - Database setup script

  ---
  Database Schema (Supabase)

  players          → id, name, is_active, created_at
  games            → id, played_at
  game_results     → id, game_id, player_id, punishment_value, selection_order
  player_stats     → (view) aggregated player statistics

  ---
  Bugs Found & Fixed
  ┌─────┬─────────────────────────────────────────────┬────────────┐
  │  #  │                     Bug                     │  Severity  │
  ├─────┼─────────────────────────────────────────────┼────────────┤
  │ 1   │ Stats screen destroyed by loading state     │ Critical   │
  ├─────┼─────────────────────────────────────────────┼────────────┤
  │ 2   │ XSS/broken JS with names like "O'Brien"     │ High       │
  ├─────┼─────────────────────────────────────────────┼────────────┤
  │ 3   │ Orphan games created if player lookup fails │ Medium     │
  ├─────┼─────────────────────────────────────────────┼────────────┤
  │ 4   │ parsePlayerInput() crashes on null          │ Medium     │
  ├─────┼─────────────────────────────────────────────┼────────────┤
  │ 5   │ No validation in saveGame()                 │ Low-Medium │
  ├─────┼─────────────────────────────────────────────┼────────────┤
  │ 6   │ formatDate() doesn't handle invalid dates   │ Low        │
  └─────┴─────────────────────────────────────────────┴────────────┘
  ---
  To Use

  1. Without database: Paste player names manually (comma/newline separated)
  2. With database:
    - Create free Supabase account
    - Run schema.sql in SQL Editor
    - Add credentials to supabase.js lines 8-9

  ---
  Tech Stack

  - Vanilla JavaScript (ES6+)
  - HTML5 Canvas
  - CSS3 (custom properties, flexbox, grid)
  - Supabase (PostgreSQL + REST API)
  - Web Crypto API