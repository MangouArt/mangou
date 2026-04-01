# 资产管理与 AIGC 供应商 (Assets & Providers)

本模块描述了如何定义和生成 Manga AIGC 资产，以及通过 YAML 指定服务商。

## 1. 资产引用与路径 (Core Asset Paths)

- **物理存储**: 产物统一存放于 `<project-root>/assets/` 下的 `images/` 和 `videos/`。
- **YAML 引用**: 在分镜或资产 YAML 中，通过相对路径引用，例如 `assets/images/astronaut.png`。
- **动态引用**: 使用 `${asset_defs/astronaut.yaml:tasks.image.latest.output}` 语法实现资产与分镜的视觉联动。

## 2. 供应商详情 (AIGC Provider Details)

Mangou 是一款解耦的软件，通过在 YAML 中指定 `provider`，可以使用不同供应商。Agent 在构建 YAML `tasks` 任务时，应严格参考以下各供应商的模型名、必填参数与特有字段。

详见：
- **[BLTAI (ID: bltai)](provider-bltai.md)**: 默认低延迟供应商。支持 `nano-banana`, `doubao-...`。
- **[KIE AI (ID: kie)](provider-kie.md)**: 高性能、大模型供应商。支持 `nano-banana-2`, `nano-banana-edit`, `v1-pro-fast-...`。

---

## 3. 在 YAML 中定义任务 (Task Structure)

Agent 在创建 YAML 文件时，可以在 `tasks` 键下指定 `provider`：

```yaml
tasks:
  image:
    provider: "kie"                 # 显式指定使用的供应商 ID
    params:
      model: "nano-banana-2"        # 对应供应商的模型标识
      prompt: "一位穿着宇航服的少女"
      aspect_ratio: "16:9"          # KIE 特有的比例参数
      resolution: "1K"              # KIE 特有的画质参数
```

## 4. 环境变量同步

开发者或用户需在 `.env.local` 文件中配置 API KEY：

```env
# 核心设置
MANGOU_AIGC_PROVIDER=bltai    # 未在 YAML 中指定时的全局默认值

# 提供商密钥
BLTAI_API_KEY=xxx
KIE_API_KEY=xxx
```

---

## 5. Agent 自动化原则 (Agent Rule)

1. **先读再写**: 在生成新任务前，先读取对应的 `provider-*.md` 了解参数规范。
2. **精准回填**: 确保 `model` 名与文档完全一致，不要凭空猜测模型名。
3. **静默上传**: 在调用基于 `kie` 的视频模型时，Agent 只需要提供本地图片路径，底层的 `KIE_PROVIDER` 逻辑会自动先行处理二进制上传。
