# Xread

**_[English](./README.md)_**

**你的 LLM 值得更好的输入。**

将杂乱网页转成干净的 Markdown，为 LLM 提供网页搜索能力，并将整套服务自行托管。

Xread 是一个面向 LLM 工作流的开源、自托管网页摄取服务，提供三个主要入口：

- `crawl`：抓取 URL 并转换为可读的 Markdown
- `search`：执行搜索并返回便于直接粘贴进提示词的文本结果
- `serp`：执行搜索并返回结构化 JSON

它是公开 [Jina AI Reader](https://jina.ai/reader) 存储库 [jina-ai/reader](https://github.com/jina-ai/reader) 的一个独立分叉版本，移除了原始内部 `thinapps-shared` 依赖，并适配为自托管使用。

## 该存储库额外增加了什么

- 围绕上游 Reader 存储库完成自托管封装
- 本地优先的存储与缓存持久化
- 发布到 GHCR 的 OCI 镜像
- 面向 Docker、Podman 和 `nerdctl` 的统一镜像、Compose 栈与环境变量部署资产
- 已接好的 CI、CodeQL、依赖治理与容器发布流程

## 快速预览

下面这些示例直接使用已发布镜像的 HTTP/1 端口（`8081`）。部署文档会进一步说明 Compose 后端 loopback 端口（`3001`、`3101`、`3201`）以及公网反向代理域名入口。

### 抓取网页

```bash
curl "http://127.0.0.1:8081/http://example.com"
```

### 以文本形式搜索网页

```bash
curl "http://127.0.0.1:8081/search?q=example%20domain&num=5&provider=google"
```

### 以 JSON 形式搜索网页

```bash
curl "http://127.0.0.1:8081/?q=example%20domain&num=5&provider=google"
```

## 快速开始

### 本地运行

```bash
npm ci
npm run build
npm start
```

上面会启动 `crawl` 服务。独立入口包括：

- `build/stand-alone/crawl.js`
- `build/stand-alone/search.js`
- `build/stand-alone/serp.js`

### 使用容器引擎运行

```bash
docker run --rm -p 8081:8081 ghcr.io/xixu-me/xread:latest
```

已发布镜像默认启动 `crawl`。任何兼容 OCI 的容器引擎都可以运行它。下面示例使用 Docker 语法；如果要运行其他入口：

```bash
docker run --rm -p 8081:8081 --entrypoint node ghcr.io/xixu-me/xread:latest build/stand-alone/search.js
docker run --rm -p 8081:8081 --entrypoint node ghcr.io/xixu-me/xread:latest build/stand-alone/serp.js
```

## 为自托管而构建

- 镜像内已包含用于页面渲染的 Chrome
- 内部支持 HTTP/2 cleartext（`h2c`）
- 在 `PORT + 1` 上提供 HTTP/1 回退端口
- 即使没有付费搜索提供方，`search` 和 `serp` 也仍可通过独立回退路径工作

已发布镜像：

- `ghcr.io/xixu-me/xread:latest`

用于生产环境时，建议固定镜像 digest，而不是持续跟随 `latest`。

## 部署

存储库内已经提供完整的反向代理部署示例：

- [部署指南](./docs/deploy.md)
- [容器引擎指南](./docs/container-engines.md)
- [Compose 栈](./deploy/docker-compose.yml)
- [`Caddyfile`](./deploy/Caddyfile)
- [环境模板](./deploy/.env.example)

部署文档在 Docker、Podman 和 `nerdctl`/containerd 下使用同一镜像、同一 Compose 栈和同一套环境变量。

文档中使用的部署拓扑是：

- `r.your-domain.example` -> `crawl`
- `s.your-domain.example/search` -> `search`
- `s.your-domain.example/?q=...` -> `serp`

## 配置

standalone 构建通过环境变量读取配置。

[`deploy/.env.example`](./deploy/.env.example) 中的部署模板包含了共享部署变量。完整的运行时配置面如下：

| 变量                              | 用途                                                |
| --------------------------------- | --------------------------------------------------- |
| `PORT`                            | 主服务端口。HTTP/1 回退端口监听在 `PORT + 1`。      |
| `PUBLIC_HTTP_PORT`                | Compose 部署中由反向代理暴露的公网 HTTP 端口。      |
| `PUBLIC_HTTPS_PORT`               | Compose 部署中由反向代理暴露的公网 HTTPS 端口。     |
| `XREAD_LOOPBACK_HOST`             | Compose 部署中后端 loopback 端口所绑定的宿主机 IP。 |
| `XREAD_CRAWL_LOOPBACK_PORT`       | `crawl` 后端对应的宿主机 loopback 端口。            |
| `XREAD_SEARCH_LOOPBACK_PORT`      | `search` 后端对应的宿主机 loopback 端口。           |
| `XREAD_SERP_LOOPBACK_PORT`        | `serp` 后端对应的宿主机 loopback 端口。             |
| `STORAGE_ROOT`                    | 快照和生成资产等存储内容的根目录。                  |
| `LOCAL_DB_ROOT`                   | 本地元数据、缓存和轻量持久化的根目录。              |
| `SERPER_SEARCH_API_KEY`           | 启用基于 Serper 的 Google/Bing 搜索。               |
| `BRAVE_SEARCH_API_KEY`            | 在支持的场景下启用 Brave Search 集成。              |
| `CLOUD_FLARE_API_KEY`             | 在已配置能力下启用 Cloudflare 相关集成。            |
| `LOCAL_PROXY_URLS`                | 可选的出站代理池。                                  |
| `OVERRIDE_CHROME_EXECUTABLE_PATH` | Chrome 可执行文件路径的可选覆盖值。                 |

抓取相关的常用请求控制头包括：

- `x-no-cache`
- `x-target-selector`
- `x-wait-for-selector`
- `x-respond-with`
- `x-timeout`

## 构建与验证

```bash
npm run lint
npm run security:audit
npm run test:ci
npm run build
```

镜像构建流程还会对三个 standalone 服务做启动演练。

## 存储库结构

```text
src/api/           RPC 主机与对外 HTTP 方法
src/stand-alone/   standalone 服务入口
src/services/      抓取、格式化、搜索与运行时服务
src/shared/        存储、限流与配置等本地共享基础设施
public/            静态资源
deploy/            可直接使用的生产部署模板
docs/              运维文档
scripts/           构建、许可证与安全辅助脚本
tests/             构建、运行时与自动化回归测试
```
