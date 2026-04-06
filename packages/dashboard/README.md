# @mangou/dashboard

Read-only local dashboard for Mangou.

## Usage

```bash
npx @mangou/dashboard
```

Or after installation:

```bash
mangou-dashboard
```

Environment variables:

- `PORT`: local dashboard port, default `3010`
- `MANGOU_API_ORIGIN`: upstream Mangou API origin, default `http://127.0.0.1:3000`

The package serves the prebuilt dashboard frontend and proxies `/api/*` to the Mangou local server.

## Release flow

```bash
cd packages/dashboard
npm run pack:check
npm publish --access public
```
