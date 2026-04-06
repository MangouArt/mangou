<!-- GENERATED FROM skill-src/mangou. DO NOT EDIT HERE. EDIT skill-src/mangou INSTEAD. -->
# Mangou Commands

## Command format

所有命令都从技能根目录执行：

```bash
bun run src/main.ts <resource> <action> [...flags]
```

## Project

初始化项目：

```bash
bun run src/main.ts project init --name <project-id>
```

拼接全片：

```bash
bun run src/main.ts project stitch --id <project-id>
```

## Asset

生成资产：

```bash
bun run src/main.ts asset generate --path asset_defs/<type>/<name>.yaml
```

## Storyboard

生成分镜图片：

```bash
bun run src/main.ts storyboard generate --path storyboards/<name>.yaml --type image
```

生成分镜视频：

```bash
bun run src/main.ts storyboard generate --path storyboards/<name>.yaml --type video
```

切分 grid 母图：

```bash
bun run src/main.ts storyboard split --path storyboards/<parent>.yaml
```

## Server

启动本地镜像服务：

```bash
bun run src/main.ts server start --port <port>
```

## Execution loop

每次都按这条闭环走：

1. 修改 YAML
2. 运行对应命令
3. 检查 `tasks.jsonl`
4. 检查 YAML `tasks.<type>.latest`
5. 根据 `error` 或产物路径继续修正
