FROM mcr.microsoft.com/playwright:v1.47.0-jammy
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
