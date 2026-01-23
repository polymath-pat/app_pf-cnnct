# Build Stage
FROM node:20-slim AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Production Stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Add a small nginx config to proxy /api to the backend container
RUN echo 'server { \
    listen 80; \
    location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; } \
    location /api/ { proxy_pass http://backend:8080; } \
}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
