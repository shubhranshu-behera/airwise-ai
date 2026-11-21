# Use official Node.js LTS image
FROM node:22-alpine

WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Build Vite frontend for production
RUN npm run build

# Expose server port (default 3000 or process.env.PORT)
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Start Express + Vite production server
CMD ["npm", "start"]
