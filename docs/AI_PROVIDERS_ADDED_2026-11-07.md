# AI providers added on 2026-11-07

Endpoints were checked against each provider's official docs and public model lists on 2026-11-07.

## Text engines: they answer in TAK-TAK for every client workspace once their key is saved
| Engine | Key (Admin › AI provider keys, or env) | Default model (override `TAKBOT_MODEL_<KEY>`) | Key test |
|---|---|---|---|
| Kimi (Moonshot AI) | `MOONSHOT_API_KEY` (platform.kimi.ai) | kimi-k3.1-pro | balance (read-only) |
| GLM (Z.ai) | `ZAI_API_KEY` | glm-5.3 | none documented |
| Together AI | `TOGETHER_API_KEY` | moonshotai/Kimi-K3 | model list |
| OpenRouter | `OPENROUTER_API_KEY` | openai/gpt-oss-120b | none (public list) |
| Cerebras | `CEREBRAS_API_KEY` | qwen-3.8-27b | none documented |
| SambaNova | `SAMBANOVA_API_KEY` | Meta-Llama-3.3-70B-Instruct | none (public list) |
| DeepInfra | `DEEPINFRA_API_KEY` | deepseek-ai/DeepSeek-V4-Flash-0731 | none (public list) |

On "Auto" they come last in the order, so they answer only when the earlier engines have no key.

## Media providers: key slots only, generation comes in a later AI Studio step
| Provider | Kind | Key | Key test |
|---|---|---|---|
| Luma AI | video, images | `LUMA_API_KEY` | credits (read-only) |
| FLUX (Black Forest Labs) | images | `BFL_API_KEY` | none documented |
| Ideogram | images with text | `IDEOGRAM_API_KEY` | none documented |
| Deepgram | transcription, voice | `DEEPGRAM_API_KEY` | not automated (Token scheme) |
| AssemblyAI | transcription | `ASSEMBLYAI_API_KEY` | none documented |
| Mureka | songs with vocals | `MUREKA_API_KEY` | docs to confirm |

- **ElevenLabs Music** uses the existing ElevenLabs key.
- **Stable Audio** uses the Stability AI key.
- **Suno** and **Songer** have no public API (Songer's terms forbid automated access), so they cannot be connected.

## Not added (docs incomplete)
- **Fireworks:** no current model id in the docs.
- **Alibaba Qwen:** base URL only in the console.
- **Midjourney:** no API.
