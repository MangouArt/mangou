# Mangou Distribution Spec（迁移版）

> 状态：migration in progress

## 目的

说明 `mangou` core 仓在重组后的分发边界。

## 新边界

### 1. 主产品分发
主产品分发不再由本仓承担，统一迁移到：
- `MangouArt/mangou-ai-motion-comics`

对外推荐安装方式：

```bash
npx skills add MangouArt/mangou-ai-motion-comics
```

### 2. 本仓职责

本仓只负责：
- dashboard 相关共享 schema / types / UI utilities
- dashboard npm 包
- spec / protocol
- 开发者向测试与基础设施

### 3. 已废弃主叙事
以下内容不再是本仓的推荐主路径：
- `skill-src/mangou`
- `mangou.zip`
- `mangou-runtime.zip`
- `build:skill`
- 以 zip 手工拼装 runtime 的安装方式

迁移期内历史文件可暂存，但不再作为 SSOT。

## 开发态约束

- 涉及 skill 文档、provider 产品逻辑、CLI/runtime 产品行为时，优先改 `mangou-ai-motion-comics`
- 涉及 dashboard、spec、provider 无关 core 时，留在 `mangou`
- 不要在本仓重新扩大 skill 产品层边界

## 工作区约束

真实项目目录只允许在母仓：

```text
Mango/workspace/projects/
```

本仓库不再保留任何仓内 `projects/` 目录；真实工作区语义只属于 `Mango/workspace/projects/`。
