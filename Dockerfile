FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build frontend
RUN npm run build

RUN mkdir -p data

EXPOSE 3001

ENV NODE_ENV=production

CMD ["sh", "-c", "npx tsx server/seed.ts && npx tsx server/index.ts"]
