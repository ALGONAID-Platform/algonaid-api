FROM node:22-alpine AS development

WORKDIR /usr/src/app

COPY package*.json ./

# نسخ مجلد بريسما هنا يحمي الـ npm install من الفشل
COPY prisma ./prisma/

RUN npm install

COPY . .

# عند تشغيل الحاوية سيقوم بالتأكد من الـ generate ثم تشغيل سيرفر التطوير
CMD npx prisma generate && npm run start:dev