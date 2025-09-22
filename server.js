// server.js (rút gọn middleware)
import express from "express";
import { run as runVSDT } from "./VSDT.js";

const app = express();
app.use(express.json());

app.get("/", (_req, res) => res.send("vsdt-runner is up ✅"));

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
