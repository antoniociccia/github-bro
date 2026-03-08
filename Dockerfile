FROM node:22-alpine AS builder
WORKDIR /app

# Build backend
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build:server

# Build frontend
COPY ui ./ui
RUN cd ui && npm ci && npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
RUN mkdir -p data
EXPOSE 3010
CMD ["node", "dist/index.js"]
