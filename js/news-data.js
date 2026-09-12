// Curated Frontier Observatory feed.
// Each item links back to a primary source and to the lab it connects to.
// Update this list as new model/protocol releases land — keep it evidence-linked.
export const NEWS = [
  {
    date: "2026-09-03",
    org: "OpenAI",
    title: "GPT-6 Astra",
    summary:
      "OpenAI's most capable broadly deployed model to date, with major capability and safety-monitoring changes.",
    tag: "Reasoning & Agents",
    labId: "generation",
    evidence: "Official model announcement",
    url: "https://openai.com/index/gpt-6-astra/",
  },
  {
    date: "2026-09-10",
    org: "OpenAI",
    title: "GPT-Live-1",
    summary:
      "Full-duplex voice model launched in the API for real-time speech and telephony-style agents.",
    tag: "Speech / Streaming",
    labId: "generation",
    evidence: "Official model announcement",
    url: "https://openai.com/index/introducing-gpt-live-1-in-the-api/",
  },
  {
    date: "2026-09-02",
    org: "Google DeepMind",
    title: "Gemini 3.8 Flash & Flash Cyber",
    summary:
      "Fast multimodal/agentic models with a cybersecurity-focused variant, aimed at coding and agentic workflows.",
    tag: "Multimodal / Agents",
    labId: "attention",
    evidence: "Official model card",
    url: "https://deepmind.google/models/model-cards/gemini-3-8-flash/",
  },
  {
    date: "2026",
    org: "Anthropic",
    title: "Claude Opus 4.6 / 4.7",
    summary:
      "Long-running agentic coding releases; Opus 4.6 introduced a 1M-token context beta for large-context workflows.",
    tag: "Context / Coding Agents",
    labId: "vectors",
    evidence: "Official model announcement",
    url: "https://www.anthropic.com/news/claude-opus-4-7",
  },
  {
    date: "2026-07-28",
    org: "Model Context Protocol",
    title: "MCP 2026-07-28 Specification",
    summary:
      "A major revision toward a stateless, routable, cacheable protocol core with hardened authorization.",
    tag: "Tool Protocols",
    labId: "tokenizer",
    evidence: "Official spec changelog",
    url: "https://blog.modelcontextprotocol.io/posts/2026-07-28/",
  },
  {
    date: "2026",
    org: "Stanford HAI",
    title: "AI Index 2026",
    summary:
      "Reports benchmark saturation, declining frontier transparency, and a widening capability/governance gap.",
    tag: "Evaluation & Safety",
    labId: "neuron",
    evidence: "Independent research report",
    url: "https://hai.stanford.edu/ai-index/2026-ai-index-report/technical-performance",
  },
];
