import express from "express";
import cors from "cors";
import { chromium } from "playwright";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Log mọi request để debug 404
app.use((req, _res, next) => {
    console.log(`[REQ] ${req.method} ${req.path}`);
    next();
});

async function runOpen(url = "https://example.com", actions = []) {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    for (const a of actions) {
        if (a.type === "click") await page.click(a.selector);
        else if (a.type === "fill") await page.fill(a.selector, a.value ?? "");
        else if (a.type === "waitForSelector") await page.waitForSelector(a.selector, { timeout: a.timeout ?? 10000 });
        else if (a.type === "wait") await page.waitForTimeout(a.ms ?? 1000);
    }

    const title = await page.title();
    const html = await page.content();
    await browser.close();

    return { ok: true, title, length: html.length };
}

// POST /open (chính)
app.post("/open", async (req, res) => {
    try {
        const url = req.body?.url || "https://example.com";
        const actions = req.body?.actions || [];
        const result = await runOpen(url, actions);
        return res.json(result);
    } catch (e) {
        console.error("Error /open:", e);
        return res.status(500).json({ ok: false, error: String(e) });
    }
});

// GET /open (test nhanh, không cần body)
app.get("/open", async (_req, res) => {
    try {
        const result = await runOpen("https://example.com", [{ type: "wait", ms: 500 }]);
        return res.json(result);
    } catch (e) {
        console.error("Error GET /open:", e);
        return res.status(500).json({ ok: false, error: String(e) });
    }
});

// GET /
app.get("/", (_req, res) => res.send("Web automation is running."));

// Wildcard để debug khi 404
app.use((req, res) => {
    console.warn(`[404] ${req.method} ${req.path}`);
    res.status(404).json({ ok: false, error: "Route not found", method: req.method, path: req.path });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server listening on", port));
