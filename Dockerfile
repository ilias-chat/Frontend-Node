FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN chown -R node:node /app
USER node

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Pass MONGO_URI (and other secrets) at run time, e.g.:
#   docker run --rm -p 3000:3000 -e MONGO_URI="mongodb+srv://..." trwm-backend
CMD ["node", "server.js"]
