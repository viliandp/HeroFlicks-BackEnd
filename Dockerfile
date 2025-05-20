FROM node:lts-alpine

ENV NODE_ENV=production

WORKDIR /usr/src/app

# Copia solo los archivos necesarios para instalar dependencias
COPY package.json package-lock.json* ./

# Instala solo dependencias de producción
RUN npm install --production --silent

# Copia el resto del código de la aplicación
COPY . .

# Expón el puerto correcto en el que la app escucha (probablemente 3000)
EXPOSE 3000

# Ejecuta como usuario no-root por seguridad
# 'node' es un usuario que ya existe en la imagen base 'node:lts-alpine'
# Asegúrate de que el usuario node tenga permisos sobre node_modules también
RUN chown -R node:node /usr/src/app
USER node

# Comando para iniciar la app usando el script 'start' del package.json
CMD ["npm", "start"]