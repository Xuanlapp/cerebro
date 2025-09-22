// server.js
import { run as runVSDT } from "./VSDT.js";

runVSDT({
    keywordsFile: "./ASIN.json",
    searchTermInStore: "sticker",
    // đặt HEADLESS=false khi chạy local muốn xem trình duyệt
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
