FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

RUN mkdir -p data

EXPOSE 3001

CMD ["sh", "-c", "node -e \"import('./server/seed.js').then(m => m.default ? m.default() : null).catch(() => null)\" 2>/dev/null; node dist/server/index.js"]
