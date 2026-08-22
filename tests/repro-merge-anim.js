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

    // 连续采样：按一个方向键，同时每 25ms 记录所有 tile 的 transform
    // 目标是捕捉 merge 瞬间第一个 tile 的 transform 是否跳变（丢失 translate）
    
    async function sample() {
        return page.evaluate(() => {
            return [...document.querySelectorAll('.tile')].map(t => ({
                name: t.querySelector('.tile-name')?.textContent,
                transform: t.style.transform,
                merged: t.classList.contains('tile-merged'),
            }));
        });
    }

    // 找一个能触发 merge 的方向：连按几次直到出现 merge（分数变化）
    let mergeCaptured = false;
    let frames = [];
    
    for (let attempt = 0; attempt < 20 && !mergeCaptured; attempt++) {
        const before = await page.$eval('#score', el => el.textContent);
        // 采样循环：按键后立即高频采样
        await page.keyboard.press('ArrowLeft');
        
        for (let f = 0; f < 20; f++) {
            const s = await sample();
            const hasMerged = s.some(t => t.merged);
            if (hasMerged) {
                frames.push(s);
                mergeCaptured = true;
            }
            await new Promise(r => setTimeout(r, 25));
        }
        
        const after = await page.$eval('#score', el => el.textContent);
        if (after === before) {
            // 这步没合并，换方向
            const keys = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
            await page.keyboard.press(keys[attempt % 4]);
        }
    }

    if (!mergeCaptured) {
        console.log('❌ 20 次尝试都没捕获到 merge');
        await browser.close();
        return;
    }

    console.log('=== 捕获到 merge，观察 transform 跳变 ===\n');
    
    // 分析：找 merge 的那个 tile，看它的 transform 是否丢失 translate
    for (let i = 0; i < frames.length; i++) {
        const merged = frames[i].filter(t => t.merged);
        if (merged.length > 0) {
            console.log(`帧 ${i}: 合并 tile 的 transform = "${merged[0].transform}"`);
        }
    }
    
    // 关键判断：merge 期间 transform 是否变成 scale（无 translate）
    const anomaly = frames.some(f => {
        const merged = f.find(t => t.merged);
        return merged && merged.transform && !merged.transform.includes('translate');
    });
    
    console.log('\n' + (anomaly 
        ? '❌ 确认：merge 动画期间 transform 丢失 translate，tile 跳回 (0,0)'
        : '✅ 未发现 transform 跳变'));
    
    await browser.close();
})();
