FROM node:20-alpine
WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm install --omit=dev

# 复制源码（排除 node_modules、备份脚本等）
COPY server.js ./

EXPOSE 5000
CMD ["node", "server.js"]
