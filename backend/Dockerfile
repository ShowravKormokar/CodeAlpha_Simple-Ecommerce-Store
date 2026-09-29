# Backend image for Simple E-commerce Store.
#
# Build context is ./backend, so package.json, src/, scripts/ and database/ are
# all inside the context.
#
# Node 20 is the current LTS line and is what the application is developed against;
# the dependency set (Express 4, pg 8, jsonwebtoken 9) is fully supported on it.

FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies from the committed lockfile, before copying the
# source, so the dependency layer is cached until package*.json actually changes.
# Jest, nodemon and supertest are devDependencies and are not needed at runtime.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Source code, plus the base-schema, migration and seed SQL that `npm run db:setup`
# needs to initialise a fresh database.
COPY . .

EXPOSE 5000

# The app only reads its own source files, so it does not need to run as root.
USER node

# The healthcheck is declared in docker-compose.yml so every service keeps its
# check next to the rest of its configuration.
CMD ["node", "src/server.js"]
