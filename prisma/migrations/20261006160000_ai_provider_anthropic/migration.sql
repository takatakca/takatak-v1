-- AI Studio live generation can use Anthropic (Claude) as well as OpenAI.
ALTER TYPE "AiProvider" ADD VALUE IF NOT EXISTS 'anthropic';
