# Interface web Sanjeevani : build Angular, puis nginx (sans privilèges) qui sert l'application et relaie /api vers l'API (même origine : cookies SameSite=Strict, pas de CORS).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY angular.json tsconfig.json tsconfig.app.json components.json .postcssrc.json ./
COPY public ./public
COPY src ./src
RUN npx ng build \
 # Garde-fou : sans .postcssrc.json Tailwind ne tourne pas et le build « réussit » avec une interface sans style.
 && grep -q "display:flex" dist/sanjeevani-web/browser/styles-*.css || (echo "ERREUR : les styles Tailwind sont absents du build (.postcssrc.json copié ?)" && exit 1)

FROM nginxinc/nginx-unprivileged:1.28-alpine
# Les gabarits de /etc/nginx/templates sont rendus au démarrage avec les variables d'environnement (API_UPSTREAM).
ENV API_UPSTREAM=api:3000
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/sanjeevani-web/browser /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
