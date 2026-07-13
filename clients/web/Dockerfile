FROM node:26.5.0-alpine3.23 AS deps
WORKDIR /app
COPY clients/web/package.json clients/web/package-lock.json ./
RUN npm ci

FROM node:26.5.0-alpine3.23 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY clients/web ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:26.5.0-alpine3.23 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0"]
