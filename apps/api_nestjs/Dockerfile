FROM node:22-bookworm-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api_nestjs/package.json apps/api_nestjs/package.json
COPY apps/web_nextjs/package.json apps/web_nextjs/package.json
COPY packages/api_contracts_openapi/package.json packages/api_contracts_openapi/package.json
COPY packages/shared_ts/package.json packages/shared_ts/package.json

RUN pnpm install --frozen-lockfile --reporter=silent

COPY . .

RUN pnpm --filter @studioos/apps-api_nestjs prisma:generate

RUN pnpm --filter @studioos/apps-api_nestjs build

FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /workspace

COPY --from=build /workspace /workspace

RUN groupadd --gid 1001 studio \
  && useradd --uid 1001 --gid 1001 --create-home studio \
  && chown -R studio:studio /workspace

USER studio

EXPOSE 3000

CMD ["pnpm", "--filter", "@studioos/apps-api_nestjs", "start"]
