// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const { runVSDT } = require('./VSDT'); // dùng VSDT.js bạn đã có
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '2mb' }));

// HEALTH
app.get('/health', (req, res) => res.json({ ok: true }));

/**
 * POST /api/run
 * Body: { asinList: ["B0XXX", "..."] }  (tối đa 10)
 * Query:
 *    ?download=1  -> trả file ngay (attachment)
 *    (mặc định)   -> trả JSON {ok, filename, size, note}
 */
app.post('/api/run', async (req, res) => {
    try {
        const asinList = Array.isArray(req.body.asinList) ? req.body.asinList : [];
        // Chọn thư mục tải: ưu tiên biến môi trường (Railway Volume), fallback ./downloads
        const baseDir = process.env.DOWNLOAD_DIR || path.join(process.cwd(), 'downloads');

        const { xlsxPath } = await runVSDT({ asinList, downloadBase: baseDir });
        const filename = path.basename(xlsxPath);
        const stat = await fs.promises.stat(xlsxPath);

        // Nếu ?download=1 => stream file luôn
        if (String(req.query.download) === '1') {
            return res.download(xlsxPath, filename);
        }

        // Mặc định: trả thông tin để client chủ động tải lần 2 (an toàn cho n8n)
        res.json({
            ok: true,
            filename,
            size: stat.size,
            note: "Gọi lại endpoint này cùng ?download=1 để tải file, hoặc thay đổi server trả về base64 nếu bạn muốn 1 lần là xong."
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on :${PORT}`));
