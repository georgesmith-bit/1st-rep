// ==================== UI 渲染 ====================

import { GRID_SIZE, grid, gameState } from './data.js';

const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const gameOverEl = document.getElementById('game-over');
const winMessageEl = document.getElementById('win-message');

// 按 ID 追踪方块 DOM 元素
let tileElements = new Map(); // id -> DOM element
let gridBackgroundBuilt = false;

// 缓存布局参数
let layoutCache = {
    gap: 0,
    cellSize: 0,
    boardWidth: 0
};

// 上一次分数，用于检测变化
let lastScore = 0;

function updateLayoutCache() {
    const boardRect = boardEl.getBoundingClientRect();
    const boardWidth = boardRect.width;
    
    if (boardWidth === layoutCache.boardWidth) return;
    
    layoutCache.boardWidth = boardWidth;
    layoutCache.gap = boardWidth * 0.02;
    layoutCache.cellSize = (boardWidth - layoutCache.gap * (GRID_SIZE + 1)) / GRID_SIZE;
}

function getTilePosition(r, c) {
    const { gap, cellSize } = layoutCache;
    return {
        left: gap + c * (cellSize + gap),
        top: gap + r * (cellSize + gap)
    };
}

function buildGridBackground() {
    if (gridBackgroundBuilt) return;
    
    updateLayoutCache();
    const { gap, cellSize } = layoutCache;
    
    // 清空并重建背景
    const existingCells = boardEl.querySelectorAll('.grid-cell');
    existingCells.forEach(cell => cell.remove());
    
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
    
    gridBackgroundBuilt = true;
}

/**
 * 创建方块 DOM 元素
 */
function createTileElement(id, value, r, c) {
    updateLayoutCache();
    const { cellSize } = layoutCache;
    const fontBase = cellSize * 0.4;
    const pos = getTilePosition(r, c);
    
    const tile = document.createElement('div');
    tile.className = `tile tile-${value > 2048 ? 'super' : value}`;
    tile.dataset.id = id;
    tile.style.width = cellSize + 'px';
    tile.style.height = cellSize + 'px';
    tile.style.transform = `translate(${pos.left}px, ${pos.top}px)`;
    
    const inner = document.createElement('div');
    inner.className = 'tile-inner';
    inner.textContent = value;
    inner.style.fontSize = (value >= 1024 ? fontBase * 0.85 : fontBase) + 'px';
    inner.style.lineHeight = cellSize + 'px';
    
    tile.appendChild(inner);
    
    return tile;
}

/**
 * 显示分数增加动画
 */
function showScoreIncrease(increase) {
    if (increase <= 0) return;
    
    // 创建浮动分数元素
    const floatEl = document.createElement('div');
    floatEl.className = 'score-increase';
    floatEl.textContent = `+${increase}`;
    floatEl.style.cssText = `
        position: absolute;
        font-size: 24px;
        font-weight: bold;
        color: #776e65;
        pointer-events: none;
        z-index: 100;
    `;
    
    // 获取分数元素的位置
    const scoreRect = scoreEl.getBoundingClientRect();
    const appRect = document.getElementById('app').getBoundingClientRect();
    
    floatEl.style.left = (scoreRect.left - appRect.left + scoreRect.width / 2) + 'px';
    floatEl.style.top = (scoreRect.top - appRect.top) + 'px';
    
    document.getElementById('app').appendChild(floatEl);
    
    // 动画结束后移除
    setTimeout(() => {
        floatEl.remove();
    }, 400);
}

/**
 * 初始渲染（无动画）
 */
export function render() {
    scoreEl.textContent = gameState.score;
    bestEl.textContent = gameState.best;
    
    // 检测分数变化
    if (gameState.score > lastScore) {
        showScoreIncrease(gameState.score - lastScore);
    }
    lastScore = gameState.score;
    
    buildGridBackground();
    
    // 收集当前 grid 中的所有方块 ID
    const currentIds = new Set();
    // 先批量收集数据（读操作）
    const updates = [];
    const creates = [];
    
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = grid[r][c];
            if (cell === null) continue;
            
            currentIds.add(cell.id);
            
            if (tileElements.has(cell.id)) {
                updates.push({ id: cell.id, value: cell.value, r, c });
            } else {
                creates.push({ id: cell.id, value: cell.value, r, c });
            }
        }
    }
    
    // 收集需要移除的方块
    const toRemove = [];
    for (const [id] of tileElements.entries()) {
        if (!currentIds.has(id)) {
            toRemove.push(id);
        }
    }
    
    // 使用 rAF 批量执行 DOM 写操作
    requestAnimationFrame(() => {
        // 移除不存在的方块
        for (const id of toRemove) {
            tileElements.get(id).remove();
            tileElements.delete(id);
        }
        
        // 更新已有方块
        for (const { id, value, r, c } of updates) {
            const tile = tileElements.get(id);
            const pos = getTilePosition(r, c);
            tile.style.transform = `translate(${pos.left}px, ${pos.top}px)`;
            const inner = tile.querySelector('.tile-inner');
            if (inner) {
                inner.textContent = value;
            }
            tile.className = `tile tile-${value > 2048 ? 'super' : value}`;
        }
        
        // 创建新方块
        for (const { id, value, r, c } of creates) {
            const tile = createTileElement(id, value, r, c);
            boardEl.appendChild(tile);
            tileElements.set(id, tile);
        }
    });
}

/**
 * 带动画的移动渲染
 * @param {Object} moveInfo - 移动信息 { moves, merges }
 * @param {Object} newTile - 新生成的方块 { id, value, r, c }
 * @param {Function} onDone - 动画完成后的回调
 */
export function renderWithAnimation(moveInfo, newTile, onDone) {
    // 检测分数变化
    if (gameState.score > lastScore) {
        showScoreIncrease(gameState.score - lastScore);
    }
    lastScore = gameState.score;
    
    scoreEl.textContent = gameState.score;
    bestEl.textContent = gameState.best;
    
    buildGridBackground();
    
    const { moves, merges } = moveInfo;
    
    // 1. 移动所有方块到新位置（触发 CSS transition）
    const movingTiles = [];
    for (const move of moves) {
        const tile = tileElements.get(move.id);
        if (!tile) continue;
        
        const pos = getTilePosition(move.toRow, move.toCol);
        tile.style.transform = `translate(${pos.left}px, ${pos.top}px)`;
        movingTiles.push(tile);
    }
    
    // 2. 等待移动动画完成后，处理合并和新方块
    const onMoveComplete = () => {
        // 处理合并：源方块已滑到目标位置
        // 对于每次合并，保留第一个源方块（变成合并值），隐藏第二个
        for (const merge of merges) {
            // 找到参与合并的两个源方块 ID
            const mergeMoves = moves.filter(m => 
                m.toRow === merge.row && m.toCol === merge.col && m.merge
            );
            
            if (mergeMoves.length >= 2) {
                // 第一个源方块：更新为合并后的值，播放弹跳动画
                const firstTile = tileElements.get(mergeMoves[0].id);
                if (firstTile) {
                    const inner = firstTile.querySelector('.tile-inner');
                    if (inner) {
                        inner.textContent = merge.value;
                        // 更新字体大小
                        updateLayoutCache();
                        const fontBase = layoutCache.cellSize * 0.4;
                        inner.style.fontSize = (merge.value >= 1024 ? fontBase * 0.85 : fontBase) + 'px';
                    }
                    // 关键修复：不能用 className 赋值，会短暂移除 .tile 类
                    // 导致 transition 属性丢失，inline transform 跳回 (0,0)
                    // 用 classList 操作，始终保持 .tile 类存在
                    firstTile.classList.remove('tile-2', 'tile-4', 'tile-8', 'tile-16', 'tile-32', 'tile-64', 'tile-128', 'tile-256', 'tile-512', 'tile-1024', 'tile-2048', 'tile-super');
                    firstTile.classList.add(`tile-${merge.value > 2048 ? 'super' : merge.value}`);
                    firstTile.classList.add('tile-merged');
                }
                
                // 第二个源方块：隐藏并移除
                const secondTile = tileElements.get(mergeMoves[1].id);
                if (secondTile) {
                    secondTile.remove();
                }
                tileElements.delete(mergeMoves[1].id);
            }
        }
        
        // 创建新生成的方块
        if (newTile && !tileElements.has(newTile.id)) {
            const tile = createTileElement(newTile.id, newTile.value, newTile.r, newTile.c);
            boardEl.appendChild(tile);
            tileElements.set(newTile.id, tile);
            // 强制重排后再添加动画类，确保动画能触发
            requestAnimationFrame(() => {
                tile.classList.add('tile-new');
            });
        }
        
        // 清理动画类（等待动画完成）
        setTimeout(() => {
            for (const tile of tileElements.values()) {
                tile.classList.remove('tile-new', 'tile-merged');
            }
            // 动画完成后调用回调
            if (onDone) onDone();
        }, 300);
    };
    
    // 等待移动动画完成后处理合并和新方块
    // 使用固定延迟（100ms 移动动画 + 余量），比 transitionend 更可靠
    // transitionend 可能对同一元素多次触发（transform 的 x/y 分量），导致计数错乱
    setTimeout(onMoveComplete, 120);
}

export function showGameOver() {
    gameOverEl.classList.remove('hidden');
}

export function hideGameOver() {
    gameOverEl.classList.add('hidden');
}

export function showWin() {
    winMessageEl.classList.remove('hidden');
}

export function hideWin() {
    winMessageEl.classList.add('hidden');
}

// 监听窗口大小变化
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        gridBackgroundBuilt = false;
        layoutCache.boardWidth = 0;
        tileElements.clear();
        boardEl.querySelectorAll('.tile').forEach(tile => tile.remove());
        render();
    }, 150);
});
