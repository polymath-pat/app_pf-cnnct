# frontend/Dockerfile
FROM nginx:alpine

# Copy the custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# The 'make build-frontend' command generates the dist folder on the host
# This COPY is used when the container is built for production/CI
COPY dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]