# 学习笔记

## Claude Code CLI 认证机制 (2026-02-12)

### 问题
`config.json` 里是旧的无效 API key，但 CLI 却能正常工作？

### 关键发现

**实验**：修改 `config.json` 测试
- `"primaryApiKey": "#"` → ✅ 能用
- `"primaryApiKey": ""` → ❌ 要求登录

**结论**：`primaryApiKey` 只是"已登录"标记，不验证实际值！

**真相**：真正的 API key 在 VS Code Extension 的 SecretStorage（加密存储）

### 架构

```
CLI (config.json 只检查非空)
  ↓ WebSocket + authToken (进程间通信)
VS Code Extension (SecretStorage 存真正的 API key)
  ↓ HTTPS
Anthropic API
```

**关键文件**：`.claude/ide/44762.lock`
```json
{
  "transport": "ws",
  "authToken": "8ea99e9f-1e86-4a50-9eb4-d6fccfc0851b"
}
```

### 核心结论

1. `config.json` 的 `primaryApiKey` 是假的（只是标记）
2. 真正的认证在 VS Code Extension 内部（SecretStorage 加密）
3. CLI 只是转发器，通过 WebSocket 连接 extension
4. 删除/修改 `config.json` 不影响使用（只要 extension 有有效 token）

### 重新登录

```bash
claude logout
claude login  # 会打开浏览器 OAuth 授权
```
