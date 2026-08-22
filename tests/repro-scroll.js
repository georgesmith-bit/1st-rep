const puppeteer = require('puppeteer-core');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/root/live2048/chrome/linux-152.0.7977.42/chrome-linux64/chrome',
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    // 移动端 viewport
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    
    await page.goto('https://live2048.com/demo/', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 800));
    
    // 1. 检查页面是否有滚动空间
    const scrollInfo = await page.evaluate(() => ({
        innerHeight: window.innerHeight,
        scrollHeight: document.body.scrollHeight,
        docScrollHeight: document.documentElement.scrollHeight,
        scrollY: window.scrollY,
        bodyMargin: getComputedStyle(document.body).margin,
        overflow: getComputedStyle(document.body).overflow,
    }));
    console.log('=== 页面滚动空间检查 ===');
    console.log(JSON.stringify(scrollInfo, null, 2));
    console.log(`可滚动空间: ${scrollInfo.scrollHeight - scrollInfo.innerHeight}px`);
    
    // 2. 检查 board 的 touch-action CSS
    const touchAction = await page.evaluate(() => {
        const board = document.getElementById('board');
        const container = document.getElementById('board-container');
        const app = document.getElementById('app');
        return {
            board: getComputedStyle(board).touchAction,
            container: getComputedStyle(container).touchAction,
            app: getComputedStyle(app).touchAction,
            body: getComputedStyle(document.body).touchAction,
        };
    });
    console.log('\n=== touch-action CSS ===');
    console.log(JSON.stringify(touchAction, null, 2));
    
    // 3. 模拟向下滑动，检查 scrollY 是否变化
    const client = await page.target().createCDPSession();
    const center = await page.$eval('#board', el => {
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width/2, y: r.y + r.height/2 };
    });
    
    console.log('\n=== 模拟向下滑动 (dy=+200) ===');
    console.log(`滑动起点: (${center.x}, ${center.y})`);
    
    const beforeScrollY = await page.evaluate(() => window.scrollY);
    console.log(`滑动前 window.scrollY = ${beforeScrollY}`);
    
    // 向下滑：touchStart → 逐步 touchMove 向下 → touchEnd
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: center.x, y: center.y }] });
    const steps = 20;
    const dy = 200;
    for (let i = 1; i <= steps; i++) {
        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: center.x, y: center.y + dy * i/steps }]
        });
        await new Promise(r => setTimeout(r, 8));
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await new Promise(r => setTimeout(r, 500));
    
    const afterScrollY = await page.evaluate(() => window.scrollY);
    console.log(`滑动后 window.scrollY = ${afterScrollY}`);
    console.log(`\n${afterScrollY > beforeScrollY ? '❌ 复现成功：页面确实被滚动了' : '✅ 未复现：页面没有滚动'}`);
    
    // 4. 再测向上滑动
    await page.evaluate(() => window.scrollTo(0, 0));
    const beforeUp = await page.evaluate(() => window.scrollY);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: center.x, y: center.y }] });
    for (let i = 1; i <= steps; i++) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: center.x, y: center.y - dy * i/steps }] });
        await new Promise(r => setTimeout(r, 8));
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await new Promise(r => setTimeout(r, 500));
    const afterUp = await page.evaluate(() => window.scrollY);
    console.log(`\n向上滑动后 scrollY: ${beforeUp} → ${afterUp}`);
    
    await browser.close();
})();
