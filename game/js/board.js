// ==================== 棋盘逻辑 ====================

import { GRID_SIZE, grid, gameState, saveBest } from './data.js';

// 在空格子中随机生成 2（90%）或 4（10%）
export function spawnTile() {
    const empty = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (grid[r][c] === 0) empty.push({ r, c });
        }
    }
    if (empty.length === 0) return false;
    const { r, c } = empty[Math.floor(Math.random() * empty.length)];
    grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    return true;
}

// 移动并合并一行（向左）
function slideRow(row) {
    // 去掉 0
    const filtered = row.filter(v => v !== 0);
    const result = [];
    for (let i = 0; i < filtered.length; i++) {
        if (i < filtered.length - 1 && filtered[i] === filtered[i + 1]) {
            result.push(filtered[i] * 2);
            gameState.score += filtered[i] * 2;
            i++; // 跳过被合并的方块
        } else {
            result.push(filtered[i]);
        }
    }
    while (result.length < GRID_SIZE) result.push(0);
    return result;
}

// 旋转棋盘（用于处理不同方向）
function rotate(g, times) {
    let result = g.map(row => [...row]);
    for (let t = 0; t < times; t++) {
        result = result[0].map((_, i) => result.map(row => row[i]).reverse());
    }
    return result;
}

// 指定方向移动
// direction: 0=up, 1=right, 2=down, 3=left
export function move(direction) {
    if (gameState.gameOver) return false;
    
    const oldGrid = grid.map(row => [...row]);
    
    // 将目标方向旋转为"向左"：0→3次, 1→2次, 2→1次, 3→0次
    const rotations = [3, 2, 1, 0][direction];
    let rotated = rotate(grid, rotations);
    
    // 每行向左滑动
    rotated = rotated.map(row => slideRow(row));
    
    // 旋转回来
    grid = rotate(rotated, (4 - rotations) % 4);
    
    saveBest();
    
    // 检查是否有变化
    const changed = !grid.every((row, r) => row.every((v, c) => v === oldGrid[r][c]));
    return changed;
}

// 检查是否还能移动
export function canMove() {
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (grid[r][c] === 0) return true;
            if (c < GRID_SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true;
            if (r < GRID_SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true;
        }
    }
    return false;
}

// 检查是否达到 2048
export function checkWin() {
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (grid[r][c] >= 2048) return true;
        }
    }
    return false;
}