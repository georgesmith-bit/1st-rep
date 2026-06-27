// ==================== 棋盘逻辑 ====================

import { GRID_SIZE, grid, gameState, saveBest, generateTileId, saveUndoState } from './data.js';

// 在空格子中随机生成 2（90%）或 4（10%）
// 返回新方块的 ID 和位置
export function spawnTile() {
    const empty = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (grid[r][c] === null) empty.push({ r, c });
        }
    }
    if (empty.length === 0) return null;
    const { r, c } = empty[Math.floor(Math.random() * empty.length)];
    const id = generateTileId();
    const value = Math.random() < 0.9 ? 2 : 4;
    grid[r][c] = { id, value };
    return { id, value, r, c };
}

// 移动并合并一行（向左）
// 返回移动轨迹信息
function slideRow(row, rowIdx, colIdx) {
    const moves = []; // 记录每个方块的移动
    const merges = []; // 记录合并的方块
    
    // 去掉 null
    const filtered = row.filter(v => v !== null);
    const result = [];
    
    for (let i = 0; i < filtered.length; i++) {
        if (i < filtered.length - 1 && filtered[i].value === filtered[i + 1].value) {
            // 合并
            const newValue = filtered[i].value * 2;
            gameState.score += newValue;
            
            // 第一个方块移动到合并位置，保留其 ID
            const mergeColIdx = result.length;
            moves.push({
                id: filtered[i].id,
                fromRow: rowIdx,
                fromCol: colIdx[i],
                toRow: rowIdx,
                toCol: mergeColIdx,
                merge: true
            });
            
            // 第二个方块也移动到合并位置，然后消失
            moves.push({
                id: filtered[i + 1].id,
                fromRow: rowIdx,
                fromCol: colIdx[i + 1],
                toRow: rowIdx,
                toCol: mergeColIdx,
                merge: true,
                disappear: true
            });
            
            // 保留第一个方块的 ID，更新其 value
            result.push({ id: filtered[i].id, value: newValue });
            merges.push({ id: filtered[i].id, row: rowIdx, col: mergeColIdx, value: newValue });
            
            i++; // 跳过被合并的方块
        } else {
            // 不合并，直接移动
            const newColIdx = result.length;
            moves.push({
                id: filtered[i].id,
                fromRow: rowIdx,
                fromCol: colIdx[i],
                toRow: rowIdx,
                toCol: newColIdx,
                merge: false
            });
            result.push(filtered[i]);
        }
    }
    
    while (result.length < GRID_SIZE) result.push(null);
    
    return { result, moves, merges };
}

// 旋转棋盘（用于处理不同方向）
function rotate(g, times) {
    let result = g.map(row => [...row]);
    for (let t = 0; t < times; t++) {
        result = result[0].map((_, i) => result.map(row => row[i]).reverse());
    }
    return result;
}

// 反向旋转坐标
function reverseRotateCoord(r, c, times) {
    // 正向旋转：(r,c) -> (c, GRID_SIZE-1-r)
    // 反向旋转：(r,c) -> (GRID_SIZE-1-c, r)
    let rr = r, cc = c;
    for (let t = 0; t < times; t++) {
        const temp = rr;
        rr = GRID_SIZE - 1 - cc;
        cc = temp;
    }
    return { r: rr, c: cc };
}

// 指定方向移动
// direction: 0=up, 1=right, 2=down, 3=left
// 返回移动轨迹信息
export function move(direction) {
    if (gameState.gameOver) return null;
    
    // 保存当前状态用于撤销
    saveUndoState();
    
    const oldGrid = grid.map(row => row.map(cell => cell ? { ...cell } : null));
    
    // 将目标方向旋转为"向左"：0→3次, 1→2次, 2→1次, 3→0次
    const rotations = [3, 2, 1, 0][direction];
    let rotated = rotate(grid, rotations);
    
    // 记录每行的原始列索引
    const allMoves = [];
    const allMerges = [];
    
    for (let r = 0; r < GRID_SIZE; r++) {
        const row = rotated[r];
        // 获取原始列索引
        const colIdx = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            const origCoord = reverseRotateCoord(r, c, rotations);
            colIdx.push(origCoord.c);
        }
        
        const { result, moves, merges } = slideRow(row, r, colIdx);
        rotated[r] = result;
        
        // 转换坐标回原始方向
        for (const m of moves) {
            const fromCoord = reverseRotateCoord(m.fromRow, m.fromCol, rotations);
            const toCoord = reverseRotateCoord(m.toRow, m.toCol, rotations);
            allMoves.push({
                id: m.id,
                fromRow: fromCoord.r,
                fromCol: fromCoord.c,
                toRow: toCoord.r,
                toCol: toCoord.c,
                merge: m.merge,
                disappear: m.disappear
            });
        }
        
        for (const m of merges) {
            const coord = reverseRotateCoord(m.row, m.col, rotations);
            allMerges.push({ id: m.id, row: coord.r, col: coord.c, value: m.value });
        }
    }
    
    // 旋转回来
    const newGrid = rotate(rotated, (4 - rotations) % 4);
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            grid[r][c] = newGrid[r][c];
        }
    }
    
    saveBest();
    
    // 检查是否有变化
    const changed = !grid.every((row, r) => row.every((cell, c) => {
        const oldCell = oldGrid[r][c];
        if (cell === null && oldCell === null) return true;
        if (cell === null || oldCell === null) return false;
        return cell.id === oldCell.id && cell.value === oldCell.value;
    }));
    
    if (!changed) return null;
    
    return {
        moves: allMoves,
        merges: allMerges
    };
}

// 检查是否还能移动
export function canMove() {
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            // 检查空格子
            if (grid[r][c] === null) return true;
            
            const currentVal = grid[r][c].value;
            
            // 检查右边是否可以合并
            if (c < GRID_SIZE - 1 && grid[r][c + 1] !== null) {
                if (currentVal === grid[r][c + 1].value) return true;
            }
            
            // 检查下边是否可以合并
            if (r < GRID_SIZE - 1 && grid[r + 1][c] !== null) {
                if (currentVal === grid[r + 1][c].value) return true;
            }
        }
    }
    return false;
}

// 检查是否达到 2048
export function checkWin() {
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (grid[r][c] !== null && grid[r][c].value >= 2048) return true;
        }
    }
    return false;
}