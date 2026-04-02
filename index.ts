#!/usr/bin/env node
/**
 * Kie AI MCP Server
 *
 * Universal MCP server for ALL Kie AI image generation and editing models.
 * Supports Nano Banana Pro, Seedream 4.5, Flux 2, Imagen 4, Ideogram V3,
 * Qwen Image Edit, Z-Image, and more.
 *
 * Every model uses the same Kie AI API pattern — this server abstracts that
 * into clean, model-selectable tools.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { KieAiClient } from "./client.js";
import {
  MODEL_REGISTRY,
  getModelById,
  getGenerationModels,
  getEditModels,
  getAllModelIds,
  type ModelDefinition,
} from "./models.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_KEY = process.env.KIE_AI_API_KEY;
const BASE_URL = process.env.KIE_AI_BASE_URL ?? "https://api.kie.ai/api/v1";
const TIMEOUT = parseInt(process.env.KIE_AI_TIMEOUT ?? "60000", 10);

if (!API_KEY) {
  console.error("ERROR: KIE_AI_API_KEY environment variable is required.");
  console.error("Get your key at https://kie.ai/api-key");
  process.exit(1);
}

const client = new KieAiClient({ apiKey: API_KEY, baseUrl: BASE_URL, timeout: TIMEOUT });

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "kie-ai-mcp-server",
  version: "2.0.0",
});

// ---------------------------------------------------------------------------
// Helper: format model info
// ---------------------------------------------------------------------------

function formatModelInfo(model: ModelDefinition): string {
  const lines = [
    `**${model.name}** (\`${model.id}\`)`,
    model.description,
    "",
    `Capabilities: ${model.capabilities.join(", ")}`,
  ];
  if (model.creditsCost) lines.push(`Cost: ${model.creditsCost}`);
  lines.push("", "Parameters:");
  for (const p of model.params) {
    let desc = `  - \`${p.name}\` (${p.type}${p.required ? ", required" : ""})`;
    desc += ` — ${p.description}`;
    if (p.options) desc += ` [${p.options.join(", ")}]`;
    if (p.default !== undefined) desc += ` (default: ${String(p.default)})`;
    lines.push(desc);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Tool: kie_list_models
// ---------------------------------------------------------------------------

const ListModelsInputSchema = z
  .object({
    capability: z
      .enum(["text-to-image", "image-to-image", "image-edit", "all"])
      .default("all")
      .describe("Filter models by capability, or 'all' for everything"),
  })
  .strict();

server.registerTool(
  "kie_list_models",
  {
    title: "List Kie AI Models",
    description: `List all available Kie AI image generation and editing models with their capabilities, parameters, and pricing.

Use this tool to discover which models are available before generating or editing images.

Args:
  - capability ('text-to-image' | 'image-to-image' | 'image-edit' | 'all'): Filter by capability (default: 'all')

Returns: Formatted list of models with their IDs, descriptions, capabilities, and parameters.`,
    inputSchema: ListModelsInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (params) => {
    let models = MODEL_REGISTRY;
    if (params.capability !== "all") {
      models = models.filter((m) => m.capabilities.includes(params.capability as any));
    }

    const text = models.map(formatModelInfo).join("\n\n---\n\n");
    return {
      content: [{ type: "text", text: `# Available Kie AI Models (${models.length})\n\n${text}` }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: kie_generate_image
// ---------------------------------------------------------------------------

const generateModelIds = getGenerationModels().map((m) => m.id);

const GenerateImageInputSchema = z
  .object({
    model: z
      .string()
      .describe(
        `Model ID to use. Available generation models: ${generateModelIds.join(", ")}. Use kie_list_models for details.`
      ),
    prompt: z
      .string()
      .min(1, "Prompt is required")
      .describe("Text description of the image to generate"),
    image_urls: z
      .array(z.string().url("Each image URL must be a valid URL"))
      .optional()
      .describe("Optional reference image URLs (for image-to-image models). Up to 8 images depending on model."),
    aspect_ratio: z
      .string()
      .optional()
      .describe("Aspect ratio (e.g. '1:1', '16:9', '9:16', '4:3', '3:4'). Default varies by model."),
    resolution: z
      .string()
      .optional()
      .describe("Output resolution: '1K', '2K', or '4K' (availability varies by model)"),
    quality: z
      .string()
      .optional()
      .describe("Quality level: 'basic' (2K) or 'high' (4K) — for Seedream models"),
    output_format: z
      .string()
      .optional()
      .describe("Output format: 'png' or 'jpg' (for models that support it)"),
    nsfw_checker: z
      .boolean()
      .optional()
      .describe("Enable/disable NSFW content checker (default: true for most models)"),
    callback_url: z
      .string()
      .url()
      .optional()
      .describe("Optional webhook URL to receive a POST when the task completes"),
  })
  .strict();

server.registerTool(
  "kie_generate_image",
  {
    title: "Generate Image with Kie AI",
    description: `Generate an image using any Kie AI model. Supports text-to-image and image-to-image generation.

**Recommended models:**
- \`nano-banana-pro\` — Best all-around. Supports reference images, 4K, great text rendering.
- \`seedream/4.5-text-to-image\` — High quality with 4K option. Good for photorealistic.
- \`flux-2/pro-text-to-image\` — Excellent photoreal detail and text accuracy.
- \`flux-2/pro-image-to-image\` — Best for transforming existing images with references.
- \`imagen-4\` — Google's latest, excellent fidelity.

This creates an async task. Use \`kie_get_task_status\` to poll for results.

Args:
  - model (string, required): Model ID (use kie_list_models to see all options)
  - prompt (string, required): What to generate
  - image_urls (string[], optional): Reference images for image-to-image models
  - aspect_ratio (string, optional): e.g. '1:1', '16:9', '9:16'
  - resolution (string, optional): '1K', '2K', or '4K'
  - quality (string, optional): 'basic' or 'high' (Seedream models)
  - output_format (string, optional): 'png' or 'jpg'
  - nsfw_checker (boolean, optional): NSFW filter toggle
  - callback_url (string, optional): Webhook for completion notification

Returns: Task ID for polling with kie_get_task_status.`,
    inputSchema: GenerateImageInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async (params) => {
    const model = getModelById(params.model);
    if (!model) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Unknown model '${params.model}'. Available generation models: ${generateModelIds.join(", ")}`,
          },
        ],
        isError: true,
      };
    }

    // Build the input object based on what the model accepts
    const input: Record<string, unknown> = { prompt: params.prompt };

    // Map image_urls to the correct field name for this model
    if (params.image_urls?.length) {
      const imageParam = model.params.find(
        (p) => p.name === "image_input" || p.name === "input_urls" || p.name === "image_urls"
      );
      if (imageParam) {
        input[imageParam.name] = params.image_urls;
      } else {
        return {
          content: [
            {
              type: "text",
              text: `Error: Model '${params.model}' does not accept reference images. Use a model with image-to-image capability.`,
            },
          ],
          isError: true,
        };
      }
    }

    // Add optional parameters if the model supports them
    const modelParamNames = new Set(model.params.map((p) => p.name));

    if (params.aspect_ratio && modelParamNames.has("aspect_ratio")) {
      input.aspect_ratio = params.aspect_ratio;
    }
    if (params.resolution && modelParamNames.has("resolution")) {
      input.resolution = params.resolution;
    }
    if (params.quality && modelParamNames.has("quality")) {
      input.quality = params.quality;
    }
    if (params.output_format && modelParamNames.has("output_format")) {
      input.output_format = params.output_format;
    }
    if (params.nsfw_checker !== undefined && modelParamNames.has("nsfw_checker")) {
      input.nsfw_checker = params.nsfw_checker;
    }

    try {
      const response = await client.createTask({
        model: params.model,
        input,
        callBackUrl: params.callback_url,
      });

      if (response.code !== 200) {
        return {
          content: [{ type: "text", text: `Error: ${response.msg}` }],
          isError: true,
        };
      }

      const taskId = response.data.taskId;
      return {
        content: [
          {
            type: "text",
            text: [
              `Image generation task created successfully.`,
              ``,
              `- **Task ID**: \`${taskId}\``,
              `- **Model**: ${model.name} (\`${params.model}\`)`,
              `- **Prompt**: ${params.prompt.substring(0, 200)}${params.prompt.length > 200 ? "..." : ""}`,
              params.image_urls?.length ? `- **Reference images**: ${params.image_urls.length}` : "",
              ``,
              `Use \`kie_get_task_status\` with task_id \`${taskId}\` to check progress and get the result URL.`,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: kie_edit_image
// ---------------------------------------------------------------------------

const editModelIds = getEditModels().map((m) => m.id);

const EditImageInputSchema = z
  .object({
    model: z
      .string()
      .describe(
        `Model ID to use for editing. Available edit models: ${editModelIds.join(", ")}. Use kie_list_models for details.`
      ),
    prompt: z
      .string()
      .min(1, "Edit prompt is required")
      .describe("Natural language description of the edit to apply to the image(s)"),
    image_urls: z
      .array(z.string().url("Each image URL must be a valid URL"))
      .min(1, "At least one image URL is required for editing")
      .describe("URLs of the images to edit (at least 1 required)"),
    aspect_ratio: z
      .string()
      .optional()
      .describe("Output aspect ratio (e.g. '1:1', '16:9')"),
    quality: z
      .string()
      .optional()
      .describe("Quality level: 'basic' (2K) or 'high' (4K) — for Seedream 4.5 Edit"),
    nsfw_checker: z
      .boolean()
      .optional()
      .describe("Enable/disable NSFW content checker"),
    callback_url: z
      .string()
      .url()
      .optional()
      .describe("Optional webhook URL to receive a POST when the task completes"),
  })
  .strict();

server.registerTool(
  "kie_edit_image",
  {
    title: "Edit Image with Kie AI",
    description: `Edit an existing image using natural language instructions.

**Available edit models:**
- \`seedream/4.5-edit\` — Best for material/lighting/style changes. Supports 4K output.
- \`google/nano-banana-edit\` — Google Gemini-based editing. Fast and affordable.
- \`qwen/image-edit\` — Alibaba's Qwen editor for general-purpose edits.

This creates an async task. Use \`kie_get_task_status\` to poll for results.

Args:
  - model (string, required): Edit model ID
  - prompt (string, required): What to change (e.g. "Change the background to a beach sunset")
  - image_urls (string[], required): URLs of images to edit (at least 1)
  - aspect_ratio (string, optional): Output aspect ratio
  - quality (string, optional): 'basic' or 'high' (Seedream only)
  - nsfw_checker (boolean, optional): NSFW filter toggle
  - callback_url (string, optional): Webhook for completion notification

Returns: Task ID for polling with kie_get_task_status.`,
    inputSchema: EditImageInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async (params) => {
    const model = getModelById(params.model);
    if (!model) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Unknown model '${params.model}'. Available edit models: ${editModelIds.join(", ")}`,
          },
        ],
        isError: true,
      };
    }

    if (!model.capabilities.includes("image-edit")) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Model '${params.model}' does not support image editing. Use one of: ${editModelIds.join(", ")}`,
          },
        ],
        isError: true,
      };
    }

    // Build input — map image_urls to the model's expected field name
    const input: Record<string, unknown> = { prompt: params.prompt };

    const imageParam = model.params.find(
      (p) => p.name === "image_urls" || p.name === "input_urls" || p.name === "image_input"
    );
    if (imageParam) {
      input[imageParam.name] = params.image_urls;
    } else {
      input.image_urls = params.image_urls;
    }

    const modelParamNames = new Set(model.params.map((p) => p.name));

    if (params.aspect_ratio && modelParamNames.has("aspect_ratio")) {
      input.aspect_ratio = params.aspect_ratio;
    }
    if (params.quality && modelParamNames.has("quality")) {
      input.quality = params.quality;
    }
    if (params.nsfw_checker !== undefined && modelParamNames.has("nsfw_checker")) {
      input.nsfw_checker = params.nsfw_checker;
    }

    try {
      const response = await client.createTask({
        model: params.model,
        input,
        callBackUrl: params.callback_url,
      });

      if (response.code !== 200) {
        return {
          content: [{ type: "text", text: `Error: ${response.msg}` }],
          isError: true,
        };
      }

      const taskId = response.data.taskId;
      return {
        content: [
          {
            type: "text",
            text: [
              `Image edit task created successfully.`,
              ``,
              `- **Task ID**: \`${taskId}\``,
              `- **Model**: ${model.name} (\`${params.model}\`)`,
              `- **Edit prompt**: ${params.prompt.substring(0, 200)}${params.prompt.length > 200 ? "..." : ""}`,
              `- **Input images**: ${params.image_urls.length}`,
              ``,
              `Use \`kie_get_task_status\` with task_id \`${taskId}\` to check progress and get the result URL.`,
            ].join("\n"),
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: kie_get_task_status
// ---------------------------------------------------------------------------

const GetTaskStatusInputSchema = z
  .object({
    task_id: z.string().min(1, "Task ID is required").describe("The task ID returned by kie_generate_image or kie_edit_image"),
  })
  .strict();

server.registerTool(
  "kie_get_task_status",
  {
    title: "Get Kie AI Task Status",
    description: `Check the status of a Kie AI generation or editing task and retrieve the result.

Task states:
- \`waiting\` — Still processing. Poll again in a few seconds.
- \`success\` — Done! Result URLs are included.
- \`fail\` — Failed. Error details are included.

Args:
  - task_id (string, required): The task ID from kie_generate_image or kie_edit_image

Returns: Task status with result URLs (on success) or error details (on failure).`,
    inputSchema: GetTaskStatusInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const result = await client.getTaskStatus(params.task_id);

      const lines = [
        `**Task Status**: ${result.state}`,
        `**Model**: ${result.model}`,
        `**Task ID**: \`${result.taskId}\``,
        `**Created**: ${result.createdAt}`,
      ];

      if (result.state === "success") {
        if (result.completedAt) lines.push(`**Completed**: ${result.completedAt}`);
        if (result.costTimeMs) lines.push(`**Processing time**: ${(result.costTimeMs / 1000).toFixed(1)}s`);
        if (result.resultUrls?.length) {
          lines.push("", "**Result URLs**:");
          for (const url of result.resultUrls) {
            lines.push(`- ${url}`);
          }
        }
        if (result.resultObject) {
          lines.push("", "**Result**:", "```json", JSON.stringify(result.resultObject, null, 2), "```");
        }
      } else if (result.state === "fail") {
        lines.push("");
        if (result.failCode) lines.push(`**Error code**: ${result.failCode}`);
        if (result.failMsg) lines.push(`**Error**: ${result.failMsg}`);
      } else {
        lines.push("", "Task is still processing. Call `kie_get_task_status` again in a few seconds.");
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Kie AI MCP Server running via stdio");
  console.error(`Models available: ${getAllModelIds().length}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
