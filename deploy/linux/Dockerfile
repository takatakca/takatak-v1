FROM node:22.23.2-bookworm

WORKDIR /src

ENV NEXT_TELEMETRY_DISABLED=1
ENV NPM_CONFIG_IGNORE_SCRIPTS=false
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY . .

RUN node --version \
  && npm ci \
  && npm run db:generate \
  && npm run typecheck \
  && npm run lint \
  && npm run test:auth \
  && npm run test:identity \
  && NODE_ENV=production npm run build \
  && npm run check:modules \
  && node scripts/pack-production-artifact.cjs

CMD ["bash", "-lc", "ls -la var/artifacts"]
