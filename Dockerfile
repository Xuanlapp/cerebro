# Dockerfile
FROM node:20-bullseye

# Cài dependencies cho Chromium (Puppeteer cần để chạy headless browser)
RUN apt-get update && apt-get install -y \
    ca-certificates fonts-liberation libasound2 libatk1.0-0 libatk-bridge2.0-0 \
    libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 \
    libgcc1 libglib2.0-0 libgbm1 libgtk-3-0 libnspr4 libnss3 \
    libpango-1.0-0 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxdamage1 libxext6 libxfixes3 libxrandr2 libxrender1 \
    xdg-utils wget \
  && rm -rf /var/lib/apt/lists/*

# Đặt thư mục làm việc bên trong container
WORKDIR /app

# Copy file package.json và package-lock.json để cài dependencies
COPY package*.json ./

# Cài dependencies Node.js
RUN npm install

# Copy toàn bộ source code của bạn vào container
COPY . .

# Đặt biến môi trường mặc định
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=false
ENV DOWNLOAD_DIR=/data/downloads

# Mở port cho server
EXPOSE 3000

# Lệnh khởi động khi container chạy
CMD ["node", "server.js"]
