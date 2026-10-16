# TAKATAK V1 direct production deployment on Coolify (takatak.ca).
# Full Next.js webpack output + Prisma dependencies; do not use standalone.
# No migrations, cron jobs, Redis workers, or DNS mutations in this image.
FROM node:22.23.2-bookworm-slim AS build

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_IGNORE_SCRIPTS=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts=false

COPY . .

# The repository .dockerignore excludes all .env files except .env.example.
# NEXT_PUBLIC values are compiled into the browser bundle; do not use secrets.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_UPMIND_ORDER_CONFIG_URL
ARG NEXT_PUBLIC_UPMIND_WIDGET_SCRIPT_URL
ARG NEXT_PUBLIC_UPMIND_DAC_SCRIPT_URL
ARG NEXT_PUBLIC_UPMIND_BRAND_ID
ARG NEXT_PUBLIC_UPMIND_ACCOUNT_ID
ARG NEXT_PUBLIC_UPMIND_CURRENCY
ARG NEXT_PUBLIC_UPMIND_DOMAIN_SEARCH_MODE
ARG NEXT_PUBLIC_TIDIO_PUBLIC_KEY
ARG NEXT_PUBLIC_CRISP_WEBSITE_ID
ARG NEXT_PUBLIC_INTERCOM_APP_ID
ARG NEXT_PUBLIC_HUBSPOT_PORTAL_ID
ARG NEXT_PUBLIC_LIVE_CHAT_PROVIDER

ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    NEXT_PUBLIC_UPMIND_ORDER_CONFIG_URL=${NEXT_PUBLIC_UPMIND_ORDER_CONFIG_URL} \
    NEXT_PUBLIC_UPMIND_WIDGET_SCRIPT_URL=${NEXT_PUBLIC_UPMIND_WIDGET_SCRIPT_URL} \
    NEXT_PUBLIC_UPMIND_DAC_SCRIPT_URL=${NEXT_PUBLIC_UPMIND_DAC_SCRIPT_URL} \
    NEXT_PUBLIC_UPMIND_BRAND_ID=${NEXT_PUBLIC_UPMIND_BRAND_ID} \
    NEXT_PUBLIC_UPMIND_ACCOUNT_ID=${NEXT_PUBLIC_UPMIND_ACCOUNT_ID} \
    NEXT_PUBLIC_UPMIND_CURRENCY=${NEXT_PUBLIC_UPMIND_CURRENCY} \
    NEXT_PUBLIC_UPMIND_DOMAIN_SEARCH_MODE=${NEXT_PUBLIC_UPMIND_DOMAIN_SEARCH_MODE} \
    NEXT_PUBLIC_TIDIO_PUBLIC_KEY=${NEXT_PUBLIC_TIDIO_PUBLIC_KEY} \
    NEXT_PUBLIC_CRISP_WEBSITE_ID=${NEXT_PUBLIC_CRISP_WEBSITE_ID} \
    NEXT_PUBLIC_INTERCOM_APP_ID=${NEXT_PUBLIC_INTERCOM_APP_ID} \
    NEXT_PUBLIC_HUBSPOT_PORTAL_ID=${NEXT_PUBLIC_HUBSPOT_PORTAL_ID} \
    NEXT_PUBLIC_LIVE_CHAT_PROVIDER=${NEXT_PUBLIC_LIVE_CHAT_PROVIDER}

RUN test -n "$NEXT_PUBLIC_APP_URL" \
 && test -n "$NEXT_PUBLIC_SUPABASE_URL" \
 && test -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
 && npm run db:generate \
 && npm run build

FROM node:22.23.2-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /app /app
RUN chown -R node:node /app
USER node
EXPOSE 3000

# Fail closed if DB/auth are not configured (unlike public /api/health).
HEALTHCHECK --interval=30s --timeout=8s --start-period=90s --retries=3 \
  CMD ["node", "scripts/container-healthcheck.cjs"]

CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
