# MyKBS KBS Backend — Supabase + Polis/Jandarma KBS
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
# Prisma optional (bu projede Supabase kullanılıyor; eski Prisma route'ları kalsın)
RUN npx prisma generate 2>/dev/null || true

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "src/server.js"]
