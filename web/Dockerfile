# 집별 web (Vite PWA) — pnpm 빌드 후 nginx 정적 서빙.
# VITE_* 는 빌드 타임에 번들에 박힌다. API_BASE_URL은 빈 값(상대경로)으로 두어
# nginx가 /v1 을 api 컨테이너로 프록시하게 한다 → 같은 origin, CORS 불필요.
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .

# 공개 설정(클라이언트 노출 안전). 미지정 시 푸시만 비활성, 나머지 정상.
ARG VITE_VAPID_PUBLIC_KEY=""
ARG VITE_FIREBASE_API_KEY=""
ARG VITE_FIREBASE_PROJECT_ID="zipbyul"
ARG VITE_FIREBASE_MESSAGING_SENDER_ID=""
ARG VITE_FIREBASE_APP_ID=""
ENV VITE_API_BASE_URL="" \
    VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY \
    VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
RUN pnpm build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
