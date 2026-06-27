// ==================== UI 渲染 ====================

import { GRID_SIZE, grid, gameState } from './data.js';

const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const gameOverEl = document.getElementById('game-over');

let tileElements = {};

export function render() {
    scoreEl.textContent = gameState.score;
    bestEl.textContent = gameState.best;
    
    const boardRect = boardEl.getBoundingClientRect();
    const gap = boardRect.width * 0.02;
    const cellSize = (boardRect.width - gap * (GRID_SIZE + 1)) / GRID_SIZE;
    
    // 绘制网格背景
    boardEl.innerHTML = '';
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.style.left = (gap + c * (cellSize + gap)) + 'px';
            cell.style.top = (gap + r * (cellSize + gap)) + 'px';
            cell.style.width = cellSize + 'px';
            cell.style.height = cellSize + 'px';
            boardEl.appendChild(cell);
        }
    }
    
    // 绘制方块
    const newTiles = {};
    const fontBase = cellSize * 0.4;
    
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const val = grid[r][c];
            if (val === 0) continue;
            
            const key = `${r}-${c}`;
            const x = gap + c * (cellSize + gap);
            const y = gap + r * (cellSize + gap);
            
            // 复用已有 DOM 元素
            let tile = tileElements[key];
            if (!tile) {
                tile = document.createElement('div');
                tile.className = `tile tile-${val > 2048 ? 'super' : val}`;
                tile.textContent = val;
                tile.style.width = cellSize + 'px';
                tile.style.height = cellSize + 'px';
                tile.style.fontSize = (val >= 1024 ? fontBase * 0.85 : fontBase) + 'px';
                tile.style.lineHeight = cellSize + 'px';
                tile.classList.add('new');
                boardEl.appendChild(tile);
            } else {
                // 更新值
                if (parseInt(tile.textContent) !== val) {
                    tile.classList.add('merged');
                    setTimeout(() => tile.classList.remove('merged'), 150);
                }
                tile.textContent = val;
                tile.className = `tile tile-${val > 2048 ? 'super' : val}`;
                tile.style.fontSize = (val >= 1024 ? fontBase * 0.85 : fontBase) + 'px';
            }
            
            tile.style.transform = `translate(${x}px, ${y}px)`;
            tile.style.width = cellSize + 'px';
            tile.style.height = cellSize + 'px';
            tile.style.lineHeight = cellSize + 'px';
            
            newTiles[key] = tile;
        }
    }
    
    // 移除不存在的方块
    for (const key in tileElements) {
        if (!newTiles[key]) {
            tileElements[key].remove();
        }
    }
    tileElements = newTiles;
}

export function showGameOver() {
    gameOverEl.classList.remove('hidden');
}

export function hideGameOver() {
    gameOverEl.classList.add('hidden');
}

// 监听窗口大小变化
window.addEventListener('resize', render);