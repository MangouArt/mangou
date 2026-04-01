# 商业化与计费规范 (Commercialization & Billing)

本规范定义了 Mangou Director 如何处理用户身份验证、余额管理及 AIGC 任务计费。

## 1. 身份验证 (Authentication)

Mangou 采用**无密码**的邮箱验证码登录模式。

### 登录流程
1. 调用 `auth/send-code` 向用户邮箱发送 6 位验证码。
2. 用户提供验证码后，调用 `auth/login` 获取 JWT Token。
3. **Token 持久化**：Token 必须存储在平级目录的 `.mangou_token` 文件中。后续所有请求需在 Header 中携带 `Authorization: Bearer <token>`。

## 2. 计费规则 (Pricing Tiers)

计费以“点数 (Gems)”为单位。基础定价如下：

| 任务类型 | 供应商 (Provider) | 消耗 (Gems) | 说明 |
| :--- | :--- | :--- | :--- |
| **Image** | KIE | 1.0 | 单图生成 |
| **Video** | KIE | 5.0 | 视频生成 (i2v/t2v) |

## 3. 账户管理 (Account Management)

### 查询余额
调用 `/billing/balance` 获取当前账户剩余 Gems 以及历史消费记录。

### 充值 (Recharge)
1. 调用 `/billing/recharge-qr`。
2. 计费服务返回支付宝支付二维码图片或 URL。
3. Agent 引导用户扫描二维码完成支付，支付成功后余额秒级同步。

## 4. AIGC 任务转发 (API Proxy)

所有 AIGC 生产脚本均应通过跳转代理执行，以确保计费闭环。

- **网关地址**: `http://billing-service:8008/v1/aigc/task`
- **请求模式**:
  - `provider`: 目标供应商标识。
  - `type`: 任务类型（image/video）。
  - `params`: 对应供应商的标准参数。

---

> [!NOTE]
> 如果余额不足，网关将返回 `402 Payment Required`。Agent 应拦截此错误并引导用户进行充值。
