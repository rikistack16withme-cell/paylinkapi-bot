FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
  wget \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install \
  && npx playwright install-deps chrome

RUN wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
  && apt-get update \
  && apt-get install -y /tmp/chrome.deb \
  && rm -f /tmp/chrome.deb

COPY server.js ./

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
