# 商品管理系统 Docker 部署文档

## 目录

- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [服务架构](#服务架构)
- [水平扩展](#水平扩展)
- [数据库切换](#数据库切换)
- [常用管理命令](#常用管理命令)
- [生产部署建议](#生产部署建议)
- [故障排查](#故障排查)

## 环境要求

- Docker >= 20.10
- Docker Compose >= v2.0
- 至少 2GB 可用内存
- 至少 5GB 可用磁盘空间

## 快速开始

### 1. 一键部署（默认配置）

```bash
# 复制环境变量配置文件
cp .env.example .env

# 构建并启动所有服务（使用 SQLite + Redis）
docker compose up -d --build
```

部署完成后访问：
- 前端应用：http://localhost
- 后端 API：http://localhost/api
- 健康检查：http://localhost/health
- 后端健康检查：http://localhost/api/health

### 2. 使用 PostgreSQL 部署

```bash
# 修改 .env 文件，设置 DB_TYPE=postgres
# 然后使用 --profile postgres 启动
docker compose --profile postgres up -d --build
```

## 配置说明

### 环境变量配置

复制 `.env.example` 为 `.env` 并根据需要修改：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `COMPOSE_PROJECT_NAME` | Docker Compose 项目名 | `product-management` |
| `NODE_ENV` | Node.js 运行环境 | `production` |
| `BACKEND_PORT` | 后端服务端口 | `3005` |
| `FRONTEND_PORT` | 前端开发端口（生产用 NGINX_PORT） | `5185` |
| `NGINX_PORT` | Nginx 对外端口 | `80` |
| `JWT_SECRET` | JWT 签名密钥（**生产环境必须修改**） | `your-secret-key-...` |
| `JWT_EXPIRES_IN` | JWT 过期时间 | `7d` |
| `CORS_ORIGIN` | 允许的 CORS 源 | `*` |
| `DB_TYPE` | 数据库类型：`sqlite` 或 `postgres` | `sqlite` |
| `DB_SQLITE_PATH` | SQLite 数据库文件路径 | `/app/data/products.db` |
| `DB_HOST` | PostgreSQL 主机 | `postgres` |
| `DB_PORT` | PostgreSQL 端口 | `5432` |
| `DB_USER` | PostgreSQL 用户名 | `postgres` |
| `DB_PASSWORD` | PostgreSQL 密码（**生产环境必须修改**） | `change_this_password` |
| `DB_NAME` | PostgreSQL 数据库名 | `product_management` |
| `USE_REDIS` | 是否启用 Redis 缓存 | `true` |
| `REDIS_HOST` | Redis 主机 | `redis` |
| `REDIS_PORT` | Redis 端口 | `6379` |
| `REDIS_PASSWORD` | Redis 密码（可选） | 空 |
| `REDIS_DB` | Redis 数据库编号 | `0` |
| `BACKEND_REPLICAS` | 后端服务副本数 | `1` |
| `VITE_API_BASE_URL` | 前端 API 基础路径 | `/api` |

## 服务架构

```
                    ┌──────────────────┐
                    │   用户浏览器      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Nginx (前端+网关)│  ◄── 端口 80
                    │  - 静态文件服务   │
                    │  - API 反向代理   │
                    │  - 负载均衡       │
                    └────────┬─────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
  │   后端 API #1  │ │   后端 API #2  │ │   后端 API #N  │
  │  (可水平扩展)  │ │  (可水平扩展)  │ │  (可水平扩展)  │
  └───────┬────────┘ └───────┬────────┘ └───────┬────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                    ┌────────┴─────────┐
                    │                  │
                    ▼                  ▼
            ┌──────────────┐  ┌──────────────┐
            │    Redis     │  │   SQLite 或  │
            │   (缓存)     │  │  PostgreSQL  │
            └──────────────┘  └──────────────┘
```

### 服务列表

| 服务名 | 镜像 | 端口 | 说明 |
|--------|------|------|------|
| `frontend` | 自定义 (`product-management-frontend`) | `80` | Nginx 服务前端静态文件 + API 网关 + 负载均衡 |
| `backend` | 自定义 (`product-management-backend`) | `3005`（内部） | Node.js Koa 后端 API，支持多副本 |
| `redis` | `redis:7-alpine` | `6379` | Redis 缓存服务（启用 AOF 持久化） |
| `postgres` | `postgres:16-alpine` | `5432` | PostgreSQL 数据库（可选，使用 profile 启用） |

## 水平扩展

### 扩展后端服务

```bash
# 扩展到 3 个后端副本
docker compose up -d --scale backend=3

# 或者通过环境变量 BACKEND_REPLICAS 在 .env 中设置后重启
docker compose up -d
```

Nginx 会自动通过 Docker DNS 发现新的后端实例，并使用 `least_conn`（最少连接数）策略进行负载均衡。

### 缩减后端服务

```bash
# 缩减到 1 个后端副本
docker compose up -d --scale backend=1
```

## 数据库切换

### 默认：SQLite

默认使用 SQLite，数据库文件存储在 Docker volume `backend-data` 中。适合中小规模应用。

### 切换到 PostgreSQL

1. 修改 `.env` 文件：

```env
DB_TYPE=postgres
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_NAME=product_management
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=product_management
```

2. 使用 profile 启动 PostgreSQL 服务：

```bash
docker compose --profile postgres up -d --build
```

> **注意**：从 SQLite 迁移到 PostgreSQL 需要手动迁移数据，本项目当前默认使用 SQLite。

## 常用管理命令

### 服务生命周期

```bash
# 启动所有服务
docker compose up -d

# 构建并启动
docker compose up -d --build

# 停止所有服务
docker compose stop

# 停止并删除容器
docker compose down

# 停止并删除容器、网络、数据卷（⚠️ 会删除所有数据）
docker compose down -v

# 重启所有服务
docker compose restart

# 重启单个服务
docker compose restart backend
```

### 查看状态和日志

```bash
# 查看服务状态
docker compose ps

# 查看所有服务日志（实时）
docker compose logs -f

# 查看后端服务日志
docker compose logs -f backend

# 查看前端服务日志
docker compose logs -f frontend

# 查看最近 100 行日志
docker compose logs --tail=100 backend
```

### 进入容器

```bash
# 进入后端容器
docker compose exec backend sh

# 进入前端 Nginx 容器
docker compose exec frontend sh

# 进入 Redis CLI
docker compose exec redis redis-cli

# 如果 Redis 设置了密码
docker compose exec redis redis-cli -a your_password

# 进入 PostgreSQL CLI
docker compose exec postgres psql -U postgres -d product_management
```

### 备份和恢复

#### Redis 备份

```bash
# 手动触发 Redis BGSAVE
docker compose exec redis redis-cli BGSAVE

# 复制备份文件到本地
docker compose cp redis:/data/dump.rdb ./redis-backup.rdb
```

#### SQLite 备份

```bash
# 复制 SQLite 数据库文件到本地
docker compose cp backend:/app/data/products.db ./backup.db
```

#### PostgreSQL 备份

```bash
# 导出数据库到 SQL 文件
docker compose exec postgres pg_dump -U postgres product_management > backup.sql

# 从 SQL 文件恢复
docker compose exec -T postgres psql -U postgres product_management < backup.sql
```

### 更新部署

```bash
# 拉取最新代码后重新构建部署
git pull
docker compose up -d --build --force-recreate
```

## 生产部署建议

### 1. 安全配置

修改 `.env` 中的以下敏感配置：

```env
# 使用强密码
JWT_SECRET=your-very-long-random-secret-key-at-least-32-chars
DB_PASSWORD=your-strong-db-password
REDIS_PASSWORD=your-strong-redis-password

# 限制 CORS 源（不要使用 *）
CORS_ORIGIN=https://your-domain.com
```

### 2. 使用 HTTPS

建议在 Nginx 前增加反向代理（如 Traefik、Caddy 或云负载均衡器）处理 HTTPS 终止，或修改 `nginx/gateway.conf` 添加 SSL 配置。

使用 Let's Encrypt + Nginx 示例：

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # ... 其他配置
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

### 3. 资源限制

在 `docker-compose.yml` 中为服务添加资源限制：

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 1G
      reservations:
        cpus: '0.5'
        memory: 256M
```

### 4. 日志管理

配置 Docker 日志驱动防止日志文件过大：

```yaml
x-logging: &default-logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"

services:
  backend:
    logging: *default-logging
```

### 5. 监控

- 健康检查已内置，可通过 `/health` 和 `/api/health` 检查
- 建议集成 Prometheus + Grafana 或使用云服务商监控方案

### 6. 多节点部署

如需多节点部署，建议：
- 使用 Docker Swarm 或 Kubernetes 编排
- 将数据库和 Redis 迁移到托管服务（如 AWS RDS、ElastiCache）
- 使用共享存储或 CDN 存放静态资源

## 故障排查

### 服务无法启动

```bash
# 查看具体错误日志
docker compose logs backend --tail=200
```

### 前端无法连接后端 API

1. 检查后端健康检查：
```bash
curl http://localhost/api/health
```

2. 检查后端服务是否运行：
```bash
docker compose ps backend
```

3. 查看 Nginx 日志：
```bash
docker compose logs frontend --tail=50
```

### Redis 连接失败

```bash
# 检查 Redis 状态
docker compose ps redis
docker compose logs redis

# 测试 Redis 连接
docker compose exec redis redis-cli ping
```

### 数据库文件权限问题

如果使用 SQLite 遇到权限问题：

```bash
# 查看 volume 位置
docker volume inspect product-management_backend-data

# 或重新初始化数据（⚠️ 会删除数据）
docker compose down -v
docker compose up -d
```

### 端口冲突

修改 `.env` 中的端口配置：
- `NGINX_PORT` - Nginx 对外端口
- 或者修改 `docker-compose.yml` 中的端口映射

### 清除所有数据重新开始

```bash
docker compose down -v
docker compose up -d --build
```

## 演示账号

系统启动后默认创建以下演示账号（密码均为 `123456`）：
- 用户名：`张三`，邮箱：`zhangsan@example.com`
- 用户名：`李四`，邮箱：`lisi@example.com`
- 用户名：`王五`，邮箱：`wangwu@example.com`
