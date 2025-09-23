const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    // 🚀 Launch Chromium đi kèm Puppeteer (không hardcode Chrome path nữa)
    const browser = await puppeteer.launch({
        headless: false, // bật UI để bạn thấy trình duyệt
        args: ['--start-maximized'],
        defaultViewport: null,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari'
    );

    // ✅ Đọc file ASIN.json (đường dẫn động)
    const asinPath = process.env.ASIN_PATH || path.join(process.cwd(), 'ASIN.json');
    if (!fs.existsSync(asinPath)) {
        console.error('❌ Không tìm thấy file ASIN.json tại', asinPath);
        process.exit(1);
    }
    const rawData = JSON.parse(fs.readFileSync(asinPath, 'utf8'));
    const keywords = rawData.map(entry => entry.Keyword);

    // Mảng chứa tất cả kết quả
    const allResults = [];

    for (const keyword of keywords) {
        const keywordForUrl = keyword.trim().replace(/\s+/g, '+');
        const url = `https://www.amazon.com/s?k=${keywordForUrl}`;

        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Chờ kết quả
        await page.waitForSelector('div.s-result-item');

        // Lấy danh sách ASIN Amazon’s Choice (không Sponsored)
        const productLinks = await page.$$eval('div.s-result-item', items =>
            items
                .map(item => {
                    const asin = item.getAttribute('data-asin');
                    const isAmazonChoice = item.querySelector('[aria-label="Amazon\'s Choice"]') !== null;
                    const isSponsored = item.querySelector('.puis-sponsored-label-text') !== null;
                    return { asin, isAmazonChoice, isSponsored };
                })
                .filter(p => p.asin && p.isAmazonChoice && !p.isSponsored)
                .map(p => p.asin)
        );

        for (const asin of productLinks) {
            const storeUrl = `https://www.amazon.com/dp/${asin}`;
            await page.goto(storeUrl, { waitUntil: 'domcontentloaded' });

            const hasSellerProfile = await page.$('#sellerProfileTriggerId');
            if (hasSellerProfile) {
                await page.click('#sellerProfileTriggerId');
            } else {
                console.log('❌ Không tìm thấy sellerProfileTriggerId. Bỏ qua ASIN:', asin);
                continue; // sang sản phẩm khác thay vì dừng toàn bộ
            }

            await delay(2000);
            await page.waitForSelector('.a-link-normal', { visible: true });
            await page.click('.a-link-normal');

            await delay(2000);

            // Tìm search box
            await page.waitForSelector('#twotabsearchtextbox');
            await page.type('#twotabsearchtextbox', 'sticker', { delay: 100 });
            await page.keyboard.press('Enter');

            // Chờ kết quả
            await page.waitForSelector('div.s-main-slot > div[data-asin]', { timeout: 5000 })
                .catch(() => console.log('❌ Không tìm thấy sản phẩm'));

            // Lấy top 5
            const productsOnPage = await page.$$eval('div.s-main-slot > div[data-asin]', items =>
                items
                    .map(item => {
                        const asin = item.getAttribute('data-asin');
                        return asin && asin.length > 5 ? { asin } : null;
                    })
                    .filter(Boolean)
                    .slice(0, 5)
            );

            allResults.push(...productsOnPage);

            await delay(3000);
        }
    }

    // Xuất toàn bộ kết quả
    console.log('✅ Kết quả:', JSON.stringify(allResults, null, 2));

    await browser.close();
})();
