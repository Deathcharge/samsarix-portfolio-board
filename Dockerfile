# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY client ./client
COPY server ./server
COPY vite.config.js ./
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine AS runtime
ARG SOURCE_REVISION=unknown
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5000 \
    SOURCE_REVISION=${SOURCE_REVISION}
WORKDIR /app
COPY --chown=node:node --from=build /app/package.json /app/package-lock.json ./
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/server ./server
COPY --chown=node:node --from=build /app/client/dist ./client/dist
COPY --chown=node:node LICENSE NOTICE TRADEMARKS.md README.md ./
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:5000/api/health').then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "server/index.js"]
