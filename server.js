import express from "express";
import { run as runVSDT } from "./VSDT.js";

const app = express();
app.use(express.json());

// (khuyến nghị) API key đơn giản
const API_KEY = process.env.API_KEY;
app.use((req, res, next) => {
    if (!API_KEY) return next(); // không cấu hình thì bỏ qua check
    if (req.headers["x-api-key"] === API_KEY) return next();
    return res.status(401).json({ ok: false, error: "Unauthorized" });
});

// Health check
app.get("/", (_req, res) => res.send("vsdt-runner is up ✅"));

// Chạy job
app.post("/run", async (req, res) => {
    try {
        const data = await runVSDT(req.body || {});
        res.json({ ok: true, data });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e.message) });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API server running on port " + PORT));
