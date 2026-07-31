// ==================== Game Entry ====================

import { initGrid, grid, loadBest, gameState, saveGameState, loadGameState, restoreUndoState, canUndo } from './data.js';
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
    classicBtn.className = 'btn';
    classicBtn.style.cssText = 'padding:6px 16px;border:none;border-radius:4px;font-size:13px;font-weight:bold;cursor:pointer;background:#8f7a66;color:white';
    
    const dailyBtn = document.createElement('button');
    dailyBtn.textContent = 'Daily';
    dailyBtn.className = 'btn';
    dailyBtn.style.cssText = 'padding:6px 16px;border:none;border-radius:4px;font-size:13px;font-weight:bold;cursor:pointer;background:#a08060;color:white;opacity:0.6';
    
    classicBtn.addEventListener('click', () => {
        exitDailyMode();
        classicBtn.style.opacity = '1';
        dailyBtn.style.opacity = '0.6';
        document.getElementById('daily-info')?.remove();
        startGame();
    });
    
    dailyBtn.addEventListener('click', () => {
        enterDailyMode();
        dailyBtn.style.opacity = '1';
        classicBtn.style.opacity = '0.6';
        // Show daily info
        let info = document.getElementById('daily-info');
        if (!info) {
            info = document.createElement('div');
            info.id = 'daily-info';
            info.style.cssText = 'text-align:center;font-size:12px;color:#776e65;margin:4px 0';
            document.querySelector('.container').insertBefore(info, switchContainer.nextSibling);
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
