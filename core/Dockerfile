FROM node:20-alpine

WORKDIR /app

# Dependências do sistema para o core, rede e compatibilidade OpenSSL com Prisma
RUN apk add --no-cache curl python3 py3-pip bash iputils openssl libc6-compat

COPY package*.json ./
COPY prisma ./prisma

RUN npm install
RUN npx prisma generate

COPY . .

EXPOSE 3000

# Executa sincronização do schema Prisma automaticamente e sobe o serviço
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node src/server.js"]
