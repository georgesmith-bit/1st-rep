// ==================== 游戏数据与常量 ====================

export const GRID_SIZE = 4;

export const gameState = {
    score: 0,
    best: 0,
    gameOver: false,
    won: false,
    keepPlaying: false
};

// 4x4 棋盘，每个格子为 0 或 2^n
export let grid = [];

// 初始化空棋盘
export function initGrid() {
    grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
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