// Cerebro.js
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getNextFolderPath(baseFolder) {
    let folderIndex = 1;
    let folderPath = path.join(baseFolder, `Cerebro${folderIndex}`);
    while (fs.existsSync(folderPath)) {
        folderIndex++;
        folderPath = path.join(baseFolder, `Cerebro${folderIndex}`);
    }
    return folderPath;
}

/**
 * Hàm chạy chính, có thể import để gọi từ file khác
 * @param {Object} opts
 * @param {string[]} [opts.asinList] - Nếu không truyền, sẽ đọc từ ASIN.json
 * @returns {Promise<{downloadPath: string}>}
 */
async function runCerebro(opts = {}) {
    // ==== 1) Cấu hình đường dẫn/launch qua ENV ====
    const HEADLESS = (process.env.HEADLESS ?? 'true').toLowerCase() === 'true';
    const CHROME_EXECUTABLE = process.env.CHROME_EXECUTABLE || undefined; // để trống = dùng Chromium của Puppeteer
    const ASIN_PATH = process.env.ASIN_PATH || path.join(process.cwd(), 'ASIN.json');
    const BASE_FOLDER = process.env.DOWNLOAD_DIR || path.join(process.cwd(), 'downloads');

    // ==== 2) Chuẩn bị asinList ====
    let asinListStr = '';
    if (Array.isArray(opts.asinList) && opts.asinList.length) {
        asinListStr = opts.asinList.slice(0, 10).join(', ');
    } else {
        if (!fs.existsSync(ASIN_PATH)) {
            throw new Error(`Không tìm thấy ASIN.json tại: ${ASIN_PATH}`);
        }
        const asinList = JSON.parse(fs.readFileSync(ASIN_PATH, 'utf8'))
            .map(obj => obj.asin)
            .filter(Boolean)
            .slice(0, 10);
        if (asinList.length === 0) throw new Error('ASIN rỗng trong ASIN.json');
        asinListStr = asinList.join(', ');
    }

    // ==== 3) Tạo thư mục download ====
    if (!fs.existsSync(BASE_FOLDER)) {
        fs.mkdirSync(BASE_FOLDER, { recursive: true });
    }
    const downloadPath = await getNextFolderPath(BASE_FOLDER);
    fs.mkdirSync(downloadPath, { recursive: true });
    console.log('[downloadPath]', downloadPath);

    // ==== 4) Khởi chạy trình duyệt ====
    const browser = await puppeteer.launch({
        headless: HEADLESS,
        executablePath: CHROME_EXECUTABLE, // nếu undefined -> dùng Chromium mặc định
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--start-maximized'
        ],
        defaultViewport: null
    });

    const page = await browser.newPage();
    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari'
    );

    // Thiết lập thư mục tải qua CDP
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath
    });

    try {
        // ==== 5) Vào Cerebro ====
        await page.goto('https://members.helium10.com/cerebro?accountId=1547036478', {
            waitUntil: 'networkidle2'
        });

        // ==== 6) Nhập ASIN ====
        const inputSelector1 = 'input[placeholder="Enter up to 10 product identifiers for keyword comparison."]';
        await page.waitForSelector(inputSelector1, { timeout: 30000 });
        await page.type(inputSelector1, asinListStr);
        await delay(2000);

        // ==== 7) Get Keywords / Run new search ====
        await page.waitForSelector('button[data-testid="getkeywords"]', { timeout: 10000 });
        await page.click('button[data-testid="getkeywords"]');

        try {
            await page.waitForSelector('button[data-testid="runnewsearch"]', { timeout: 10000 });
            await page.click('button[data-testid="runnewsearch"]');
        } catch (_) { /* có thể không xuất hiện, bỏ qua */ }

        // ==== 8) Đặt filter (giữ nguyên logic cũ) ====
        try {
            const allInputs = await page.$$('.sc-blmEgr.sc-cewOZc.TpBaI');
            if (allInputs.length > 10) {
                await allInputs[10].type('3');
            } else {
                console.error('Không tìm thấy đủ các trường input để thao tác!');
            }
        } catch (e) {
            console.warn('Bỏ qua input theo class cũ:', e.message);
        }

        await page.waitForSelector('input[data-testid="searchvolume"][placeholder="Min"]', { visible: true });
        await page.type('input[data-testid="searchvolume"][placeholder="Min"]', '200');

        await page.waitForSelector('input[data-testid="searchvolume"][placeholder="Max"]', { visible: true });
        // giữ nguyên để trống Max

        await page.waitForSelector('input[data-testid="titledensity"][placeholder="Min"]', { visible: true });
        await page.type('input[data-testid="titledensity"][placeholder="Min"]', '0');

        await page.waitForSelector('input[data-testid="titledensity"][placeholder="Max"]', { visible: true });
        await page.type('input[data-testid="titledensity"][placeholder="Max"]', '6');

        await page.waitForSelector('input[label="Exclude Keywords"][placeholder="Ex: red dress"]', { visible: true });
        await page.type('input[label="Exclude Keywords"][placeholder="Ex: red dress"]', 'decals, book, pack, books, sheet, sheets, packs');

        await page.waitForSelector('input[name="phrase"][placeholder="Ex: red dress"]', { visible: true });
        await page.type('input[name="phrase"][placeholder="Ex: red dress"]', 'sticker, stickers');

        await page.waitForSelector('button[data-testid="applyfilters"]', { timeout: 10000 });
        await page.click('button[data-testid="applyfilters"]');

        // ==== 9) Export XLSX ====
        await page.waitForSelector('button[data-testid="exportdata"]', { timeout: 10000 });
        await page.click('button[data-testid="exportdata"]');
        await delay(3000);

        await page.waitForSelector('div[data-testid="xlsx"]', { timeout: 10000 });
        await page.click('div[data-testid="xlsx"]');

        // chờ download chút
        await delay(7000);

        return { downloadPath };
    } finally {
        await browser.close();
    }
}

// Cho phép gọi trực tiếp: node Cerebro.js
if (require.main === module) {
    (async () => {
        try {
            const { downloadPath } = await runCerebro();
            console.log('DONE. Files at:', downloadPath);
        } catch (e) {
            console.error('ERROR:', e.message);
            process.exit(1);
        }
    })();
}

module.exports = { runCerebro };
