# Use imagem Node.js oficial
FROM node:20-alpine

# Define diretório de trabalho
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Instala dependências
RUN npm install

# Copia o resto do código
COPY . .

# Expõe a porta
EXPOSE 3001

# Comando para rodar o servidor
CMD ["npm", "start"]