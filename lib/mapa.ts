import { db } from "./db";
import { MODELO_MAPA, pedirJson } from "./ia";
import { CAMPOS_MAPA, PROMPT_MAPA } from "./prompts";
import { buscarConversa } from "./sessao";
import { MODELOS, TEMAS, type Mapa, type MapaParcial } from "./tipos";

const str = { type: "string" };
const arr = { type: "array", items: str };
const nota = { type: "integer", minimum: 0, maximum: 3 };
const obj = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });

const SCHEMAS: Record<string, unknown> = {
  nome: str,
  hipotese: obj({ frase: str, porque: str }),
  sintese: str,
  trajetoria: { type: "array", items: obj({ periodo: str, situacao: str, oQueFez: str, resultado: str }) },
  padroes: { type: "array", items: obj({ padrao: str, evidencias: arr, historias: { type: "array", items: { type: "integer", minimum: 0, maximum: 4 } } }) },
  resolve: arr,
  sinaisDemanda: { type: "array", items: obj({ sinal: str, tipo: { type: "string", enum: ["procura", "pagamento", "problema recorrente", "reconhecimento"] } }) },
  possibilidades: { type: "array", items: obj({ direcao: str, sinais: obj({ experiencia: nota, reconhecimento: nota, publico: nota, aplicacao: nota }), fundamentos: arr }) },
  modelos: { type: "array", items: obj({ modelo: { type: "string", enum: [...MODELOS] }, aderencia: nota, porque: str, comoSeria: str }) },
  modeloRecomendado: { type: "string", enum: [...MODELOS] },
  publico: obj({ quem: str, momento: str, ondeEsta: str, frase: str, precisa: str }),
  credibilidade: arr,
  descobrir: { type: "array", items: obj({ tema: { type: "string", enum: [...TEMAS] }, pergunta: str }) },
  lacunas: { type: "array", items: obj({ secao: str, texto: str }) },
};

const GRUPO_A = ["nome", "hipotese", "sintese", "trajetoria", "padroes", "resolve", "sinaisDemanda", "lacunas"] as const;
const GRUPO_B = ["possibilidades", "modelos", "modeloRecomendado", "publico", "credibilidade", "descobrir", "lacunas"] as const;

function schemaDe(campos: readonly string[]) {
  return obj(Object.fromEntries(campos.map((c) => [c, SCHEMAS[c]])));
}

function instrucoes(campos: readonly string[]) {
  return campos.map((c) => `- ${c}: ${CAMPOS_MAPA[c as keyof typeof CAMPOS_MAPA]}`).join("\n");
}

/** limpa travessão e ponto e vírgula de qualquer string do objeto */
function limpar<T>(v: T): T {
  if (typeof v === "string") return v.replace(/\s*[—–]\s*/g, ", ").replace(/\s*;\s*/g, ". ").replace(/\.\s*\./g, ".").trim() as T;
  if (Array.isArray(v)) return v.map(limpar) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, limpar(x)])) as T;
  return v;
}

const VAZIOS = new Set(["sem data", "não informado", "nao informado", "n/a", "-", "desconhecido"]);

function normalizar(m: MapaParcial): MapaParcial {
  const r = limpar(m);
  if (r.trajetoria) r.trajetoria = r.trajetoria.slice(0, 5).map((h) => ({ ...h, periodo: VAZIOS.has(h.periodo.trim().toLowerCase()) ? "" : h.periodo }));
  if (r.padroes && r.trajetoria) {
    const n = r.trajetoria.length;
    r.padroes = r.padroes.slice(0, 4).map((p) => ({ ...p, historias: p.historias.filter((i) => i >= 0 && i < n) }));
  }
  if (r.descobrir) r.descobrir = [...r.descobrir].sort((a, b) => TEMAS.indexOf(a.tema) - TEMAS.indexOf(b.tema));
  if (r.modelos) r.modelos = MODELOS.map((m) => r.modelos!.find((x) => x.modelo === m) ?? { modelo: m, aderencia: 0, porque: "", comoSeria: "" });
  return r;
}

async function salvarParcial(id: string, parcial: MapaParcial, status: string) {
  const sql = await db();
  await sql`update conversas set mapa = ${sql.json(parcial as never)}, mapa_status = ${status}, atualizado = now() where id = ${id}`;
}

/** gera o Mapa em duas chamadas paralelas; salva cada metade assim que chega */
export async function gerarMapa(id: string): Promise<void> {
  const c = await buscarConversa(id);
  if (!c) return;
  const sql = await db();
  const iniciado = new Date();
  await sql`update conversas set mapa = null, mapa_status = 'gerando', mapa_iniciado = ${iniciado} where id = ${id}`;

  const transcricao = c.mensagens.map((m) => `${m.autor === "ray" ? "Ray" : "Cliente"}: ${m.texto}`).join("\n\n");
  const frase = c.estado.frase ? `\n\nA hipótese que ela confirmou: ${c.estado.frase}` : "";
  const user = `Nome da cliente: ${c.nome || "(não informado)"}${frase}\n\nConversa completa:\n\n${transcricao}`;

  let acumulado: MapaParcial = {};
  let lacunas: Mapa["lacunas"] = [];
  const pedir = (campos: readonly string[]) =>
    pedirJson<MapaParcial>({
      conversaId: id,
      tipo: "mapa",
      modelo: MODELO_MAPA,
      system: `${PROMPT_MAPA}\n\nNesta chamada preencha somente estes campos (outra chamada preenche os demais ao mesmo tempo):\n${instrucoes(campos)}`,
      user,
      schema: schemaDe(campos),
      maxTokens: 16000,
      esforco: "medium",
    }).then(async (parte) => {
      // descarta se a conversa recomeçou a geração no meio
      const atual = await buscarConversa(id);
      if (!atual?.mapa_iniciado || atual.mapa_iniciado.getTime() !== iniciado.getTime()) throw new Error("geração substituída");
      lacunas = [...lacunas, ...(parte.lacunas ?? [])];
      acumulado = normalizar({ ...acumulado, ...parte, lacunas });
      return acumulado;
    });

  try {
    const [a] = await Promise.all([
      pedir(GRUPO_A).then((p) => salvarParcial(id, p, "gerando").then(() => p)),
      pedir(GRUPO_B).then((p) => salvarParcial(id, p, "gerando").then(() => p)),
    ]);
    void a;
    const final = normalizar({ ...acumulado, geradoEm: new Date().toISOString() });
    if (!final.hipotese?.frase && c.estado.frase) final.hipotese = { frase: c.estado.frase, porque: final.hipotese?.porque ?? "" };
    await salvarParcial(id, final, "pronto");
  } catch (e) {
    if (e instanceof Error && e.message === "geração substituída") return;
    console.error("mapa", e);
    await sql`update conversas set mapa_status = 'erro', erro = ${String(e instanceof Error ? e.message : e).slice(0, 500)} where id = ${id} and mapa_iniciado = ${iniciado}`;
  }
}
