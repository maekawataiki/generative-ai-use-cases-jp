# Use Node.js LTS version
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy all files needed for install
COPY package.json package-lock.json ./
COPY packages/ ./packages/

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port for Vite dev server
EXPOSE 5173

# Start the web development server
CMD ["npm", "run", "web:dev"]
