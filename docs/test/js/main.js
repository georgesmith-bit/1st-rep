// ==================== Game Entry ====================

import { initGrid, grid, loadBest, gameState, saveGameState, loadGameState, restoreUndoState, canUndo } from './data.js';
import { spawnTile, move, canMove, checkWin } from './board.js';
import { initInput } from './input.js';
import { render, renderWithAnimation, showGameOver, hideGameOver, showWin, hideWin } from './ui.js';
import { trackGameStart, trackTileMove, trackGameOver, trackGameWin, trackUndo, trackKeepPlaying, trackNewGameAfterWin, trackReturnVisit, trackThemeToggle, trackMilestone } from './analytics.js';


// Anti-spam flag
let isProcessing = false;

function startGame() {
    trackGameStart();
    initGrid();
    gameState.score = 0;
    gameState.gameOver = false;
    gameState.won = false;
    gameState.keepPlaying = false;
    loadBest();
    hideGameOver();
    hideWin();

    spawnTile();
    spawnTile();
    render();
    saveGameState();
    updateUndoButton();
}

function handleMove(direction) {
    // Anti-spam check
    if (isProcessing || gameState.gameOver) return;

    const moveInfo = move(direction);
    if (!moveInfo) return;

    trackTileMove(direction);

    // Set anti-spam flag
    isProcessing = true;

    const newTile = spawnTile();

    // Use callback to ensure state is sent after animation completes
    renderWithAnimation(moveInfo, newTile, () => {
        // Reset anti-spam flag
        isProcessing = false;

        saveGameState();
        updateUndoButton();

        if (!canMove()) {
            gameState.gameOver = true;
            trackGameOver(gameState.score, moveCount);
            setTimeout(showGameOver, 300);
        }

        // Check if reached 2048, show win message
        if (!gameState.won && checkWin()) {
            gameState.won = true;
            trackGameWin(gameState.score);
            setTimeout(showWin, 300);
        }
    });
}

// Initialize input
initInput(handleMove);

function confirmNewGame(callback) {
    if (gameState.score > 0 && !gameState.gameOver) {
        if (!confirm('Start a new game? Current progress will be lost.')) return;
    }
    callback();
}

document.getElementById('restart-btn').addEventListener('click', () => { confirmNewGame(() => { startGame(); }); });
document.getElementById('retry-btn').addEventListener('click', () => { startGame(); });

// Win message buttons
document.getElementById('keep-playing-btn').addEventListener('click', () => {
    hideWin();
    gameState.keepPlaying = true;
    trackKeepPlaying(gameState.score);
});

document.getElementById('new-game-btn').addEventListener('click', () => {
    hideWin();
    trackNewGameAfterWin();
    startGame();
});

// Undo
const undoBtn = document.getElementById('undo-btn');
undoBtn.addEventListener('click', () => {
    if (restoreUndoState()) {
        trackUndo();
        hideGameOver();
        // Add animate class for smooth undo transitions
        const board = document.getElementById('board');
        board.classList.add('undo-animating');
        render();
        setTimeout(() => board.classList.remove('undo-animating'), 200);
        saveGameState();
        updateUndoButton();
    }
});

// Update undo button state
function updateUndoButton() {
    undoBtn.disabled = !canUndo();
}

// Dark mode toggle
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = themeToggle.querySelector('.theme-icon');
const savedTheme = localStorage.getItem('theme') || 'light';

if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    themeIcon.textContent = '☀️';
}

themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-mode');
    themeIcon.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    trackThemeToggle(isDark ? 'dark' : 'light');
});

// Initialize game
function initGame() {
    // Try loading saved game state
    if (loadGameState()) {
        trackReturnVisit();
        render();
        // Restore Game Over / Win UI state
        if (gameState.gameOver) {
            showGameOver();
        }
        if (gameState.won && !gameState.keepPlaying) {
            showWin();
        }
    } else {
        startGame();
    }
}

// Initialize game
initGame();
