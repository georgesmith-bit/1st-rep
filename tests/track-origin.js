const puppeteer = require('puppeteer-core');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/root/live2048/chrome/linux-152.0.7977.42/chrome-linux64/chrome',
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.goto('https://live2048.com/demo/', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 500));

    // 追踪一个 tile 在 scale 动画期间的 rect 中心变化
    async function trackNewTile() {
        return page.evaluate(() => {
            return new Promise((resolve) => {
                // 监听新 tile 出现（MutationObserver）
                const board = document.getElementById('board');
                const samples = [];
                let target = null;
                const obs = new MutationObserver((mutations) => {
                    for (const m of mutations) {
                        for (const node of m.addedNodes) {
                            if (node.classList && node.classList.contains('tile') && !target) {
                                target = node;
                                // 开始逐帧采样
                                const track = () => {
                                    const r = target.getBoundingClientRect();
                                    const br = board.getBoundingClientRect();
                                    samples.push({
                                        w: Math.round(r.width),
                                        h: Math.round(r.height),
                                        cx: Math.round(r.left - br.left + r.width/2),
                                        cy: Math.round(r.top - br.top + r.height/2),
                                    });
                                    if (samples.length < 15) requestAnimationFrame(track);
                                    else { obs.disconnect(); resolve(samples); }
                                };
                                requestAnimationFrame(track);
                            }
                        }
                    }
                });
                obs.observe(board, { childList: true });
                // 触发一个 move 产生新 tile
                setTimeout(() => {
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
                }, 50);
                // 超时保护
                setTimeout(() => { obs.disconnect(); resolve(samples); }, 3000);
            });
        });
    }

    console.log('=== 追踪新 tile 出现动画的 rect 中心 ===\n');
    const samples = await trackNewTile();
    
    if (samples.length === 0) { console.log('❌ 没采到样本'); await browser.close(); return; }
    
    console.log('帧\t宽\t高\t中心X\t中心Y');
    const centers = [];
    for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        centers.push([s.cx, s.cy]);
        console.log(`${i}\t${s.w}\t${s.h}\t${s.cx}\t${s.cy}`);
    }
    
    // 分析：中心是否固定（居中膨胀）还是移动（有方向）
    if (centers.length >= 2) {
        const first = centers[0], last = centers[centers.length - 1];
        const dx = Math.abs(last[0] - first[0]);
        const dy = Math.abs(last[1] - first[1]);
        console.log(`\n中心位移: dx=${dx}px, dy=${dy}px`);
        console.log(dx < 5 && dy < 5
            ? '✅ 中心固定，居中膨胀（正常）'
            : `❌ 中心移动了 ${dx},${dy}px —— 膨胀有方向，从 (${first[0]},${first[1]}) 向 (${last[0]},${last[1]})`);
    }
    
    await browser.close();
})();
