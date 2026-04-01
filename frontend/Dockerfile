FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci

COPY . .

RUN npm run build

EXPOSE 5173

ENV VITE_API_BASE_URL=http://backend:8000 \
    VITE_WS_URL=ws://backend:8000/ws

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
