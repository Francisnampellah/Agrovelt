# syntax=docker/dockerfile:1
FROM node:20

WORKDIR /usr/src/app

# Show download progress; skip audit/fund noise during image build
ENV NPM_CONFIG_PROGRESS=true
ENV NPM_CONFIG_LOGLEVEL=warn

COPY package.json package-lock.json ./

# Cache npm downloads between builds; use lockfile for reproducible installs
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

COPY prisma ./prisma/

# Pre-generate Prisma client during build (avoids silent work at container start)
RUN npx prisma generate

COPY . .

EXPOSE 4000

CMD ["sh", "-c", "npx prisma generate && npx ts-node src/index.ts"]
