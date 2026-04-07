# 供应商: JieKou AI (接口 AI)

JieKou AI (jiekou.ai) 是一个聚合 AIGC 服务商，提供包括 Seedance 2.0、Kling、Vidu 等在内的多种模型。

## 配置密钥

在 `.env.local` 中添加：
```bash
JIEKOU_API_KEY="你的 API 密钥"
# 可选：自定义 Base URL
# JIEKOU_BASE_URL="https://api.jiekou.ai"
```

## 模型推荐

### Seedance 2.0 (推荐)
- **ID**: `seedance-2.0` 或 `seedance-2.0-fast`
- **特点**: 高精度视频生成，支持多模态参考（图片+视频+音频）。
- **参数**: 遵循最新文档，支持 `image` (首帧), `last_image` (尾帧), `ratio` (比例) 等。

## 获取 Token
访问 [JieKou.ai 控制台](https://jiekou.ai/settings/key-management) 获取 API 密钥。

## 相关文档
- [Seedance 2.0 规格说明](../../docs/vendor-api/jiekou-seedance-2.0.md)
- [模型列表](../../docs/vendor-api/jiekou-llms.txt)
