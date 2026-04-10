FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build frontend
RUN npm run build

# Verify build output
RUN ls -la dist/client/ && echo "✓ Frontend built"

RUN mkdir -p data

EXPOSE 3001

ENV NODE_ENV=production

CMD ["sh", "-c", "npx tsx server/seed.ts && npx tsx server/index.ts"]
