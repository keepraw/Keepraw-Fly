# 部署指南 — v0.1.0

[English](deployment.md) · [正式发行](https://github.com/keepraw/Keepraw-Fly/releases/tag/v0.1.0)

## 在线使用

打开 **<https://fly.keepraw.com>** 即可使用，无需安装。这是**开发者提供的 Demo**；可选择演示模式查看虚构航班，或创建自己的档案。

所有航班记录保存在当前浏览器的 **IndexedDB** 中。没有服务器账号，也没有自动云同步。不同域名、浏览器和设备的数据相互独立。请定期在**设置 → 数据与备份**导出 JSON，并在**迁移或升级前**导出，在目标站点导入。部署静态新版本不会主动清除航班档案。更新 Docker 容器不等于备份或迁移个人数据；VPS 仅提供网页文件。

公开实例请使用 HTTPS。浏览器存储与持久存储权限受浏览器策略及安全上下文影响。`http://localhost` 可用于本地测试，不建议通过公网明文 HTTP 部署。

## GitHub Pages：无需编译

1. Fork [keepraw/Keepraw-Fly](https://github.com/keepraw/Keepraw-Fly)。
2. 打开 Fork 的 **Actions**；如出现提示，点击 **I understand my workflows, go ahead and enable them** 启用工作流。
3. 在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。如果限制了部署分支，还需在 `github-pages` environment 中允许默认分支。
4. 打开 **Actions → Deploy official release to Fork Pages → Run workflow**，选择默认分支，将 `version` 保持为 **v0.1.0**。普通项目站点的 `custom_domain` 留空。
5. 成功后，打开 `github-pages` 部署中显示的地址，即你的 GitHub 用户名加 `.github.io/Keepraw-Fly/`。保留末尾斜杠。

工作流下载官方预构建 tar.gz 和 `SHA256SUMS`，校验压缩包及内部文件清单后部署，并检查实际 Release 作者为 `keepraw`。它**不会**安装 Node.js/pnpm、编译源码或运行 E2E。Fork 会跳过继承的官方完整 CI 作业。部署需手动触发；上游发布新版本时不会自动升级。升级或回滚时，重新运行并明确填写你选择的官方稳定版本。

**这种模式不会运行 Fork 修改的源码**，始终部署官方发行版。需要修改应用的开发者可按下方开发章节构建 Fork，在自己维护的工作流中上传 `apps/web/dist/`。源码构建需要在 Fork 中主动恢复验证，不会影响官方 CI。

自定义域名需先配置 DNS，在 **Settings → Pages → Custom domain** 设置域名并启用 **Enforce HTTPS**，再将相同主机名填入工作流 `custom_domain`；不要填写协议或路径。不会继承官方 `CNAME`。Vite 相对资源路径和 Hash 路由支持项目子目录及域名根路径，无需 rewrite。官方 `fly.keepraw.com` 设置保持不变。Fork 工作流拒绝在官方仓库执行，官方 main 部署仍需通过完整 CI。

## VPS：Docker 与自动 HTTPS

前提：Linux **amd64 或 arm64**、Bash、curl、sha256sum、`ss`（iproute2）、realpath、flock，以及 Docker Engine 和**支持 `up --wait` 的 Compose v2 插件**。按 [Docker 官方 Linux 安装说明](https://docs.docker.com/engine/install/)安装。安装器不安装系统软件，不修改其他网站的 Nginx/Caddy/Docker 配置。请使用有 Docker 权限的账号；Docker 访问权限实质上具有管理员能力。

公网 HTTPS：先将域名 A 记录指向 VPS；仅在 IPv6 确实可用时设置 AAAA。防火墙和服务商安全组应放行入站 **TCP 80、443**。单个 Caddy 容器负责网页服务及证书申请、续期。DNS 生效和证书签发可能需要等待。

下载固定版本安装器，校验、检查后执行。以下命令不会自动执行远程 root 脚本：

```bash
mkdir -p keepraw-fly-installer
cd keepraw-fly-installer
curl -fL --proto '=https' --proto-redir '=https' -o install.sh https://github.com/keepraw/Keepraw-Fly/releases/download/v0.1.0/install.sh
curl -fL --proto '=https' --proto-redir '=https' -o SHA256SUMS https://github.com/keepraw/Keepraw-Fly/releases/download/v0.1.0/SHA256SUMS
awk '$2 == "./install.sh" || $2 == "install.sh" {print}' SHA256SUMS > installer.sha256
test "$(wc -l < installer.sha256)" -eq 1
sha256sum -c installer.sha256
less install.sh
read -r -p '你的域名主机名：' KEEPRAW_DOMAIN
sudo bash install.sh --version v0.1.0 --domain "$KEEPRAW_DOMAIN"
```

安装器会展示具体文件及资源计划并询问是否执行；无人值守时可加 `--yes` 接受计划。它写入 `/opt/keepraw-fly/compose.yaml`、`.env`、`.keepraw-managed`，仅创建 Compose 项目 `keepraw-fly`、web 容器、网络及 Caddy 证书和配置卷，卷中没有航班档案。它从指定发行版下载并校验 Compose 和镜像 digest 附件，将容器锁定到 digest。执行前检查架构、Docker 权限、端口和目录归属；拒绝接管非托管目录、其他位置的同名项目及被手动改动的托管文件。下载或拉取失败不改变现有部署，启动失败会恢复原有配置。旧配置保存在 `history/`。

打开输出的 **https://** 地址，检查浏览器证书状态。容器健康只表示 Caddy 正在运行，不代表公网证书已签发；HTTPS 未就绪时查看日志。

本地测试或已有 HTTPS 反向代理时，可使用回环模式：

```bash
sudo bash install.sh --version v0.1.0 --local
```

此模式将 HTTP 绑定至 `127.0.0.1:8080`，未启用的 HTTPS 映射为 `127.0.0.1:8443`。远程访问需使用 SSH 隧道，或由已有反向代理提供 HTTPS，安装器不会修改该代理。`--http-port`、`--https-port` 可更改宿主机映射；公网 ACME 验证仍需经公网 80/443 到达 Caddy，端口转发由你配置。公网模式绑定 IPv4 `0.0.0.0`，配置并测试 IPv6 链路后才应发布 AAAA 记录。

### 校验发行来源证明

v0.1.0 之后的发行版附带 `attestation.sigstore.json` 与 `image-attestation.sigstore.json`。安装器需要 [GitHub CLI](https://cli.github.com) **2.102.0 或更新版本**（更早版本按前缀匹配签发身份），只有当每个下载文件**以及 `image.txt` 中的镜像 digest** 都由本仓库 `main` 分支上的 `release.yml`、基于该发行源提交、在 GitHub 托管 runner 上签发证明时才会部署，否则拒绝。镜像使用独立的 bundle 校验：`gh` 在镜像仓库中解析 `oci://ghcr.io/keepraw/keepraw-fly@sha256:…`，要求该 digest 正是被签名的主体，且 `provenance.json` 必须指向同一镜像；随后按 digest（而非标签）拉取。无需 GitHub Token。v0.1.0 早于来源证明机制，文件和镜像都只做校验和检查，安装器会明确提示。手动校验：

```bash
gh attestation verify keepraw-fly-vX.Y.Z.tar.gz --bundle attestation.sigstore.json \
  --repo keepraw/Keepraw-Fly \
  --cert-identity https://github.com/keepraw/Keepraw-Fly/.github/workflows/release.yml@refs/heads/main \
  --source-ref refs/heads/main --deny-self-hosted-runners
gh attestation verify oci://ghcr.io/keepraw/keepraw-fly@sha256:… \
  --bundle image-attestation.sigstore.json --repo keepraw/Keepraw-Fly \
  --cert-identity https://github.com/keepraw/Keepraw-Fly/.github/workflows/release.yml@refs/heads/main \
  --source-ref refs/heads/main --source-digest <provenance.json 中的 commit> --deny-self-hosted-runners
```

### 手动 Compose

也可以从[发行附件](https://github.com/keepraw/Keepraw-Fly/releases/tag/v0.1.0)下载并检查 `compose.yaml`、`image.txt`、`SHA256SUMS`，按上文方法用 `sha256sum -c` 校验所选文件。在 `compose.yaml` 所在目录运行：

```bash
read -r -p '你的域名主机名：' KEEPRAW_DOMAIN
printf 'KEEPRAW_IMAGE=%s\nSITE_ADDRESS=%s\nBIND_ADDRESS=0.0.0.0\nHTTP_PORT=80\nHTTPS_PORT=443\n' "$(cat image.txt)" "$KEEPRAW_DOMAIN" > .env
docker compose -p keepraw-fly config -q
docker compose -p keepraw-fly up -d --wait
```

没有 `.env` 时，标准 Compose 使用明确的 `ghcr.io/keepraw/keepraw-fly:v0.1.0` 标签和回环 HTTP 8080。安装器采用 `image.txt` 中更严格的 digest 固定方式。不依赖 `latest`。手动 Compose 与安装器托管目录是两种方式；安装器不会接管非托管目录。

### 维护、升级、回滚与卸载

默认安装目录中的维护命令，需使用同一有 Docker 权限的账号：

```bash
cd /opt/keepraw-fly
sudo docker compose -p keepraw-fly ps
sudo docker compose -p keepraw-fly logs -f --tail=100
sudo docker compose -p keepraw-fly stop
sudo docker compose -p keepraw-fly up -d --wait
sudo docker compose -p keepraw-fly down
```

升级：先导出 JSON，再下载、校验**所选发行版本**的安装器，用明确的 `--version` 和 `--dir /opt/keepraw-fly` 执行。不传地址参数会保留现有域名及端口。重复运行 v0.1.0 命令是安全的，仅按需重建该托管部署。本次仅提供 v0.1.0；选择未来版本前应阅读发行说明及 Schema 兼容性要求。

回滚到本版本：使用已校验的安装器，传入 `--version v0.1.0 --dir /opt/keepraw-fly`。`history/` 也保留了旧版精确配置；手动恢复时需同时恢复**全部三个文件**（`compose.yaml`、`.env`、`.keepraw-managed`），再执行 `docker compose -p keepraw-fly up -d --wait`。恢复前备份当前文件。保持同一来源地址才能继续使用原浏览器数据。旧软件不保证兼容未来 Schema，仍需提前导出 JSON。

卸载：在部署目录运行 `docker compose -p keepraw-fly down`。如需同时删除**仅本项目**的 TLS/配置卷，使用 `down --volumes`。检查目录并保留需要的配置后，自行删除 `/opt/keepraw-fly`。不要使用 Docker 全局 prune 命令。卸载服务器不会删除浏览器数据，后者需要在浏览器中明确执行。

## 静态文件下载

[v0.1.0 Release](https://github.com/keepraw/Keepraw-Fly/releases/tag/v0.1.0) 提供 `keepraw-fly-v0.1.0.zip`、`keepraw-fly-v0.1.0.tar.gz`、`SHA256SUMS`、`install.sh`、`compose.yaml`、`Caddyfile`、`image.txt`、中英文部署指南、发行说明和 `provenance.json`。

根据 `SHA256SUMS` 校验所选压缩包后，解压并将包含 `index.html` 的目录发布至 HTTPS 静态托管服务即可。这些压缩包内是**生产网页文件**，无需构建。ZIP、tar.gz、官方 Pages 和 Docker 来自同一 main CI 构建。`release.json` 标明应用版本和 commit，`FILES.sha256` 标明每个文件；`provenance.json` 关联通过的 CI、镜像构建和 digest。校验和可检测下载损坏或文件不匹配，请通过官方 HTTPS 发行页面获取。

## 常见问题

- **Actions 缺失或禁用：** 在 Fork 启用 Actions，然后手动选择部署工作流。**Pages 404：** 将 Source 设置为 GitHub Actions，检查部署作业，使用发布地址并保留末尾斜杠。新站点可能需要数分钟生效。
- **版本不对或 Fork 改动未出现：** 此模式使用明确选择的官方发行版，不运行 Fork 源码。在站点对应路径下查看 `release.json`。
- **端口占用：** 查看 `sudo ss -ltnp`，使用回环模式接已有 HTTPS 代理，或选择空闲宿主机端口。安装器不会停止其他网站。
- **Docker 权限或 Compose 错误：** 以同一账号检查 `docker info`、`docker compose version`，自行安装或配置工具；不会自动安装系统软件。
- **GHCR 拒绝或校验失败：** 检查网络和官方 Release 是否完整，重试固定版本，不要绕过校验和或 TLS 验证。
- **HTTPS 不可用：** 检查 DNS A/AAAA、公网 TCP 80/443、安全组、系统时间和 `docker compose logs`。健康状态不足以证明 HTTPS 可用。不要反复删除证书卷，以免触发 CA 限流。
- **换网址后没有记录：** 数据按来源（协议、主机、端口）、浏览器配置和设备隔离。返回原来源导出 JSON，在目标导入。同一来源的两个项目路径不是存储隔离边界，需要隔离时使用不同主机名。
- **地图、字体、资源加载失败：** 在网络面板检查内置资源是否被拦截，确认子目录及末尾斜杠。中文 MiSans 字体沿用固定外部 CDN，失败时回退系统字体。浏览器扩展和存储策略也可能影响使用。

## 开发者与官方发布

仅开发者需要 Node.js **20.19+** 和 pnpm **10.14.0**（官方 CI 使用 Node 24）：

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm preview
```

打开 <http://127.0.0.1:4173>。静态产物位于 `apps/web/dist/`；不支持以文件方式直接打开 `index.html`。Hash 路由无需 rewrite 或后端。参见[测试说明](testing.md)。

官方 [CI](../.github/workflows/ci.yml) 保留文档、格式、CSS、类型、单元、构建、六分片完整 Chromium，以及 Firefox/WebKit smoke 检查。`verify` 要求所有验证成功，失败、取消或跳过均阻止官方部署。仅成功的 main push 部署**同一次运行**产生的 Pages 产物。Fork 专用流程不能部署官方站点。

维护者发布流程：

1. 正常合并发行 PR，等待 **main 全部 CI**（含 Pages 部署）成功，记录 run ID 和 commit SHA，不绕过保护规则。
2. 确认 `v0.1.0` Tag 和 Release 均不存在，在该 SHA 创建 lightweight `v0.1.0` Tag 并推送，不移动已有 Tag。
3. 在 main 手动运行 **Build verified release image**，填写 `ci_run_id`。它检查官方成功的 main CI 及 Tag，下载已有生产构建，发布 linux/amd64 和 linux/arm64 镜像；不重新编译应用，不用 `GITHUB_TOKEN` 创建 Release。**请在 `main` 仍指向该 CI commit 时运行：**本次运行自身的 `github.sha`（触发时 `main` 的最新提交）就是 GitHub 写入每份来源证明的源提交，因此 CI commit、`github.sha` 与 Tag commit 不一致时，任务会在任何推送、签名或上传之前拒绝；签名后还会按该 commit 校验新生成的来源证明。`main` 前进后不支持发布更早的提交。首次发布需在包设置确保 GHCR 包为 **public**，且匿名拉取可用。
4. `gh` 以 **keepraw** 认证后执行 `bash scripts/publish-release.sh CI_RUN_ID IMAGE_RUN_ID --publish`，将两个参数替换为实际运行 ID。脚本验证来源、校验和及公开镜像架构；创建 Draft，核验真实 `author.login`，上传全部附件并重新下载比较后正式发布。作者不匹配时保留 Draft，不发布。若缺少权限，Owner 在产物准备完成后执行这一条最终命令。

应用 package 版本为 `0.1.0`，Tag 为 `v0.1.0`。档案 Schema 版本在 `packages/schema` 独立管理，本次部署工作不修改它。OCI 作者为 `keepraw`；不会重写 commit 作者或第三方版权。已有[第三方声明](../THIRD_PARTY_NOTICES.md)和[许可审查](license-review-2026-10-10.md)继续适用。

如 Owner 的 CLI 可以创建 Draft 但无法上传附件，**Build verified release image** 也支持只上传附件：填写已有 `keepraw` Draft 的数字 `release_id`、原始 `image_run_id` 和 `ci_run_id`。它检查作者、Tag、commit 和来源，将原始产物上传至空 Draft，再重新下载比较；不会创建或发布 Release，也不会覆盖已有附件。之后由 Owner 核验并发布完整 Draft。
