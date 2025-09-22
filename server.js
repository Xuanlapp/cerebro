import express from "express";
import bodyParser from "body-parser";
import { run as runVSDT } from "./VSDT.js";

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));

// (khuyến nghị) khóa API đơn giản
app.use((req, res, next) => {
    const key = process.env.API_KEY;
    if (!key) return next();
    if (req.headers["x-api-key"] !== key) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    next();
});

app.post("/run", async (req, res) => {
    try {
        const data = await runVSDT(req.body || {});
        res.json({ ok: true, data });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("vsdt-runner on :" + PORT));
