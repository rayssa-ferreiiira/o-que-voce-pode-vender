import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";

export const MODELO_RAY = process.env.MODELO_RAY || "claude-sonnet-5-5";
export const MODELO_ANOTADOR = process.env.MODELO_ANOTADOR || "claude-haiku-5-5";
export const MODELO_MAPA = process.env.MODELO_MAPA || "claude-sonnet-5-5";

/** US$ por milhão de tokens (platform.claude.com/docs/en/about-claude/pricing, out/2026) */
export const PRECOS: Record<string, { entrada: number; saida: number; cacheEscrita: number; cacheLeitura: number }> = {
  "claude-opus-5-5": { entrada: 4, saida: 20, cacheEscrita: 5, cacheLeitura: 0.2 },
  "claude-sonnet-5-5": { entrada: 2, saida: 10, cacheEscrita: 2.5, cacheLeitura: 0.1 },
  "claude-haiku-5-5": { entrada: 0.1, saida: 0.5, cacheEscrita: 0.125, cacheLeitura: 0.01 },
};

let _cliente: Anthropic | null = null;
export function anthropic() {
  if (!_cliente) _cliente = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? "").replace(/[^\x21-\x7e]/g, "") });
  return _cliente;
}

type Uso = { input_tokens?: number | null; output_tokens?: number | null; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null };

export function custoUsd(modelo: string, u: Uso) {
  const p = PRECOS[modelo] ?? PRECOS["claude-sonnet-5-5"];
  return ((u.input_tokens ?? 0) * p.entrada + (u.output_tokens ?? 0) * p.saida + (u.cache_creation_input_tokens ?? 0) * p.cacheEscrita + (u.cache_read_input_tokens ?? 0) * p.cacheLeitura) / 1_000_000;
}

export async function registrarUso(conversaId: string | null, tipo: string, modelo: string, u: Uso, ms: number) {
  try {
    const sql = await db();
    await sql`insert into uso_ia (conversa_id, tipo, modelo, entrada, saida, cache_escrita, cache_leitura, custo_usd, ms)
      values (${conversaId}, ${tipo}, ${modelo}, ${u.input_tokens ?? 0}, ${u.output_tokens ?? 0}, ${u.cache_creation_input_tokens ?? 0}, ${u.cache_read_input_tokens ?? 0}, ${custoUsd(modelo, u)}, ${ms})`;
  } catch (e) {
    console.error("uso_ia", e);
  }
}

/** remove palavras do JSON Schema que a saída estruturada não aceita */
function schemaLimpo(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(schemaLimpo);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([k]) => !["minimum", "maximum"].includes(k)).map(([k, x]) => [k, schemaLimpo(x)]));
  return v;
}

export type Esforco = "low" | "medium" | "high";

/** pede um objeto estruturado com saída em JSON Schema */
export async function pedirJson<T>(opts: {
  conversaId: string | null;
  tipo: string;
  modelo: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  esforco?: Esforco;
}): Promise<T> {
  const inicio = Date.now();
  const r = await anthropic().messages.create({
    model: opts.modelo,
    max_tokens: opts.maxTokens ?? 8000,
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    output_config: { effort: opts.esforco ?? "low", format: { type: "json_schema", schema: schemaLimpo(opts.schema) as Record<string, unknown> } },
    messages: [{ role: "user", content: opts.user }],
  });
  await registrarUso(opts.conversaId, opts.tipo, opts.modelo, r.usage, Date.now() - inicio);
  const texto = r.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  if (!texto.trim()) throw new Error(`resposta vazia (${r.stop_reason})`);
  return JSON.parse(texto) as T;
}

/** tira travessões de qualquer texto que vá pra cliente */
export const semTravessao = (t: string) => t.replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",");
