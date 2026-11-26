FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

# Os scripts SQL e a pasta de uploads vêm por volume (ver docker-compose.yml)
ENV DB_SQL_DIR=/app/database
ENV UPLOADS_DIR=/app/uploads

EXPOSE 3000
CMD ["node", "src/index.js"]
