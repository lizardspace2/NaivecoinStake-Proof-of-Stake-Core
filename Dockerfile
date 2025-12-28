FROM node:18-alpine

WORKDIR /app

# Install dependencies for native modules (if any, though Dilithium-crystals-js is WASM/JS)
# python3, make, and g++ are good to have for node-gyp just in case
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install

COPY . .

# Compile TypeScript
RUN npm run compile

EXPOSE 3001
EXPOSE 6001

CMD ["npm", "start"]
