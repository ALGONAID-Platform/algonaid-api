FROM node:20-alpine AS development

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

# Run generate and then start the dev server
CMD npx prisma generate && npm run start:dev
