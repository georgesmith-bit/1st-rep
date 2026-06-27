// ==================== Board Logic ====================

import { GRID_SIZE, grid, gameState, saveBest, generateTileId, saveUndoState } from './data.js';

// Randomly spawn a 2 (90%) or 4 (10%) in an empty cell
// Returns the new tile's ID and position
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

// Slide and merge a row (to the left)
// Returns movement trace info
function slideRow(row, rowIdx, colIdx) {
    const moves = []; // Record each tile's movement
    const merges = []; // Record merged tiles

    // Remove nulls
    const filtered = row.filter(v => v !== null);
    const result = [];

    for (let i = 0; i < filtered.length; i++) {
        if (i < filtered.length - 1 && filtered[i].value === filtered[i + 1].value) {
            // Merge
            const newValue = filtered[i].value * 2;
            gameState.score += newValue;

            // First tile moves to merge position, keeps its ID
            const mergeColIdx = result.length;
            moves.push({
                id: filtered[i].id,
                fromRow: rowIdx,
                fromCol: colIdx[i],
                toRow: rowIdx,
                toCol: mergeColIdx,
                merge: true
            });

            // Second tile also moves to merge position, then disappears
            moves.push({
                id: filtered[i + 1].id,
                fromRow: rowIdx,
                fromCol: colIdx[i + 1],
                toRow: rowIdx,
                toCol: mergeColIdx,
                merge: true,
                disappear: true
            });

            // Keep first tile's ID, update its value
            result.push({ id: filtered[i].id, value: newValue });
            merges.push({ id: filtered[i].id, row: rowIdx, col: mergeColIdx, value: newValue });

            i++; // Skip the merged tile
        } else {
            // No merge, just move
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

// Rotate the board (for handling different directions)
function rotate(g, times) {
    let result = g.map(row => [...row]);
    for (let t = 0; t < times; t++) {
        result = result[0].map((_, i) => result.map(row => row[i]).reverse());
    }
    return result;
}

// Reverse rotate coordinates
function reverseRotateCoord(r, c, times) {
    // Forward rotation: (r,c) -> (c, GRID_SIZE-1-r)
    // Reverse rotation: (r,c) -> (GRID_SIZE-1-c, r)
    let rr = r, cc = c;
    for (let t = 0; t < times; t++) {
        const temp = rr;
        rr = GRID_SIZE - 1 - cc;
        cc = temp;
    }
    return { r: rr, c: cc };
}

// Move in a specified direction
// direction: 0=up, 1=right, 2=down, 3=left
// Returns movement trace info
export function move(direction) {
    if (gameState.gameOver) return null;

    // Save current state for undo
    saveUndoState();

    const oldGrid = grid.map(row => row.map(cell => cell ? { ...cell } : null));

    // Rotate target direction to "left": 0->3, 1->2, 2->1, 3->0
    const rotations = [3, 2, 1, 0][direction];
    let rotated = rotate(grid, rotations);

    // Record original column indices for each row
    const allMoves = [];
    const allMerges = [];

    for (let r = 0; r < GRID_SIZE; r++) {
        const row = rotated[r];
        // Get original column indices
        const colIdx = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            const origCoord = reverseRotateCoord(r, c, rotations);
            colIdx.push(origCoord.c);
        }

        const { result, moves, merges } = slideRow(row, r, colIdx);
        rotated[r] = result;

        // Convert coordinates back to original direction
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

    // Rotate back
    const newGrid = rotate(rotated, (4 - rotations) % 4);
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            grid[r][c] = newGrid[r][c];
        }
    }

    saveBest();

    // Check if anything changed
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

// Check if any moves are still possible
export function canMove() {
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            // Check empty cell
            if (grid[r][c] === null) return true;

            const currentVal = grid[r][c].value;

            // Check if right neighbor can merge
            if (c < GRID_SIZE - 1 && grid[r][c + 1] !== null) {
                if (currentVal === grid[r][c + 1].value) return true;
            }

            // Check if bottom neighbor can merge
            if (r < GRID_SIZE - 1 && grid[r + 1][c] !== null) {
                if (currentVal === grid[r + 1][c].value) return true;
            }
        }
    }
    return false;
}

// Check if reached 2048
export function checkWin() {
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (grid[r][c] !== null && grid[r][c].value >= 2048) return true;
        }
    }
    return false;
}
