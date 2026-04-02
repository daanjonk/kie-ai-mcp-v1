# Kie AI MCP Server

Universal MCP server for **all** [Kie AI](https://kie.ai) image generation and editing models. One server, every model — pick the one you want at call time.

## Supported Models

### Generation (text-to-image / image-to-image)

| Model ID | Name | Highlights |
|----------|------|------------|
| `nano-banana-pro` | Nano Banana Pro | Best all-around. 4K, text rendering, up to 8 ref images |
| `google/nano-banana` | Nano Banana | Fast, affordable Gemini-based generation |
| `nano-banana-2` | Nano Banana 2 | Second-gen improvements |
| `seedream/4.5-text-to-image` | Seedream 4.5 | ByteDance. Photorealistic, 2K/4K quality modes |
| `flux-2/pro-text-to-image` | Flux 2 Pro | Photoreal detail, accurate text rendering |
| `flux-2/pro-image-to-image` | Flux 2 Pro I2I | Style transfer, outfit changes, up to 8 refs |
| `flux-2/flex-text-to-image` | Flux 2 Flex | Good quality/cost ratio |
| `flux-2/flex-image-to-image` | Flux 2 Flex I2I | Flexible transformations, lower cost |
| `flux-1/kontext` | Flux 1 Kontext | Context-aware generation |
| `imagen-4` | Imagen 4 | Google's latest, excellent fidelity |
| `ideogram/v3` | Ideogram V3 | Best-in-class text/typography in images |
| `ideogram/character` | Ideogram Character | Consistent character generation |
| `4o-image` | 4o Image | OpenAI 4o-based generation |
| `z-image` | Z-Image | Alternative generation model |

### Editing (image-edit)

| Model ID | Name | Highlights |
|----------|------|------------|
| `seedream/4.5-edit` | Seedream 4.5 Edit | Material, lighting, style changes. 4K output |
| `google/nano-banana-edit` | Nano Banana Edit | Gemini-based editing. Fast and cheap |
| `qwen/image-edit` | Qwen Image Edit | Alibaba's general-purpose editor |

## Tools

| Tool | Description |
|------|-------------|
| `kie_list_models` | List all available models with capabilities and parameters |
| `kie_generate_image` | Generate an image (text-to-image or image-to-image) |
| `kie_edit_image` | Edit an existing image with natural language |
| `kie_get_task_status` | Check task status and get result URLs |

## Setup

### 1. Get your API key

Go to [kie.ai/api-key](https://kie.ai/api-key) and create an API key.

### 2. Install

```bash
git clone https://github.com/YOUR_USERNAME/kie-ai-mcp-server.git
cd kie-ai-mcp-server
npm install
npm run build
```

### 3. Configure

Set your API key as an environment variable:

```bash
export KIE_AI_API_KEY=your_api_key_here
```

### 4. Add to Claude Desktop / Claude Code

Add this to your MCP settings (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "kie-ai": {
      "command": "node",
      "args": ["/path/to/kie-ai-mcp-server/dist/index.js"],
      "env": {
        "KIE_AI_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Usage Examples

### Generate an image

```
Use kie_generate_image with model "nano-banana-pro", prompt "A cozy coffee shop interior with warm lighting, watercolor style", aspect_ratio "16:9", resolution "2K"
```

### Edit an image

```
Use kie_edit_image with model "seedream/4.5-edit", prompt "Change the background to a tropical beach at sunset", image_urls ["https://example.com/my-photo.jpg"]
```

### Check task status

```
Use kie_get_task_status with task_id "abc123..."
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KIE_AI_API_KEY` | Yes | — | Your Kie AI API key |
| `KIE_AI_BASE_URL` | No | `https://api.kie.ai/api/v1` | API base URL |
| `KIE_AI_TIMEOUT` | No | `60000` | Request timeout in ms |

## How It Works

All Kie AI models share the same API pattern:

1. **Create task**: `POST /jobs/createTask` with `{ model, input }`
2. **Poll status**: `GET /jobs/recordInfo?taskId=...`
3. **Get result**: When `state === "success"`, the result URLs are in `resultJson`

This server wraps that pattern into clean MCP tools with model-specific parameter validation.

## Adding New Models

To add a new Kie AI model, simply add an entry to the `MODEL_REGISTRY` array in `src/models.ts`. No other changes needed — the tools dynamically adapt to the registry.

## License

MIT
