// VSDT.js (ESM)
import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// tiện dụng: delay
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run({
                              keywordsFile = "./ASIN.json",   // có thể truyền đường dẫn khác nếu cần
                              searchTermInStore = "sticker",  // từ khóa tìm trong store
                              headless = process.env.HEADLESS !== "false", // local muốn thấy UI: đặt HEADLESS=false
                          } = {}) {
    // Đọc file JSON tương đối với file hiện tại (không dùng đường dẫn D:/ ...)
    const filePath = path.resolve(__dirname, keywordsFile);
    const raw = JSON.parse(await fs.readFile(filePath, "utf8"));

    // Hỗ trợ cả format có "Keyword" hoặc "keyword" hoặc "asin"
    const keywords = raw
        .map((e) => e.Keyword ?? e.keyword ?? e.asin)
        .filter(Boolean);

    if (keywords.length === 0) {
        console.warn("⚠️ Không thấy trường Keyword/asin trong JSON.");
        return [];
    }

    // Cấu hình Puppeteer: Render (Linux) cần no-sandbox & không hard-code Chrome.exe
    const browser = await puppeteer.launch({
        headless,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath:
            process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
        defaultViewport: null,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
    );

    const allResults = [];

    try {
        for (const kw of keywords) {
            const keywordForUrl = String(kw).trim().replace(/\s+/g, "+");
            const url = `https://www.amazon.com/s?k=${keywordForUrl}`;

            await page.goto(url, { waitUntil: "domcontentloaded" });
            await page.waitForSelector("div.s-result-item", { timeout: 15000 });

            // Lấy các ASIN có "Amazon's Choice" và KHÔNG sponsored
            const productLinks = await page.$$eval("div.s-result-item", (items) =>
                items
                    .map((item) => {
                        const asin = item.getAttribute("data-asin");
                        const isAmazonChoice =
                            item.querySelector('[aria-label="Amazon\'s Choice"]') !== null ||
                            item.querySelector('[data-csa-c-type="badge"] [aria-label*="Amazon\'s Choice"]') !== null;
                        const isSponsored =
                            item.querySelector(".puis-sponsored-label-text") !== null ||
                            item.querySelector('[aria-label="Sponsored"]') !== null;
                        return { asin, isAmazonChoice, isSponsored };
                    })
                    .filter(
                        (p) => p.asin && p.asin.length > 5 && p.isAmazonChoice && !p.isSponsored
                    )
                    .map((p) => p.asin)
            );

            for (const asin of productLinks) {
                const storeUrl = `https://www.amazon.com/dp/${asin}`;
                await page.goto(storeUrl, { waitUntil: "domcontentloaded" });

                const hasSellerProfile = await page.$("#sellerProfileTriggerId");
                if (!hasSellerProfile) {
                    console.log(
                        `❌ Không thấy sellerProfileTriggerId cho ASIN ${asin}, bỏ qua.`
                    );
                    continue; // đừng dừng toàn bộ, chỉ bỏ qua item lỗi
                }

                await page.click("#sellerProfileTriggerId");
                await page.waitForSelector(".a-link-normal", { visible: true, timeout: 15000 }).catch(() => {});
                // cố gắng click link dẫn vào store (trang Profile đôi khi khác nhau)
                const links = await page.$$(".a-link-normal");
                if (links.length > 0) {
                    await links[0].click();
                } else {
                    console.log("❌ Không tìm thấy link vào store, bỏ qua.");
                    continue;
                }

                await delay(1500);

                // Tìm ô search trong store & search "sticker"
                await page.waitForSelector("#twotabsearchtextbox", { timeout: 15000 });
                await page.click("#twotabsearchtextbox", { delay: 50 });
                await page.keyboard.down("Control");
                await page.keyboard.press("A");
                await page.keyboard.up("Control");
                await page.type("#twotabsearchtextbox", searchTermInStore, { delay: 50 });
                await page.keyboard.press("Enter");

                // Lấy top 5 ASIN
                await page
                    .waitForSelector("div.s-main-slot > div[data-asin]", { timeout: 15000 })
                    .catch(() => console.log("❌ Không tìm thấy sản phẩm trong store"));

                const productsOnPage = await page.$$eval(
                    "div.s-main-slot > div[data-asin]",
                    (items) =>
                        items
                            .map((item) => {
                                const asin = item.getAttribute("data-asin");
                                return asin && asin.length > 5 ? { asin } : null;
                            })
                            .filter(Boolean)
                            .slice(0, 5)
                );

                allResults.push(
                    ...productsOnPage.map((p) => ({
                        sourceKeyword: kw,
                        storeAsin: asin,
                        productAsin: p.asin,
                    }))
                );

                await delay(1000);
            }

            await delay(1000);
        }

        console.log(JSON.stringify(allResults, null, 2));
        return allResults;
    } finally {
        await browser.close();
    }
}
