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

    // 采样：读 getComputedStyle 的 transform（能看到 CSS animation 的覆盖效果）
    async function sample() {
        return page.evaluate(() => {
            return [...document.querySelectorAll('.tile')].map(t => {
                const cs = getComputedStyle(t);
                return {
                    name: t.querySelector('.tile-name')?.textContent,
                    inlineTransform: t.style.transform,
                    computedTransform: cs.transform,
                    merged: t.classList.contains('tile-merged'),
                };
            });
        });
    }

    let captured = null;
    
    // 连续操作，高频采样，直到捕获到 merged 状态
    for (let attempt = 0; attempt < 40 && !captured; attempt++) {
        const keys = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];
        await page.keyboard.press(keys[attempt % 4]);
        
        for (let f = 0; f < 15; f++) {
            const s = await sample();
            if (s.some(t => t.merged)) {
                captured = s;
                break;
            }
            await new Promise(r => setTimeout(r, 20));
        }
        await new Promise(r => setTimeout(r, 100));
    }

    if (!captured) { console.log('❌ 未捕获 merge'); await browser.close(); return; }

    console.log('=== merge 期间 computed transform 采样 ===\n');
    const mergedTiles = captured.filter(t => t.merged);
    for (const t of mergedTiles) {
        console.log(`tile "${t.name}":`);
        console.log(`  inline transform:   ${t.inlineTransform}`);
        console.log(`  computed transform: ${t.computedTransform}`);
    }
    
    // 判断：computed transform 是否丢失 translate（变成纯 scale 矩阵，最后一列是 0,0）
    const lostTranslate = mergedTiles.some(t => {
        const m = t.computedTransform;
        // matrix(a, b, c, d, tx, ty) — 纯 scale 时 tx=0, ty=0
        const match = m.match(/matrix\(([-\d.]+), ([-\d.]+), ([-\d.]+), ([-\d.]+), ([-\d.]+), ([-\d.]+)\)/);
        if (!match) return false;
        const tx = parseFloat(match[5]), ty = parseFloat(match[6]);
        return Math.abs(tx) < 0.5 && Math.abs(ty) < 0.5; // translate 归零 = 掉回原点
    });
    
    console.log('\n' + (lostTranslate
        ? '❌ 确认 bug：computed transform 的 translate 归零，tile 掉回 (0,0)'
        : '✅ translate 未归零'));
    
    await browser.close();
})();
