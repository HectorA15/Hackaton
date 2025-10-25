FROM node:18-alpine

WORKDIR /app

# Copiar package.json y package-lock.json primero para caché de dependencias
COPY package*.json ./

RUN npm install

# Copiar el resto del proyecto
COPY . .

EXPOSE 3000

# En producción ejecutar la app; para desarrollo usar docker-compose con nodemon
CMD ["node", "src/server.js"]