/**
 * Kie AI Model Registry
 *
 * All models use the same API pattern:
 *   POST https://api.kie.ai/api/v1/jobs/createTask  { model, input }
 *   GET  https://api.kie.ai/api/v1/jobs/recordInfo?taskId=...
 *
 * The only differences are the model identifier and accepted input parameters.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModelCapability = "text-to-image" | "image-to-image" | "image-edit";

export interface ModelParam {
  name: string;
  type: "string" | "boolean" | "number" | "string[]";
  required: boolean;
  description: string;
  options?: string[];
  default?: string | boolean | number;
  maxLength?: number;
  maxFiles?: number;
  maxFileSize?: string;
}

export interface ModelDefinition {
  id: string;
  name: string;
  description: string;
  capabilities: ModelCapability[];
  params: ModelParam[];
  /** Credits per generation (approximate) */
  creditsCost?: string;
}

// ---------------------------------------------------------------------------
// Shared parameter builders (DRY)
// ---------------------------------------------------------------------------

const promptParam = (opts?: Partial<ModelParam>): ModelParam => ({
  name: "prompt",
  type: "string",
  required: true,
  description: "Text description of the image to generate",
  maxLength: 5000,
  ...opts,
});

const aspectRatio8 = (def = "1:1"): ModelParam => ({
  name: "aspect_ratio",
  type: "string",
  required: false,
  description: "Aspect ratio of the output image",
  options: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
  default: def,
});

const aspectRatio7 = (def = "1:1"): ModelParam => ({
  name: "aspect_ratio",
  type: "string",
  required: false,
  description: "Aspect ratio of the output image",
  options: ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"],
  default: def,
});

const aspectRatioWithAuto = (def = "1:1"): ModelParam => ({
  name: "aspect_ratio",
  type: "string",
  required: false,
  description: "Aspect ratio. Use 'auto' to match the first input image ratio.",
  options: ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "auto"],
  default: def,
});

const resolution3 = (def = "1K"): ModelParam => ({
  name: "resolution",
  type: "string",
  required: false,
  description: "Output resolution",
  options: ["1K", "2K", "4K"],
  default: def,
});

const resolution2 = (def = "1K"): ModelParam => ({
  name: "resolution",
  type: "string",
  required: false,
  description: "Output resolution",
  options: ["1K", "2K"],
  default: def,
});

const outputFormat = (def = "png"): ModelParam => ({
  name: "output_format",
  type: "string",
  required: false,
  description: "Output image format",
  options: ["png", "jpg"],
  default: def,
});

const quality = (def = "basic"): ModelParam => ({
  name: "quality",
  type: "string",
  required: false,
  description: "Quality level. Basic outputs 2K, High outputs 4K.",
  options: ["basic", "high"],
  default: def,
});

const nsfwChecker = (def = true): ModelParam => ({
  name: "nsfw_checker",
  type: "boolean",
  required: false,
  description: "Enable NSFW content checker. Enabled by default in Playground; for API you can toggle.",
  default: def,
});

const imageInput = (opts?: Partial<ModelParam>): ModelParam => ({
  name: "image_input",
  type: "string[]",
  required: false,
  description: "URLs of input images to use as reference (supports up to 8 images)",
  maxFiles: 8,
  maxFileSize: "30MB",
  ...opts,
});

const imageUrls = (opts?: Partial<ModelParam>): ModelParam => ({
  name: "image_urls",
  type: "string[]",
  required: true,
  description: "URLs of input images for editing",
  maxFiles: 5,
  maxFileSize: "10MB",
  ...opts,
});

const inputUrls = (opts?: Partial<ModelParam>): ModelParam => ({
  name: "input_urls",
  type: "string[]",
  required: true,
  description: "URLs of input reference images (1-8 images)",
  maxFiles: 8,
  maxFileSize: "10MB",
  ...opts,
});

// ---------------------------------------------------------------------------
// Model Registry
// ---------------------------------------------------------------------------

export const MODEL_REGISTRY: ModelDefinition[] = [
  // =========================================================================
  // NANO BANANA FAMILY
  // =========================================================================
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    description: "Google DeepMind's Nano Banana Pro — sharper 2K imagery, intelligent 4K scaling, improved text rendering, and enhanced character consistency. Supports up to 8 reference images.",
    capabilities: ["text-to-image", "image-to-image"],
    creditsCost: "18 credits (~$0.09) for 1K/2K, 24 credits (~$0.12) for 4K",
    params: [
      promptParam({ maxLength: 20000 }),
      imageInput(),
      aspectRatio8(),
      resolution3(),
      outputFormat(),
    ],
  },
  {
    id: "google/nano-banana",
    name: "Nano Banana",
    description: "Google's Gemini-based image generation model. Good general-purpose generation.",
    capabilities: ["text-to-image", "image-to-image"],
    creditsCost: "4 credits (~$0.02)",
    params: [
      promptParam({ maxLength: 1000 }),
      imageInput({ maxFiles: 5 }),
      aspectRatio8(),
      resolution2(),
      outputFormat(),
    ],
  },
  {
    id: "google/nano-banana-edit",
    name: "Nano Banana Edit",
    description: "Google's Gemini-based image editing model. Natural language image editing.",
    capabilities: ["image-edit"],
    creditsCost: "4 credits (~$0.02)",
    params: [
      promptParam({ maxLength: 1000, description: "Natural language description of the edit to apply" }),
      imageUrls({ name: "image_urls", maxFiles: 5, description: "URLs of images to edit" }),
    ],
  },
  {
    id: "nano-banana-2",
    name: "Nano Banana 2",
    description: "Second generation Nano Banana model with improved quality.",
    capabilities: ["text-to-image", "image-to-image"],
    params: [
      promptParam(),
      imageInput(),
      aspectRatio8(),
      resolution2(),
      outputFormat(),
    ],
  },

  // =========================================================================
  // SEEDREAM FAMILY
  // =========================================================================
  {
    id: "seedream/4.5-text-to-image",
    name: "Seedream 4.5 Text-to-Image",
    description: "ByteDance's Seedream 4.5 text-to-image model. High-quality generation with 2K (basic) or 4K (high) output.",
    capabilities: ["text-to-image"],
    creditsCost: "~10 credits for basic, ~20 for high",
    params: [
      promptParam({ maxLength: 3000 }),
      aspectRatio7(),
      quality(),
      nsfwChecker(),
    ],
  },
  {
    id: "seedream/5-lite-text-to-image",
    name: "Seedream 5 Lite Text-to-Image",
    description: "ByteDance's Seedream 5 Lite text-to-image model. Lightweight yet high-quality generation with 2K (basic) or 4K (high) output.",
    capabilities: ["text-to-image"],
    params: [
      promptParam({ maxLength: 3000 }),
      aspectRatio7(),
      quality("high"),
      nsfwChecker(),
    ],
  },
  {
    id: "seedream/5-lite-image-to-image",
    name: "Seedream 5 Lite Image-to-Image",
    description: "ByteDance's Seedream 5 Lite image-to-image model. Transform images with natural language — change lighting, styles, effects, and more.",
    capabilities: ["image-to-image"],
    params: [
      promptParam({ maxLength: 3000 }),
      imageUrls({ maxFileSize: "10MB" }),
      aspectRatio7(),
      quality("high"),
      nsfwChecker(),
    ],
  },
  {
    id: "seedream/4.5-edit",
    name: "Seedream 4.5 Edit",
    description: "ByteDance's Seedream 4.5 image editing model. Edit images with natural language — change materials, lighting, styles, etc.",
    capabilities: ["image-edit"],
    creditsCost: "~10 credits for basic, ~20 for high",
    params: [
      promptParam({ maxLength: 3000, description: "Natural language description of the edit to apply" }),
      imageUrls({ maxFileSize: "10MB" }),
      aspectRatio7(),
      quality(),
      nsfwChecker(),
    ],
  },

  // =========================================================================
  // FLUX 2 FAMILY
  // =========================================================================
  {
    id: "flux-2/pro-text-to-image",
    name: "Flux 2 Pro Text-to-Image",
    description: "Black Forest Labs' Flux 2 — photoreal detail, strong multi-reference consistency, accurate text rendering.",
    capabilities: ["text-to-image"],
    creditsCost: "5 credits (~$0.025) for 1K, 7 credits (~$0.035) for 2K",
    params: [
      promptParam({ maxLength: 5000 }),
      { ...aspectRatioWithAuto(), options: ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9"] },
      resolution2(),
      nsfwChecker(),
    ],
  },
  {
    id: "flux-2/pro-image-to-image",
    name: "Flux 2 Pro Image-to-Image",
    description: "Flux 2 image-to-image — transform images with up to 8 reference inputs. Great for style transfer, outfit changes, etc.",
    capabilities: ["image-to-image"],
    creditsCost: "5 credits (~$0.025) for 1K, 7 credits (~$0.035) for 2K",
    params: [
      inputUrls(),
      promptParam({ maxLength: 5000 }),
      aspectRatioWithAuto("4:3"),
      resolution2(),
      nsfwChecker(),
    ],
  },
  {
    id: "flux-2/flex-text-to-image",
    name: "Flux 2 Flex Text-to-Image",
    description: "Flux 2 Flex variant — flexible text-to-image generation with good quality/cost ratio.",
    capabilities: ["text-to-image"],
    params: [
      promptParam({ maxLength: 5000 }),
      aspectRatioWithAuto(),
      resolution2(),
      nsfwChecker(),
    ],
  },
  {
    id: "flux-2/flex-image-to-image",
    name: "Flux 2 Flex Image-to-Image",
    description: "Flux 2 Flex image-to-image variant — flexible transformations at lower cost.",
    capabilities: ["image-to-image"],
    params: [
      inputUrls(),
      promptParam({ maxLength: 5000 }),
      aspectRatioWithAuto(),
      resolution2(),
      nsfwChecker(),
    ],
  },
  {
    id: "flux-1/kontext",
    name: "Flux 1 Kontext",
    description: "Flux 1 Kontext — context-aware image generation with reference image support.",
    capabilities: ["text-to-image", "image-to-image"],
    params: [
      promptParam({ maxLength: 5000 }),
      imageInput({ maxFiles: 4 }),
      aspectRatio8(),
      resolution2(),
      nsfwChecker(),
    ],
  },

  // =========================================================================
  // GOOGLE IMAGEN
  // =========================================================================
  {
    id: "imagen-4",
    name: "Imagen 4",
    description: "Google's Imagen 4 — high-fidelity photorealistic image generation with excellent text rendering.",
    capabilities: ["text-to-image"],
    params: [
      promptParam(),
      aspectRatio8(),
      resolution2(),
      outputFormat(),
    ],
  },

  // =========================================================================
  // IDEOGRAM
  // =========================================================================
  {
    id: "ideogram/v3",
    name: "Ideogram V3",
    description: "Ideogram V3 — excellent at generating images with accurate text and typography.",
    capabilities: ["text-to-image"],
    params: [
      promptParam(),
      aspectRatio8(),
      resolution2(),
      outputFormat(),
    ],
  },
  {
    id: "ideogram/character",
    name: "Ideogram Character",
    description: "Ideogram Character — specialized in consistent character generation across images.",
    capabilities: ["text-to-image", "image-to-image"],
    params: [
      promptParam(),
      imageInput({ maxFiles: 4 }),
      aspectRatio8(),
      resolution2(),
      outputFormat(),
    ],
  },

  // =========================================================================
  // OTHER MODELS
  // =========================================================================
  {
    id: "4o-image",
    name: "4o Image API",
    description: "OpenAI 4o-based image generation via Kie AI.",
    capabilities: ["text-to-image"],
    params: [
      promptParam(),
      aspectRatio8(),
      resolution2(),
      outputFormat(),
    ],
  },
  {
    id: "qwen/image-edit",
    name: "Qwen Image Edit",
    description: "Alibaba's Qwen image editing model — edit images with natural language instructions.",
    capabilities: ["image-edit"],
    params: [
      promptParam({ description: "Natural language description of the edit to apply" }),
      imageUrls(),
      aspectRatio8(),
    ],
  },
  {
    id: "z-image",
    name: "Z-Image",
    description: "Z-Image generation model available on Kie AI.",
    capabilities: ["text-to-image"],
    params: [
      promptParam(),
      aspectRatio8(),
      resolution2(),
      outputFormat(),
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getModelById(id: string): ModelDefinition | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

export function getModelsByCapability(capability: ModelCapability): ModelDefinition[] {
  return MODEL_REGISTRY.filter((m) => m.capabilities.includes(capability));
}

export function getAllModelIds(): string[] {
  return MODEL_REGISTRY.map((m) => m.id);
}

export function getGenerationModels(): ModelDefinition[] {
  return MODEL_REGISTRY.filter(
    (m) => m.capabilities.includes("text-to-image") || m.capabilities.includes("image-to-image")
  );
}

export function getEditModels(): ModelDefinition[] {
  return MODEL_REGISTRY.filter((m) => m.capabilities.includes("image-edit"));
}
