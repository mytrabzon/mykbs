# MyKBS KBS Backend — Supabase + Polis/Jandarma KBS
FROM node:20-alpine

# Prisma + OpenSSL (Alpine)
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev

COPY . .
RUN npx prisma generate

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "src/server.js"]
