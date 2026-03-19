/**
 * 飞书机器人 - MiniMax 对话版本
 * 
 * 环境变量:
 *   FEISHU_APP_ID - 飞书应用 ID
 *   FEISHU_APP_SECRET - 飞书应用密钥
 *   MINIMAX_API_KEY - MiniMax API 密钥
 *   MINIMAX_MODEL - MiniMax 模型 (默认: MiniMax-M2.5)
 *   PORT - 服务端口 (默认: 3000)
 */

const http = require('http');
const crypto = require('crypto');

// 环境变量
const APP_ID = process.env.FEISHU_APP_ID || 'cli_a930dcf79538dccb';
const APP_SECRET = process.env.FEISHU_APP_SECRET || 'i2CgwwWoeKmWq1oUDLNeAgKaUKNNmifS';
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.5';
const PORT = process.env.PORT || process.env.RAILWAY_PORT || 8080;

// 存储 tenant_access_token 和过期时间
let tenantToken = { token: null, expireTime: 0 };

/**
 * 获取飞书 tenant_access_token
 */
async function getTenantAccessToken() {
  const now = Date.now();
  if (tenantToken.token && tenantToken.expireTime > now + 60000) {
    return tenantToken.token;
  }

  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET })
  });
  
  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`获取 token 失败: ${data.msg}`);
  }
  
  tenantToken.token = data.tenant_access_token;
  tenantToken.expireTime = now + (data.expire - 60) * 1000;
  return tenantToken.token;
}

/**
 * 调用 MiniMax API
 */
async function callMiniMax(message) {
  if (!MINIMAX_API_KEY) {
    return '⚠️ 未配置 MiniMax API Key，请设置环境变量 MINIMAX_API_KEY';
  }

  const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MINIMAX_API_KEY}`
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages: [
        { role: 'system', content: '你是一个友好的AI助手，用中文回复用户。' },
        { role: 'user', content: message }
      ]
    })
  });

  const data = await response.json();
  if (data.choices && data.choices[0]) {
    return data.choices[0].message.content;
  }
  return `⚠️ MiniMax API 错误: ${JSON.stringify(data)}`;
}

/**
 * 发送消息到飞书
 */
async function sendMessage(receiveId, receiveIdType, content) {
  const token = await getTenantAccessToken();
  
  const response = await fetch('https://open.feishu.cn/open-apis/im/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      receive_id: receiveId,
      receive_id_type: receiveIdType,
      msg_type: 'text',
      content: JSON.stringify({ text: content })
    })
  });

  const data = await response.json();
  if (data.code !== 0) {
    console.error('发送消息失败:', data);
  }
  return data;
}

/**
 * 验证飞书签名
 */
function verifySignature(signature, timestamp, nonce, body) {
  const secret = APP_SECRET;
  const str = timestamp + nonce + JSON.stringify(body);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(str);
  const hash = hmac.digest('base64');
  return hash === signature;
}

/**
 * 处理飞书事件
 */
async function handleEvent(event) {
  console.log('收到事件:', JSON.stringify(event));
  
  const { event_type, message, sender } = event;
  
  // 处理消息事件
  if (event_type === 'im.message' && message && message.msg_type === 'text') {
    const userMessage = JSON.parse(message.content).text;
    const userId = sender.sender_id.user_id;
    
    console.log(`用户 ${userId} 发送: ${userMessage}`);
    
    // 调用 MiniMax
    const reply = await callMiniMax(userMessage);
    
    // 回复用户
    await sendMessage(userId, 'user_id', reply);
    
    console.log(`回复用户: ${reply}`);
  }
}

// HTTP 服务器
const server = http.createServer(async (req, res) => {
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Feishu-Signature, X-Feishu-Request-Timestamp, X-Feishu-Request-Nonce');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'GET') {
    // 验证 URL 用于飞书回调
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('飞书机器人运行中...');
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        
        // 验证签名（生产环境建议开启）
        // const signature = req.headers['x-feishu-signature'];
        // const timestamp = req.headers['x-feishu-request-timestamp'];
        // const nonce = req.headers['x-feishu-request-nonce'];
        // if (!verifySignature(signature, timestamp, nonce, data)) {
        //   res.writeHead(401);
        //   res.end('签名验证失败');
        //   return;
        // }

        // 处理 URL 验证事件
        if (data.type === 'url_verification') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ challenge: data.challenge }));
          return;
        }

        // 处理事件回调
        if (data.type === 'event_callback') {
          await handleEvent(data.event);
        }

        res.writeHead(200);
        res.end('ok');
      } catch (err) {
        console.error('处理错误:', err);
        res.writeHead(500);
        res.end('error');
      }
    });
  }
});

server.listen(PORT, () => {
  console.log(`🤖 飞书机器人启动成功！`);
  console.log(`📡 监听端口: ${PORT}`);
  console.log(`🔧 环境变量:`);
  console.log(`   FEISHU_APP_ID: ${APP_ID}`);
  console.log(`   MINIMAX_API_KEY: ${MINIMAX_API_KEY ? '已配置' : '未配置'}`);
  console.log(`   MINIMAX_MODEL: ${MINIMAX_MODEL}`);
});
