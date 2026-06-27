// ==================== 游戏入口 ====================

import { initGrid, grid, loadBest, gameState, saveGameState, loadGameState, restoreUndoState, canUndo } from './data.js';
import { spawnTile, move, canMove, checkWin } from './board.js';
import { initInput } from './input.js';
import { render, renderWithAnimation, showGameOver, hideGameOver, showWin, hideWin } from './ui.js';

// 防连击标志
let isProcessing = false;

function startGame() {
    initGrid();
    gameState.score = 0;
    gameState.gameOver = false;
    gameState.won = false;
    gameState.keepPlaying = false;
    loadBest();
    hideGameOver();
    hideWin();
    
    spawnTile();
    spawnTile();
    render();
    sendState();
    saveGameState();
    updateUndoButton();
}

function handleMove(direction) {
    // 防连击检查
    if (isProcessing || gameState.gameOver) return;
    
    const moveInfo = move(direction);
    if (!moveInfo) return;
    
    // 设置防连击标志
    isProcessing = true;
    
    const newTile = spawnTile();
    
    // 使用回调确保动画完成后再发送状态
    renderWithAnimation(moveInfo, newTile, () => {
        // 重置防连击标志
        isProcessing = false;
        
        sendState();
        saveGameState();
        updateUndoButton();
        
        if (!canMove()) {
            gameState.gameOver = true;
            setTimeout(showGameOver, 300);
        }
        
        // 检查是否达到 2048，显示胜利提示
        if (!gameState.won && checkWin()) {
            gameState.won = true;
            setTimeout(showWin, 300);
        }
    });
}

// 远程控制：上报状态
function sendState() {
    try {
        // 逻辑状态 - 将对象数组转换为值数组
        const gridData = {
            grid: grid.map(row => row.map(cell => cell ? cell.value : 0)),
            score: gameState.score,
            best: gameState.best,
            gameOver: gameState.gameOver,
            won: gameState.won
        };
        fetch('/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gridData)
        });
        // DOM 视觉状态
        const boardEl = document.getElementById('board');
        const tiles = boardEl.querySelectorAll('.tile');
        const domTiles = [];
        tiles.forEach(t => {
            const [x, y] = (t.style.left && t.style.top)
                ? [parseInt(t.style.left), parseInt(t.style.top)]
                : t.style.transform
                    ? t.style.transform.match(/translate\((\d+)px,\s*(\d+)px\)/).slice(1).map(Number)
                    : [0, 0];
            domTiles.push({
                val: parseInt(t.textContent) || 0,
                left: parseInt(t.style.left) || 0,
                top: parseInt(t.style.top) || 0,
                classes: t.className
            });
        });
        // 也上报 board 的 children 总数用于调试
        const debugInfo = {
            tiles: domTiles,
            boardChildren: boardEl.children.length,
            boardHTML: boardEl.children.length
        };
        fetch('/dom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(debugInfo)
        });
    } catch (e) {}
}

// 远程控制：轮询命令
function pollRemoteCmd() {
    fetch('/cmd')
        .then(r => r.json())
        .then(data => {
            if (data.cmd !== null && data.cmd !== undefined) {
                handleMove(data.cmd);
            }
        })
        .catch(() => {});
    setTimeout(pollRemoteCmd, 200);
}

// 初始化
initInput(handleMove);
document.getElementById('restart-btn').addEventListener('click', () => { startGame(); sendState(); });
document.getElementById('retry-btn').addEventListener('click', () => { startGame(); sendState(); });

// 胜利提示按钮
document.getElementById('keep-playing-btn').addEventListener('click', () => {
    hideWin();
    gameState.keepPlaying = true;
});

document.getElementById('new-game-btn').addEventListener('click', () => {
    hideWin();
    startGame();
    sendState();
});

// 撤销功能
const undoBtn = document.getElementById('undo-btn');
undoBtn.addEventListener('click', () => {
    if (restoreUndoState()) {
        hideGameOver();
        render();
        sendState();
        saveGameState();
        updateUndoButton();
    }
});

// 更新撤销按钮状态
function updateUndoButton() {
    undoBtn.disabled = !canUndo();
}

// 深色模式切换
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = themeToggle.querySelector('.theme-icon');
const savedTheme = localStorage.getItem('theme') || 'light';

if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    themeIcon.textContent = '☀️';
}

themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-mode');
    themeIcon.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// 初始化游戏
function initGame() {
    // 尝试加载保存的游戏状态
    if (loadGameState()) {
        render();
        sendState();
        // 恢复 Game Over / Win 界面状态
        if (gameState.gameOver) {
            showGameOver();
        }
        if (gameState.won && !gameState.keepPlaying) {
            showWin();
        }
    } else {
        startGame();
    }
}

initGame();
pollRemoteCmd();