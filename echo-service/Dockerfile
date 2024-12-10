# Stage 1: Build the application using a full Node.js image with build tools
FROM node:22-alpine AS builder

# Set the working directory
WORKDIR /app

# Install build dependencies (needed for Alpine)
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++

# Copy package.json and package-lock.json to install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the TypeScript code
RUN npm run build

# Stage 2: Create a minimal final image with only the necessary files
FROM node:22-alpine

# Set the working directory
WORKDIR /app

# Copy only the built files from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Use a startup script to run both servers
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Install only production dependencies
RUN npm install --production

# Expose the application port
EXPOSE 8080

# Expose the websocket port
EXPOSE 8888

# Expose tcp port
EXPOSE 3001
EXPOSE 3002

# Run the application
CMD ["/app/start.sh"]