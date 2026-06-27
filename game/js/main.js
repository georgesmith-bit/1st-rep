// ==================== Game Entry ====================

import { initGrid, grid, loadBest, gameState, saveGameState, loadGameState, restoreUndoState, canUndo } from './data.js';
import { spawnTile, move, canMove, checkWin } from './board.js';
import { initInput } from './input.js';
import { render, renderWithAnimation, showGameOver, hideGameOver, showWin, hideWin } from './ui.js';


// Anti-spam flag
let isProcessing = false;

function startGame() {
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
    sendState();
    saveGameState();
    updateUndoButton();
}

function handleMove(direction) {
    // Anti-spam check
    if (isProcessing || gameState.gameOver) return;

    const moveInfo = move(direction);
    if (!moveInfo) return;

    // Set anti-spam flag
    isProcessing = true;

    const newTile = spawnTile();

    // Use callback to ensure state is sent after animation completes
    renderWithAnimation(moveInfo, newTile, () => {
        // Reset anti-spam flag
        isProcessing = false;

        sendState();
        saveGameState();
        updateUndoButton();

        if (!canMove()) {
            gameState.gameOver = true;
            setTimeout(showGameOver, 300);
        }

        // Check if reached 2048, show win message
        if (!gameState.won && checkWin()) {
            gameState.won = true;
            setTimeout(showWin, 300);
        }
    });
}

// Remote control: report state
function sendState() {
    try {
        // Logical state - convert object array to value array
        const gridData = {
            grid: grid.map(row => row.map(cell => cell ? cell.value : 0)),
            score: gameState.score,
            best: gameState.best,
            gameOver: gameState.gameOver,
            won: gameState.won
        };
        fetch('/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gridData)
        });
        // DOM visual state
        const boardEl = document.getElementById('board');
        const tiles = boardEl.querySelectorAll('.tile');
        const domTiles = [];
        tiles.forEach(t => {
            const [x, y] = (t.style.left && t.style.top)
                ? [parseInt(t.style.left), parseInt(t.style.top)]
                : t.style.transform
                    ? t.style.transform.match(/translate\((\d+)px,\s*(\d+)px\)/).slice(1).map(Number)
                    : [0, 0];
            domTiles.push({
                val: parseInt(t.textContent) || 0,
                left: parseInt(t.style.left) || 0,
                top: parseInt(t.style.top) || 0,
                classes: t.className
            });
        });
        // Also report board children count for debugging
        const debugInfo = {
            tiles: domTiles,
            boardChildren: boardEl.children.length,
            boardHTML: boardEl.children.length
        };
        fetch('/dom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(debugInfo)
        });
    } catch (e) {}
}

// Remote control: poll commands
function pollRemoteCmd() {
    fetch('/cmd')
        .then(r => r.json())
        .then(data => {
            if (data.cmd !== null && data.cmd !== undefined) {
                handleMove(data.cmd);
            }
        })
        .catch(() => {});
    setTimeout(pollRemoteCmd, 200);
}

// Initialize input
initInput(handleMove);
document.getElementById('restart-btn').addEventListener('click', () => { startGame(); sendState(); });
document.getElementById('retry-btn').addEventListener('click', () => { startGame(); sendState(); });

// Win message buttons
document.getElementById('keep-playing-btn').addEventListener('click', () => {
    hideWin();
    gameState.keepPlaying = true;
});

document.getElementById('new-game-btn').addEventListener('click', () => {
    hideWin();
    startGame();
    sendState();
});

// Undo
const undoBtn = document.getElementById('undo-btn');
undoBtn.addEventListener('click', () => {
    if (restoreUndoState()) {
        hideGameOver();
        render();
        sendState();
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
});

// Initialize game
function initGame() {
    // Try loading saved game state
    if (loadGameState()) {
        render();
        sendState();
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
pollRemoteCmd();
