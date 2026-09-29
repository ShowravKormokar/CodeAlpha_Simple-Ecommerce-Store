# Frontend image for Simple E-commerce Store.
#
# The frontend is plain HTML + CSS + vanilla JavaScript with no build step, so the
# image only needs a static web server. There is deliberately no bundler, no
# node_modules and no package.json here.

FROM nginx:stable-alpine

# Replaces the image's default server block. Installing it under conf.d keeps the
# stock /etc/nginx/nginx.conf (and its mime types, gzip defaults, etc.) intact.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static site files. .dockerignore keeps local-only files out of this copy.
COPY . /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
