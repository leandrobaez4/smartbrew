FROM node:22-alpine

WORKDIR /app

# Install OS dependencies for Remotion and FFmpeg
RUN apk add --no-cache \
    ffmpeg \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    git

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy rest of the application
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the Next.js app
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
