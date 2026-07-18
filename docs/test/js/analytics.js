// ==================== GA4 Event Tracking ====================
// 14 events: game_start, tile_move, tile_merge, game_over, game_win,
// milestone_reached, undo_used, keep_playing, share_score,
// return_visit, session_start, session_duration, theme_toggle, new_game_after_win

const ANALYTICS_VERSION = '1';
const GA_ID = 'G-S0NZ96NCB1';

// ── Session tracking ──
let sessionStart = Date.now();
let moveCount = 0;
let lastMoveSend = 0;
let lastScore = 0;
let milestonesReached = {};

// Reset per-game state
function resetGameState() {
    moveCount = 0;
    lastScore = 0;
    milestonesReached = {};
}

// ── Core event sender ──
function sendEvent(name, params = {}) {
    if (typeof gtag !== 'function') return;
    try {
        gtag('event', name, {
            ...params,
            analytics_version: ANALYTICS_VERSION
        });
    } catch (e) {}
}

// ── Event definitions ──

/** 1. session_start — 页面加载 */
export function trackSessionStart(params = {}) {
    const isReturn = !!localStorage.getItem('2048_gameState');
    sendEvent('session_start', { ...params, is_return_visit: isReturn });
}

/** 2. game_start — 新游戏开始 */
export function trackGameStart() {
    resetGameState();
    sendEvent('game_start');
}

/** 3. tile_move — 方块移动（节流：每5步或每3秒发一次） */
export function trackTileMove(direction) {
    moveCount++;
    const now = Date.now();
    if (moveCount % 5 === 0 || now - lastMoveSend > 3000) {
        sendEvent('tile_move', {
            move_count: moveCount,
            direction: ['up', 'right', 'down', 'left'][direction] || 'unknown'
        });
        lastMoveSend = now;
    }
}

/** 4. tile_merge — 方块合并 */
export function trackTileMerge(mergeValue, totalMerges) {
    sendEvent('tile_merge', {
        merge_value: mergeValue,
        merge_count: totalMerges
    });
}

/** 5. milestone_reached — 达成里程碑 */
export function trackMilestone(value) {
    const key = String(value);
    if (milestonesReached[key]) return;  // 只发一次
    milestonesReached[key] = true;

    const milestoneNames = { 512: '512', 1024: '1024', 2048: '2048', 4096: '4096' };
    sendEvent('milestone_reached', {
        milestone: milestoneNames[value] || String(value),
        tile_value: value
    });
}

/** 6. game_over — 游戏结束 */
export function trackGameOver(finalScore, moveCountTotal) {
    sendEvent('game_over', {
        final_score: finalScore,
        total_moves: moveCount,
        highest_milestone: Object.keys(milestonesReached).pop() || '0'
    });
}

/** 7. game_win — 达到2048 */
export function trackGameWin(score) {
    sendEvent('game_win', { score });
}

/** 8. undo_used — 使用撤销 */
export function trackUndo() {
    sendEvent('undo_used');
}

/** 9. keep_playing — 达到2048后继续 */
export function trackKeepPlaying(score) {
    sendEvent('keep_playing', { score });
}

/** 10. new_game_after_win — 赢了之后开新局 */
export function trackNewGameAfterWin() {
    sendEvent('new_game_after_win');
}

/** 11. theme_toggle — 切换主题 */
export function trackThemeToggle(newTheme) {
    sendEvent('theme_toggle', { theme: newTheme });
}

/** 12. return_visit — 用户回访（有存档记录） */
export function trackReturnVisit() {
    sendEvent('return_visit');
}

/** 13. session_duration — 会话时长（页面关闭时发送） */
export function trackSessionEnd() {
    const duration = Math.round((Date.now() - sessionStart) / 1000);
    if (navigator.sendBeacon) {
        const data = new URLSearchParams({
            v: '2',
            tid: GA_ID,
            uid: localStorage.getItem('2048_uid') || 'anonymous',
            en: 'session_duration',
            'ep.session_duration_sec': String(duration),
            'ep.last_score': String(lastScore),
            'ep.total_moves': String(moveCount)
        });
        navigator.sendBeacon('https://www.google-analytics.com/g/collect', data);
    }
}

/** 14. share_score — 分享战绩（预留） */
export function trackShareScore(score, method) {
    sendEvent('share_score', { score, share_method: method || 'unknown' });
}

// ── Auto init ──
window.addEventListener('load', () => {
    trackSessionStart();
});

window.addEventListener('beforeunload', () => {
    trackSessionEnd();
});
