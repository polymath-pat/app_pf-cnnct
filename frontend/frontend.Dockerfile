# Stage 1: Build the Modern UI
FROM node:20-slim AS build
WORKDIR /app

# Since docker-compose.yaml sets the context to ./frontend, 
# we copy directly from that folder
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# CRITICAL FIX: Copy from the 'build' stage defined above
COPY --from=build /app/dist /usr/share/nginx/html

# Copy the custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]