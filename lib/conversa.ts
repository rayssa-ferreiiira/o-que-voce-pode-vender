import { db } from "./db";
import { anthropic, MODELO_ANOTADOR, MODELO_RAY, pedirJson, registrarUso, semTravessao } from "./ia";
import { notaRay, PROMPT_ANOTADOR, PROMPT_RAY, SCHEMA_ANOTADOR } from "./prompts";
import { MAX_MENSAGENS_CLIENTE, type Conversa } from "./sessao";
import type { Estado, Mensagem, Provas } from "./tipos";

export const FRASES_INICIO = [
  "Sei fazer muita coisa, mas não sei o que poderia vender",
  "Será que alguém pagaria pelo que eu sei?",
  "Quero criar algo meu, mas não sei por onde começar",
];

export const FALA_EMAIL = "Que bom que soa como você. Agora coloca seu email aqui embaixo: é ele que libera e guarda o seu Mapa de Possibilidades. Enquanto isso, eu já começo a montar.";

type Anotacao = {
  nome: string;
  situacoes: Provas["situacoes"];
  padroes: string[];
  demanda: string;
  jeitoAtuar: string;
  publico: string;
  tempo: string;
  foraDoTrabalho: boolean;
  mesmaCena: boolean;
  trocasSemDevolutiva: number;
  confirmou: boolean;
  pediuAjuste: boolean;
  nota: string;
};

const distintos = (v: string[]) => new Set(v.map((s) => s.trim().toLowerCase()).filter(Boolean)).size;

export function historiasComResultado(p?: Provas) {
  return p ? distintos(p.situacoes.filter((s) => s.situacao.trim() && s.resultado.trim()).map((s) => s.momento || s.situacao)) : 0;
}

export function provasSuficientes(p?: Provas): boolean {
  return Boolean(p && historiasComResultado(p) >= 3 && distintos(p.padroes) >= 2 && p.demanda.trim() && p.jeitoAtuar.trim() && p.publico.trim() && p.foraDoTrabalho);
}

function faltando(p?: Provas): string {
  if (!p || historiasComResultado(p) < 3) return "Ainda falta material concreto, mas não peça de novo 'uma situação'. Chegue por outro ângulo: quem procura ela e pra quê, o que ela faz fácil e os outros travam, alguém que ela ajudou a crescer, o começo da carreira, algo fora do trabalho. A história vem junto.";
  if (distintos(p.padroes) < 2) return "Já tem histórias de fases diferentes. Antes de pedir mais, devolva em voz alta os fios que ligam essas histórias.";
  if (!p.demanda.trim()) return "Falta entender quem procura ela e com que pedido concreto. Puxe isso a partir das histórias.";
  if (!p.jeitoAtuar.trim()) return "Falta entender como ela gosta de ajudar: naquela história ela fez por alguém, fez junto ou mostrou o caminho? Puxe naturalmente.";
  if (!p.publico.trim()) return "Falta conhecer a pessoa que mais se beneficiaria e o momento em que ela está. Devolva o que já aparece e investigue esse contexto.";
  return "Antes de fechar, abra uma vez a porta para a vida fora do trabalho, com exemplos dentro de uma pergunta natural. Se não render, siga para o fechamento.";
}

const clientes = (m: Mensagem[]) => m.filter((x) => x.autor === "cliente").length;

/** monta a nota que a Ray recebe na próxima fala, a partir do anotador e de regras fixas */
export function montarNota(c: { nome: string; mensagens: Mensagem[]; fase: string }, a: Anotacao | null, provas: Provas | undefined): string {
  const nome = c.nome || a?.nome || "";
  if (!nome) return "Você ainda não sabe o nome dela. Acolha o que ela trouxe em uma ou duas frases e pergunte só o primeiro nome, de forma leve.";
  const partes: string[] = [];
  if (a?.nota) partes.push(a.nota);
  if (c.fase === "hipotese") {
    if (a?.pediuAjuste) partes.push("Ela pediu um ajuste na frase. Ajuste palavra por palavra, sem recomeçar, e apresente a frase ajustada em negrito numa linha própria, perguntando se agora soa como ela.");
    else partes.push("A frase da hipótese já foi apresentada. Responda ao que ela trouxe e, se mudar alguma palavra, apresente a frase nova em negrito. Senão, não repita a frase inteira.");
    return partes.join(" ");
  }
  if (a?.mesmaCena) partes.push("Chega dessa cena. Proponha o que você está enxergando e amplie para outra situação ou fase.");
  if ((a?.trocasSemDevolutiva ?? 0) >= 5) partes.push("Já faz várias trocas sem devolutiva. Faça agora uma mini devolutiva do que está ficando claro, em 2 ou 3 frases.");
  if (provas && !provas.foraDoTrabalho && historiasComResultado(provas) >= 2) partes.push("Se fizer sentido agora, abra uma vez a porta para a vida fora do trabalho, com exemplos dentro de uma pergunta natural.");
  if (provasSuficientes(provas)) {
    partes.push("Você já tem material para fechar. Faça a devolutiva das possibilidades que a conversa sustenta, comparando os sinais, e apresente a hipótese prioritária em negrito numa linha própria, no formato [área] pra [quem], com o porquê e a pergunta se soa como ela.");
  } else if (clientes(c.mensagens) >= 20) {
    partes.push("A conversa já está longa. Feche agora com o que tem: devolva as possibilidades, diga com honestidade onde há pouca informação e apresente a hipótese prioritária em negrito numa linha própria, perguntando se soa como ela.");
  } else {
    partes.push(faltando(provas));
  }
  return partes.join(" ");
}

export async function anotar(c: Conversa, mensagens: Mensagem[]): Promise<Anotacao | null> {
  const transcricao = mensagens.map((m) => `${m.autor === "ray" ? "Ray" : "Cliente"}: ${m.texto}`).join("\n\n");
  try {
    return await pedirJson<Anotacao>({
      conversaId: c.id,
      tipo: "anotador",
      modelo: MODELO_ANOTADOR,
      system: PROMPT_ANOTADOR,
      user: `Conversa até agora:\n\n${transcricao}`,
      schema: SCHEMA_ANOTADOR,
      maxTokens: 6000,
      esforco: "low",
    });
  } catch (e) {
    console.error("anotador", e);
    return null;
  }
}

export function provasDe(a: Anotacao): Provas {
  return { situacoes: a.situacoes ?? [], padroes: a.padroes ?? [], demanda: a.demanda ?? "", jeitoAtuar: a.jeitoAtuar ?? "", publico: a.publico ?? "", tempo: a.tempo ?? "", foraDoTrabalho: Boolean(a.foraDoTrabalho) };
}

/** extrai a frase em negrito, se a Ray apresentou a hipótese */
export function fraseEmNegrito(texto: string): string {
  const m = [...texto.matchAll(/\*\*(.+?)\*\*/g)].map((x) => x[1].trim()).filter((x) => / pra | para /i.test(x) && x.split(/\s+/).length <= 20);
  return m.at(-1) ?? "";
}

function paraMensagensApi(m: Mensagem[]) {
  const saida: { role: "user" | "assistant"; content: string }[] = [];
  for (const x of m) {
    const role = x.autor === "ray" ? "assistant" : "user";
    const ultimo = saida.at(-1);
    if (ultimo && ultimo.role === role) ultimo.content += "\n\n" + x.texto;
    else saida.push({ role, content: x.texto });
  }
  if (saida[0]?.role === "assistant") saida.unshift({ role: "user", content: "Oi" });
  return saida;
}

/** a fala da Ray em streaming */
export async function falarRay(c: Conversa, mensagens: Mensagem[], nota: string, onDelta: (t: string) => void): Promise<string> {
  const inicio = Date.now();
  const stream = anthropic().messages.stream({
    model: MODELO_RAY,
    max_tokens: 4000,
    output_config: { effort: "low" },
    system: [
      { type: "text", text: PROMPT_RAY, cache_control: { type: "ephemeral" } },
      { type: "text", text: notaRay(nota) },
    ],
    messages: paraMensagensApi(mensagens),
  });
  let texto = "";
  let pendente = "";
  stream.on("text", (d) => {
    texto += d;
    // segura travessões que chegam picados
    pendente += d;
    const limpo = semTravessao(pendente);
    if (!/[—–]\s*$|\s$/.test(pendente) || pendente.length > 40) {
      onDelta(limpo);
      pendente = "";
    }
  });
  const final = await stream.finalMessage();
  if (pendente) onDelta(semTravessao(pendente));
  await registrarUso(c.id, "conversa", MODELO_RAY, final.usage, Date.now() - inicio);
  return semTravessao(texto).trim();
}

export async function salvarConversa(id: string, patch: Partial<{ nome: string; mensagens: Mensagem[]; estado: Estado; fase: string; mapa_status: string; email: string }>) {
  const sql = await db();
  const campos: Record<string, unknown> = { ...patch, atualizado: new Date() };
  if (patch.mensagens) campos.mensagens = sql.json(patch.mensagens as never);
  if (patch.estado) campos.estado = sql.json(patch.estado as never);
  await sql`update conversas set ${sql(campos)} where id = ${id}`;
}

export { clientes, MAX_MENSAGENS_CLIENTE };
