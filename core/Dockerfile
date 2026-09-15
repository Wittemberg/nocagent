FROM node:20-alpine

WORKDIR /app

# Dependências do sistema para o core, rede, timezone Brasil, compatibilidade OpenSSL com Prisma e conversão de vídeo DAV→MP4
RUN apk add --no-cache curl python3 py3-pip bash iputils openssl libc6-compat tzdata ffmpeg
ENV TZ="America/Sao_Paulo"

COPY package*.json ./
COPY prisma ./prisma

RUN npm install
RUN npx prisma generate

COPY . .

EXPOSE 3000

# Executa sincronização do schema Prisma automaticamente (com retry) e sobe o serviço
CMD ["sh", "-c", "until npx prisma db push --accept-data-loss; do echo 'Aguardando banco de dados...'; sleep 3; done && node src/server.js"]
