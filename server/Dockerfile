FROM node:20-alpine
WORKDIR /app

# 安装 better-sqlite3 编译依赖
RUN apk add --no-cache python3 make g++

# 安装应用依赖
COPY package*.json ./
RUN npm install --omit=dev

# 复制源码
COPY server.js db.js ./

EXPOSE 5000
CMD ["node", "server.js"]
