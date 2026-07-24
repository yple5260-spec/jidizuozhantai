FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/server ./server
COPY --from=build /app/dist ./dist
ENV API_PORT=4174
EXPOSE 4174
CMD ["node","server/server.js"]
