FROM mcr.microsoft.com/playwright:v1.47.0-jammy

WORKDIR /app

# Dùng wildcard: nếu không có package-lock.json thì vẫn copy được package.json
COPY package*.json ./

# Nếu có lockfile thì dùng npm ci, còn không thì npm install
RUN bash -lc 'if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi'

# Copy phần còn lại của mã nguồn
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
