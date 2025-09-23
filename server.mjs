import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json());

app.post("/open", async (req, res) => {
    const url = req.body?.url || "https://example.com";
    const actions = req.body?.actions || []; // (tuỳ chọn) chuỗi thao tác
    let browser;

    try {
        browser = await chromium.launch({ headless: true });
        const ctx = await browser.newContext();
        const page = await ctx.newPage();

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

        // Ví dụ xử lý actions đơn giản
        for (const a of actions) {
            if (a.type === "click") await page.click(a.selector);
            if (a.type === "fill") await page.fill(a.selector, a.value ?? "");
            if (a.type === "waitForSelector") await page.waitForSelector(a.selector, { timeout: a.timeout ?? 10000 });
            if (a.type === "wait") await page.waitForTimeout(a.ms ?? 1000);
        }

        const title = await page.title();
        const html = await page.content(); // (nếu cần trả về)
        await browser.close();

        return res.json({ ok: true, title, length: html.length });
    } catch (e) {
        if (browser) await browser.close();
        return res.status(500).json({ ok: false, error: String(e) });
    }
});

app.get("/", (req, res) => res.send("Web automation is running."));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server listening on", port));
