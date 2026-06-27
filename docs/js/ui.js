// ==================== UI Rendering ====================

import { GRID_SIZE, grid, gameState } from './data.js';

const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const gameOverEl = document.getElementById('game-over');
const winMessageEl = document.getElementById('win-message');

// Track tile DOM elements by ID
let tileElements = new Map(); // id -> DOM element
let gridBackgroundBuilt = false;

// Cache layout parameters
let layoutCache = {
    gap: 0,
    cellSize: 0,
    boardWidth: 0
};

// Previous score, used to detect changes
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

    // Clear and rebuild background
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
 * Create a tile DOM element
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
 * Show score increase animation
 */
function showScoreIncrease(increase) {
    if (increase <= 0) return;

    // Create floating score element
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

    // Get score element position
    const scoreRect = scoreEl.getBoundingClientRect();
    const appRect = document.getElementById('app').getBoundingClientRect();

    floatEl.style.left = (scoreRect.left - appRect.left + scoreRect.width / 2) + 'px';
    floatEl.style.top = (scoreRect.top - appRect.top) + 'px';

    document.getElementById('app').appendChild(floatEl);

    // Remove after animation ends
    setTimeout(() => {
        floatEl.remove();
    }, 400);
}

/**
 * Initial render (no animation)
 */
export function render() {
    scoreEl.textContent = gameState.score;
    bestEl.textContent = gameState.best;

    // Detect score changes
    if (gameState.score > lastScore) {
        showScoreIncrease(gameState.score - lastScore);
    }
    lastScore = gameState.score;

    buildGridBackground();

    // Collect all tile IDs currently on the grid
    const currentIds = new Set();
    // Batch collect data first (read operations)
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

    // Collect tiles to remove
    const toRemove = [];
    for (const [id] of tileElements.entries()) {
        if (!currentIds.has(id)) {
            toRemove.push(id);
        }
    }

    // Use rAF to batch DOM write operations
    requestAnimationFrame(() => {
        // Remove tiles that no longer exist
        for (const id of toRemove) {
            tileElements.get(id).remove();
            tileElements.delete(id);
        }

        // Update existing tiles
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

        // Create new tiles
        for (const { id, value, r, c } of creates) {
            const tile = createTileElement(id, value, r, c);
            boardEl.appendChild(tile);
            tileElements.set(id, tile);
        }
    });
}

/**
 * Animated move rendering
 * @param {Object} moveInfo - Move info { moves, merges }
 * @param {Object} newTile - Newly spawned tile { id, value, r, c }
 * @param {Function} onDone - Callback after animation completes
 */
export function renderWithAnimation(moveInfo, newTile, onDone) {
    // Detect score changes
    if (gameState.score > lastScore) {
        showScoreIncrease(gameState.score - lastScore);
    }
    lastScore = gameState.score;

    scoreEl.textContent = gameState.score;
    bestEl.textContent = gameState.best;

    buildGridBackground();

    const { moves, merges } = moveInfo;

    // 1. Move all tiles to new positions (trigger CSS transition)
    const movingTiles = [];
    for (const move of moves) {
        const tile = tileElements.get(move.id);
        if (!tile) continue;

        const pos = getTilePosition(move.toRow, move.toCol);
        tile.style.transform = `translate(${pos.left}px, ${pos.top}px)`;
        movingTiles.push(tile);
    }

    // 2. After move animation completes, handle merges and new tiles
    const onMoveComplete = () => {
        // Handle merges: source tiles have slid to target position
        // For each merge, keep the first source tile (becomes merged value), hide the second
        for (const merge of merges) {
            // Find the two source tile IDs participating in the merge
            const mergeMoves = moves.filter(m =>
                m.toRow === merge.row && m.toCol === merge.col && m.merge
            );

            if (mergeMoves.length >= 2) {
                // First source tile: update to merged value, play bounce animation
                const firstTile = tileElements.get(mergeMoves[0].id);
                if (firstTile) {
                    const inner = firstTile.querySelector('.tile-inner');
                    if (inner) {
                        inner.textContent = merge.value;
                        // Update font size
                        updateLayoutCache();
                        const fontBase = layoutCache.cellSize * 0.4;
                        inner.style.fontSize = (merge.value >= 1024 ? fontBase * 0.85 : fontBase) + 'px';
                    }
                    // Key fix: don't use className assignment, it briefly removes .tile class
                    // causing transition property loss and inline transform jumping back to (0,0)
                    // Use classList operations to always keep .tile class present
                    firstTile.classList.remove('tile-2', 'tile-4', 'tile-8', 'tile-16', 'tile-32', 'tile-64', 'tile-128', 'tile-256', 'tile-512', 'tile-1024', 'tile-2048', 'tile-super');
                    firstTile.classList.add(`tile-${merge.value > 2048 ? 'super' : merge.value}`);
                    firstTile.classList.add('tile-merged');
                }

                // Second source tile: hide and remove
                const secondTile = tileElements.get(mergeMoves[1].id);
                if (secondTile) {
                    secondTile.remove();
                }
                tileElements.delete(mergeMoves[1].id);
            }
        }

        // Create newly spawned tile
        if (newTile && !tileElements.has(newTile.id)) {
            const tile = createTileElement(newTile.id, newTile.value, newTile.r, newTile.c);
            boardEl.appendChild(tile);
            tileElements.set(newTile.id, tile);
            // Force reflow before adding animation class to ensure animation triggers
            requestAnimationFrame(() => {
                tile.classList.add('tile-new');
            });
        }

        // Clean up animation classes (wait for animation to finish)
        setTimeout(() => {
            for (const tile of tileElements.values()) {
                tile.classList.remove('tile-new', 'tile-merged');
            }
            // Call callback after animation completes
            if (onDone) onDone();
        }, 300);
    };

    // Wait for move animation to complete, then handle merges and new tiles
    // Use fixed delay (100ms move animation + margin), more reliable than transitionend
    // transitionend may fire multiple times for the same element (transform x/y components), causing count errors
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

// Listen for window resize
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
