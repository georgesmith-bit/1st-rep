// ==================== 游戏数据与常量 ====================

export const GRID_SIZE = 4;

export const gameState = {
    score: 0,
    best: 0,
    gameOver: false,
    won: false,
    keepPlaying: false
};

// 4x4 棋盘，每个格子存储方块对象 { id, value } 或 null
export let grid = [];

// 方块 ID 计数器
let nextTileId = 1;

// 撤销状态存储
let undoState = null;

// 生成新方块 ID
export function generateTileId() {
    return nextTileId++;
}

// 初始化空棋盘
export function initGrid() {
    grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
    nextTileId = 1;
    undoState = null;
}

// 保存当前状态用于撤销
export function saveUndoState() {
    undoState = {
        grid: grid.map(row => row.map(cell => cell ? { ...cell } : null)),
        score: gameState.score,
        nextTileId: nextTileId,
        gameOver: gameState.gameOver,
        won: gameState.won
    };
}

// 恢复撤销状态
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

// 检查是否有可撤销的状态
export function canUndo() {
    return undoState !== null;
}

// 从 localStorage 加载最高分
export function loadBest() {
    const saved = localStorage.getItem('2048_best');
    gameState.best = saved ? parseInt(saved, 10) : 0;
}

// 保存最高分
export function saveBest() {
    if (gameState.score > gameState.best) {
        gameState.best = gameState.score;
        localStorage.setItem('2048_best', gameState.best);
    }
}

// 保存完整游戏状态
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

// 加载完整游戏状态
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