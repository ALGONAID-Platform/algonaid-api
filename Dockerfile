FROM node:22-alpine AS development

WORKDIR /usr/src/app

COPY package*.json ./

# نسخ مجلد بريسما هنا يحمي الـ npm install من الفشل
COPY prisma ./prisma/

RUN npm install

COPY . .

# عند تشغيل الحاوية: تطبيق الـ Migrations أولاً ثم تشغيل السيرفر
CMD npx prisma migrate deploy && npx prisma generate && npm run start:dev