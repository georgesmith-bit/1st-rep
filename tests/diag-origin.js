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

    // 诊断：读每个 tile 的 transform-origin、布局位置、视觉位置
    const diag = await page.evaluate(() => {
        return [...document.querySelectorAll('.tile')].map(t => {
            const cs = getComputedStyle(t);
            const rect = t.getBoundingClientRect();
            const boardRect = document.getElementById('board').getBoundingClientRect();
            return {
                name: t.querySelector('.tile-name')?.textContent,
                transformOrigin: cs.transformOrigin,
                inlineTransform: t.style.transform,
                // 布局位置（未 transform 的静态位置，相对 board）
                offsetLeft: t.offsetLeft,
                offsetTop: t.offsetTop,
                // 视觉位置（相对 board 左上角）
                visualLeft: Math.round(rect.left - boardRect.left),
                visualTop: Math.round(rect.top - boardRect.top),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
            };
        });
    });

    console.log('=== tile 定位诊断 ===\n');
    for (const d of diag) {
        console.log(`tile "${d.name}":`);
        console.log(`  transform-origin: ${d.transformOrigin}`);
        console.log(`  offsetLeft/Top (布局位置): ${d.offsetLeft}, ${d.offsetTop}`);
        console.log(`  视觉位置 (相对board): ${d.visualLeft}, ${d.visualTop}`);
        console.log(`  尺寸: ${d.width}×${d.height}`);
        console.log(`  inline transform: ${d.inlineTransform}`);
        console.log('');
    }

    // 关键判断：offsetLeft/Top 是否全为 0（说明布局位置在 board 左上角，translate 才移动到视觉位置）
    const allZeroOffset = diag.every(d => d.offsetLeft === 0 && d.offsetTop === 0);
    console.log(allZeroOffset
        ? '❌ 确认：所有 tile 布局位置在 (0,0)，靠 translate 移到视觉位置 → scale 动画的 transform-origin(center) 落在 board 左上角，膨胀中心错误'
        : '✅ tile 布局位置正常');

    await browser.close();
})();
