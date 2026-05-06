FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
COPY . .

EXPOSE 4000

CMD ["sh", "-c", "npx prisma generate && npx ts-node src/index.ts"]