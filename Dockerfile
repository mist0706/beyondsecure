# BeyondSecure Website

FROM nginx:alpine

# Copy static files
COPY . /usr/share/nginx/html/

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]