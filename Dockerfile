FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN chown -R node:node /app
USER node

ENV NODE_ENV=production

# Do not set PORT here — Railway (and Cloud Run) inject process.env.PORT at runtime.
CMD ["node", "server.js"]
