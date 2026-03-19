# 飞书 + MiniMax 机器人部署指南

## 快速部署（推荐）

### 方式一：Railway（免费额度）

1. **上传代码到 GitHub**
   ```bash
   cd feishu-bot
   git init
   git add .
   git commit -m "飞书机器人"
   # 创建 GitHub 仓库并推送
   ```

2. **在 Railway 部署**
   - 访问 https://railway.app
   - 用 GitHub 登录
   - New Project → Deploy from GitHub repo
   - 选择你的仓库

3. **设置环境变量**
   在 Railway 后台添加：
   ```
   FEISHU_APP_ID=cli_a930dcf79538dccb
   FEISHU_APP_SECRET=你的飞书密钥（换掉！）
   MINIMAX_API_KEY=sk-cp-xxx  （你的 MiniMax Key）
   MINIMAX_MODEL=MiniMax-M2.5
   ```

4. **获取公网 URL**
   Railway 会给你一个 `xxx.railway.app` 的域名

---

### 方式二：Vercel（免费）

1. 安装 Vercel CLI
   ```bash
   npm i -g vercel
   ```

2. 部署
   ```bash
   cd feishu-bot
   vercel
   # 按提示操作，设置环境变量
   ```

---

### 方式三：自建服务器/VPS

```bash
cd feishu-bot

# 安装依赖
npm install

# 设置环境变量
export FEISHU_APP_ID=cli_a930dcf79538dccb
export FEISHU_APP_SECRET=你的飞书密钥
export MINIMAX_API_KEY=sk-cp-xxx
export MINIMAX_MODEL=MiniMax-M2.5

# 启动
npm start
```

---

## 配置飞书回调

1. 打开 https://open.feishu.cn/
2. 进入你的应用 → 事件订阅
3. 添加请求 URL：
   ```
   https://你的域名/your-webhook-url
   ```
4. 订阅事件：
   - `im.message.receive_v1`（接收消息）
5. 发布版本

---

## 本地测试

```bash
# 临时暴露本地端口（需要安装 ngrok）
ngrok http 3000

# 用 ngrok 提供的 URL 配置飞书回调
```

---

## ⚠️ 安全注意

1. **飞书密钥已泄露** — 立刻去飞书开放平台换新的！
2. **MiniMax Key 已泄露** — 立刻去 MiniMax 平台换新的！
3. 生产环境务必开启签名验证（代码里有注释）
