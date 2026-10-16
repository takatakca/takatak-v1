export type SeoToolMode = "live" | "generator" | "text" | "provider";
export type SeoToolCategory = "AI Visibility & GEO" | "Technical SEO" | "On-Page & Content" | "Keywords & Competitors";
export type SeoTool = { id: string; title: string; description: string; category: SeoToolCategory; mode: SeoToolMode };
export const SEO_FREE_TOOLS: readonly SeoTool[] = [
  { id:"geo-audit",title:"GEO Audit",description:"Assess crawlability, metadata and structured-content readiness for AI discovery. Not an AI ranking measurement.",category:"AI Visibility & GEO",mode:"live" },
  { id:"ai-search-audit",title:"AI Search Audit",description:"Provider-backed tests of actual answers across AI assistants; results require verified sampling.",category:"AI Visibility & GEO",mode:"provider" },
  { id:"chatgpt-visibility-checker",title:"ChatGPT Visibility Checker",description:"Observe real ChatGPT Search citations once a supported observation provider is connected.",category:"AI Visibility & GEO",mode:"provider" },
  { id:"llm-citation-checker",title:"LLM Citation Checker",description:"Track citations by prompt and assistant with evidence, not guesses.",category:"AI Visibility & GEO",mode:"provider" },
  { id:"ai-seo-audit",title:"AI SEO Audit",description:"Review public-page technical signals relevant to search and retrieval.",category:"AI Visibility & GEO",mode:"live" },
  { id:"ai-overview-checker",title:"AI Overview Checker",description:"Observe Google's AI Overviews for measured queries where providers allow.",category:"AI Visibility & GEO",mode:"provider" },
  { id:"perplexity-ranking-checker",title:"Perplexity Ranking Checker",description:"Measure actual Perplexity citations from recorded answers.",category:"AI Visibility & GEO",mode:"provider" },
  { id:"google-index-checker",title:"Google Index Checker",description:"Verify your own URL with Google Search Console indexing data. No site: guesswork.",category:"Technical SEO",mode:"provider" },
  { id:"robots-checker",title:"Robots.txt Checker",description:"Read the live robots.txt, show directives and detect site-wide crawl blocking.",category:"Technical SEO",mode:"live" },
  { id:"robots-generator",title:"Robots.txt Generator",description:"Build and copy a crawl policy template with an optional AI crawler block.",category:"Technical SEO",mode:"generator" },
  { id:"sitemap-checker",title:"Sitemap Checker",description:"Check sitemap availability, XML type, URL count and cross-domain locations in a capped sample.",category:"Technical SEO",mode:"live" },
  { id:"canonical-checker",title:"Canonical Checker",description:"Read a page's declared canonical and compare its hostname and path.",category:"Technical SEO",mode:"live" },
  { id:"schema-generator",title:"Schema Markup Generator",description:"Create copyable JSON-LD for a truthful organization or website description.",category:"Technical SEO",mode:"generator" },
  { id:"llms-generator",title:"llms.txt Generator",description:"Create a draft Markdown discovery document; llms.txt adoption is voluntary.",category:"Technical SEO",mode:"generator" },
  { id:"llms-validator",title:"llms.txt Validator",description:"Check basic Markdown headings and link syntax in pasted llms.txt.",category:"Technical SEO",mode:"text" },
  { id:"ai-readability-checker",title:"AI Readability Checker",description:"Assess page title, H1, summary, text depth and semantic signals; heuristic only.",category:"On-Page & Content",mode:"live" },
  { id:"h1-checker",title:"H1 Checker",description:"Inspect visible H1 headings on a public page.",category:"On-Page & Content",mode:"live" },
  { id:"keyword-density-checker",title:"Keyword Density Checker",description:"Count single- and multiword keyword phrases from pasted text.",category:"On-Page & Content",mode:"text" },
  { id:"meta-description-checker",title:"Meta Description Checker",description:"Inspect a live page's meta description and its length.",category:"On-Page & Content",mode:"live" },
  { id:"serp-snippet-preview",title:"SERP Snippet Preview",description:"Preview a title and description; actual Google snippets and pixel truncation vary.",category:"On-Page & Content",mode:"generator" },
  { id:"open-graph-checker",title:"Open Graph Checker",description:"Check Open Graph and Twitter Card metadata on a live page.",category:"On-Page & Content",mode:"live" },
  { id:"missing-keywords",title:"Missing Keywords",description:"Compare real keyword evidence and competitor research after providers are connected.",category:"Keywords & Competitors",mode:"provider" },
  { id:"seo-competitor-analysis",title:"SEO Competitor Analysis",description:"Compare two domains using authorized keyword and backlink datasets.",category:"Keywords & Competitors",mode:"provider" },
];
export const SEO_CATEGORIES: SeoToolCategory[] = ["AI Visibility & GEO","Technical SEO","On-Page & Content","Keywords & Competitors"];
