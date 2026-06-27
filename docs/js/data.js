// ==================== Game Data & Constants ====================

export const GRID_SIZE = 4;

export const gameState = {
    score: 0,
    best: 0,
    gameOver: false,
    won: false,
    keepPlaying: false
};

// 4x4 grid, each cell stores a tile object { id, value } or null
export let grid = [];

// Tile ID counter
let nextTileId = 1;

// Undo state storage
let undoState = null;

// Generate new tile ID
export function generateTileId() {
    return nextTileId++;
}

// Initialize empty grid
export function initGrid() {
    grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
    nextTileId = 1;
    undoState = null;
}

// Save current state for undo
export function saveUndoState() {
    undoState = {
        grid: grid.map(row => row.map(cell => cell ? { ...cell } : null)),
        score: gameState.score,
        nextTileId: nextTileId,
        gameOver: gameState.gameOver,
        won: gameState.won
    };
}

// Restore undo state
export function restoreUndoState() {
    if (!undoState) return false;

    grid = undoState.grid.map(row => row.map(cell => cell ? { ...cell } : null));
    gameState.score = undoState.score;
    gameState.gameOver = undoState.gameOver;
    gameState.won = undoState.won;
    nextTileId = undoState.nextTileId;
    undoState = null;

    return true;
}

// Check if undo is available
export function canUndo() {
    return undoState !== null;
}

// Load best score from localStorage
export function loadBest() {
    const saved = localStorage.getItem('2048_best');
    gameState.best = saved ? parseInt(saved, 10) : 0;
}

// Save best score
export function saveBest() {
    if (gameState.score > gameState.best) {
        gameState.best = gameState.score;
        localStorage.setItem('2048_best', gameState.best);
    }
}

// Save full game state
export function saveGameState() {
    const state = {
        grid: grid.map(row => row.map(cell => cell ? { ...cell } : null)),
        score: gameState.score,
        best: gameState.best,
        gameOver: gameState.gameOver,
        won: gameState.won,
        keepPlaying: gameState.keepPlaying,
        nextTileId: nextTileId
    };
    localStorage.setItem('2048_gameState', JSON.stringify(state));
}

// Load full game state
export function loadGameState() {
    const saved = localStorage.getItem('2048_gameState');
    if (!saved) return false;

    try {
        const state = JSON.parse(saved);
        grid = state.grid.map(row => row.map(cell => cell ? { ...cell } : null));
        gameState.score = state.score;
        gameState.best = state.best;
        gameState.gameOver = state.gameOver;
        gameState.won = state.won;
        gameState.keepPlaying = state.keepPlaying;
        nextTileId = state.nextTileId;
        return true;
    } catch (e) {
        return false;
    }
}
