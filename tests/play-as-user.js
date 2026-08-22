const puppeteer = require('puppeteer-core');

// 模拟 C 端玩家真实玩几局，收集体验数据
(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/root/live2048/chrome/linux-152.0.7977.42/chrome-linux64/chrome',
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    
    await page.goto('https://live2048.com/demo/', { waitUntil: 'networkidle0', timeout: 15000 });
    
    // 读取游戏状态（通过 DOM）
    async function readState() {
        return page.evaluate(() => {
            const tiles = [...document.querySelectorAll('.tile')].map(t => ({
                emoji: t.querySelector('.tile-emoji')?.textContent,
                name: t.querySelector('.tile-name')?.textContent,
                rarity: t.getAttribute('data-rarity'),
                transform: t.style.transform
            }));
            const score = document.getElementById('score')?.textContent;
            const best = document.getElementById('best')?.textContent;
            const collectionCount = document.getElementById('collection-count')?.textContent;
            const gameOver = !document.getElementById('game-over')?.classList.contains('hidden');
            return { tiles: tiles.length, tileDetails: tiles, score, best, collectionCount, gameOver };
        });
    }
    
    // 策略：尝试 4 个方向，选能产生合并的（通过分数变化判断）
    async function smartMove() {
        for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
            const before = await page.$eval('#score', el => el.textContent);
            await page.keyboard.press(key);
            await new Promise(r => setTimeout(r, 150));
            const after = await page.$eval('#score', el => el.textContent);
            if (after !== before) return key; // 分数变了 = 产生了合并
        }
        // 4 方向都不合并，随便动一个
        const keys = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];
        const k = keys[Math.floor(Math.random()*4)];
        await page.keyboard.press(k);
        await new Promise(r => setTimeout(r, 150));
        return k;
    }
    
    console.log('=== 模拟 C 端玩家真实游玩 ===\n');
    
    let games = 0;
    let totalMoves = 0;
    
    for (let game = 1; game <= 3; game++) {
        // 新游戏
        await page.tap('#restart-btn');
        await new Promise(r => setTimeout(r, 500));
        
        console.log(`\n--- 第 ${game} 局 ---`);
        const start = await readState();
        console.log(`开局: ${start.tiles} 个 tile, 初始显示: ${JSON.stringify(start.tileDetails.map(t=>t.name))}`);
        
        let moves = 0;
        while (moves < 500) {
            await smartMove();
            moves++;
            
            // 检查是否 game over
            const state = await readState();
            if (state.gameOver) {
                console.log(`Game Over: 分数=${state.score}, 步数=${moves}, 发现宠物=${state.collectionCount}`);
                console.log(`最终 tile: ${JSON.stringify(state.tileDetails.map(t=>t.name+'('+t.rarity+')'))}`);
                break;
            }
        }
        totalMoves += moves;
        games++;
    }
    
    console.log('\n=== 体验数据汇总 ===');
    console.log(`局数: ${games}, 总步数: ${totalMoves}`);
    console.log(`Console errors: ${errors.length}`);
    
    // 截图 game over 场景
    await page.screenshot({ path: '/root/demo-gameover.png' });
    console.log('game over 截图: /root/demo-gameover.png');
    
    await browser.close();
})();
