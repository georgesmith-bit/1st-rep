// ==================== 游戏入口 ====================

import { initGrid, loadBest, gameState } from './data.js';
import { spawnTile, move, canMove, checkWin } from './board.js';
import { initInput } from './input.js';
import { render, showGameOver, hideGameOver } from './ui.js';

function startGame() {
    initGrid();
    gameState.score = 0;
    gameState.gameOver = false;
    gameState.won = false;
    gameState.keepPlaying = false;
    loadBest();
    hideGameOver();
    
    spawnTile();
    spawnTile();
    render();
}

function handleMove(direction) {
    if (gameState.gameOver) return;
    
    const moved = move(direction);
    if (!moved) return;
    
    spawnTile();
    render();
    
    if (!canMove()) {
        gameState.gameOver = true;
        render();
        setTimeout(showGameOver, 300);
    }
    
    if (!gameState.won && checkWin()) {
        gameState.won = true;
    }
}

// 初始化
initInput(handleMove);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('retry-btn').addEventListener('click', startGame);

startGame();