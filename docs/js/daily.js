// ==================== Daily Challenge ====================
// V1: Seeded PRNG + date-based daily seed + Classic/Daily mode switch
// Gated behind ?daily=test URL param until verified

// ── Seeded PRNG (mulberry32) ──
function mulberry32(seed) {
    return function() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// ── Seed generation from date ──
function generateDailySeed(dateStr) {
    // Simple string hash to produce a numeric seed
    let hash = 0;
    const salt = 'live2048_daily_v1';
    const input = dateStr + salt;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash);
}

// ── Get today's date string ──
function getTodayDateStr() {
    const now = new Date();
    return now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');
}

// ── Daily mode state ──
let dailyMode = false;
let dailyRng = null;
let dailyCompleted = false;
let dailyBest = 0;

// ── Check if daily mode is enabled (URL param gate) ──
function isDailyModeAvailable() {
    const params = new URLSearchParams(window.location.search);
    return params.get('daily') === 'test';
}

// ── Enter daily mode ──
function enterDailyMode() {
    if (!isDailyModeAvailable()) return;
    dailyMode = true;
    const today = getTodayDateStr();
    dailyRng = mulberry32(generateDailySeed(today));
    
    // Load saved daily state
    const saved = localStorage.getItem('daily_' + today);
    if (saved) {
        try {
            const data = JSON.parse(saved);
            dailyCompleted = data.completed || false;
            dailyBest = data.best || 0;
        } catch (e) {
            dailyCompleted = false;
            dailyBest = 0;
        }
    }
    
    // Start daily game
    import('./main.js').then(m => {
        // We need to override spawnTile to use seeded RNG
        // This will be handled by main.js checking dailyMode
    });
}

// ── Get seeded random value ──
function dailyRandom() {
    return dailyRng ? dailyRng() : Math.random();
}

// ── Save daily progress ──
function saveDailyProgress(score, won) {
    if (!dailyMode) return;
    const today = getTodayDateStr();
    if (won) dailyCompleted = true;
    if (score > dailyBest) dailyBest = score;
    localStorage.setItem('daily_' + today, JSON.stringify({
        completed: dailyCompleted,
        best: dailyBest,
        score: score,
        date: today
    }));
}

// ── Exit daily mode ──
function exitDailyMode() {
    dailyMode = false;
    dailyRng = null;
    dailyCompleted = false;
    dailyBest = 0;
}

export {
    dailyMode, dailyRandom, dailyCompleted, dailyBest,
    enterDailyMode, exitDailyMode, saveDailyProgress,
    isDailyModeAvailable, getTodayDateStr, generateDailySeed
};
