FROM mcr.microsoft.com/playwright:v1.47.0-jammy

WORKDIR /app

# Nếu CHƯA có package-lock.json, chỉ copy package.json trước
COPY package.json ./

# Cài deps (không cần lockfile)
RUN npm install --no-audit --no-fund

# Copy phần còn lại
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
