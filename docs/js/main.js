// ==================== Game Entry ====================

import { initGrid, grid, loadBest, gameState, saveGameState, loadGameState, restoreUndoState, canUndo } from './data.js?v=2';
import { spawnTile, move, canMove, checkWin } from './board.js';
import { initInput } from './input.js';
import { render, renderWithAnimation, showGameOver, hideGameOver, showWin, hideWin } from './ui.js';
import { trackGameStart, trackTileMove, trackGameOver, trackGameWin, trackUndo, trackKeepPlaying, trackNewGameAfterWin, trackReturnVisit, trackThemeToggle, trackMilestone } from './analytics.js';
import { dailyMode, dailyCompleted, dailyBest, enterDailyMode, exitDailyMode, saveDailyProgress, isDailyModeAvailable, getTodayDateStr } from './daily.js';


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
            saveDailyProgress(gameState.score, false);
            setTimeout(showGameOver, 300);
        }

        // Check if reached 2048
        if (!gameState.won && checkWin()) {
            gameState.won = true;
            trackGameWin(gameState.score);
            saveDailyProgress(gameState.score, true);
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

// Daily challenge mode switch (gated behind ?daily=test)
if (isDailyModeAvailable()) {
    const switchContainer = document.createElement('div');
    switchContainer.id = 'mode-switch';
    switchContainer.style.cssText = 'display:flex;justify-content:center;gap:8px;margin:8px 0';
    
    const classicBtn = document.createElement('button');
    classicBtn.textContent = 'Classic';
    classicBtn.className = 'btn mode-btn active';
    
    const dailyBtn = document.createElement('button');
    dailyBtn.textContent = 'Daily';
    dailyBtn.className = 'btn mode-btn';
    
    classicBtn.addEventListener('click', () => {
        exitDailyMode();
        classicBtn.classList.add('active');
        dailyBtn.classList.remove('active');
        document.getElementById('daily-info')?.remove();
        startGame();
    });
    
    dailyBtn.addEventListener('click', () => {
        enterDailyMode();
        dailyBtn.classList.add('active');
        classicBtn.classList.remove('active');
        // Show daily info
        let info = document.getElementById('daily-info');
        if (!info) {
            info = document.createElement('div');
            info.id = 'daily-info';
            info.style.cssText = 'text-align:center;font-size:12px;color:#776e65;margin:4px 0';
            switchContainer.insertAdjacentElement('afterend', info);
        }
        const best = dailyBest > 0 ? `｜Best: ${dailyBest}` : '';
        info.textContent = `📅 ${getTodayDateStr()}${best}`;
        startGame();
    });
    
    switchContainer.appendChild(classicBtn);
    switchContainer.appendChild(dailyBtn);
    document.getElementById('board').before(switchContainer);
}

// Undo
const undoBtn = document.getElementById('undo-btn');
undoBtn.addEventListener('click', () => {
    if (restoreUndoState()) {
        trackUndo();
        hideGameOver();
        render();
        saveGameState();
        updateUndoButton();
    }
});

// Update undo button state
function updateUndoButton() {
    undoBtn.disabled = !canUndo();
}

// Settings menu (gear)
const settingsBtn = document.getElementById('settings-btn');
const settingsMenu = document.getElementById('settings-menu');
const settingsBackdrop = document.getElementById('settings-backdrop');
const menuTutorial = document.getElementById('menu-tutorial');
const menuTheme = document.getElementById('menu-theme');
const menuThemeIcon = document.getElementById('menu-theme-icon');
const savedTheme = localStorage.getItem('theme') || 'light';

function updateThemeIcon() {
    const isDark = document.body.classList.contains('dark-mode');
    if (menuThemeIcon) menuThemeIcon.textContent = isDark ? '☀️' : '🌙';
}

if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
}
updateThemeIcon();

settingsBtn.addEventListener('click', () => {
    settingsMenu.classList.add('open');
});

settingsBackdrop.addEventListener('click', () => {
    settingsMenu.classList.remove('open');
});

menuTutorial.addEventListener('click', () => {
    const p = location.pathname;
    let tutorialPath = '/how-to-play/';
    if (p.indexOf('/zh/') !== -1) tutorialPath = '/zh/how-to-play/';
    else if (p.indexOf('/vi/') !== -1) tutorialPath = '/vi/how-to-play/';
    location.href = tutorialPath;
});

menuTheme.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon();
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
