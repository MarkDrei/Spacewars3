# Use the official Node.js 18 image as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Create database directory
RUN mkdir -p database

# Expose the port that Next.js runs on
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV SESSION_SECRET=your-secret-key-must-be-at-least-32-characters-long-for-docker

# Build the Next.js application
RUN npm run build

# Start the application
CMD ["npm", "start"]