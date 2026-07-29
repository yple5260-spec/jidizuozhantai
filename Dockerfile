# syntax=docker/dockerfile:1
#
# Apple Silicon Mac 构建 x86_64 镜像：
# docker buildx build --platform=linux/amd64 -t hebei-command-center:latest --load .

FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
RUN npm run build \
    && npm prune --omit=dev

FROM node:22-alpine

ENV NODE_ENV=production \
    API_PORT=4174 \
    DATA_DIR=/app/data

WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server ./server

RUN mkdir -p "${DATA_DIR}" \
    && chown node:node "${DATA_DIR}"

USER node

EXPOSE 4174

VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.API_PORT+'/health').then(response=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "server/server.js"]
