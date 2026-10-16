import { NextResponse } from "next/server";
import { anthropic, registrarUso } from "@/lib/ia";
import { adminLogado } from "@/lib/sessao";

export const maxDuration = 60;

/** simulador: faz o papel de uma cliente fictícia, a partir da persona e da conversa */
export async function POST(req: Request) {
  if (!(await adminLogado(req))) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const { persona, conversa } = (await req.json()) as { persona: string; conversa: { autor: string; texto: string }[] };
  const modelo = "claude-sonnet-5-5";
  const inicio = Date.now();
  const transcricao = conversa.map((m) => `${m.autor === "ray" ? "Ray" : "Você"}: ${m.texto}`).join("\n\n");
  const r = await anthropic().messages.create({
    model: modelo,
    max_tokens: 500,
    system: `Você está fazendo o papel de uma cliente real num teste de um produto. Responda SOMENTE com a próxima mensagem dela, em português do Brasil, como ela escreveria num chat (sem aspas, sem narração, sem explicar nada). Mantenha a personalidade, o tamanho típico das respostas e os fatos da persona. Não invente fatos que contradigam a persona. Se a Ray perguntar algo que a persona não cobre, invente algo coerente e realista. Quando a Ray apresentar uma frase final em negrito, reaja como a persona reagiria (aceitar, pedir ajuste ou hesitar).\n\nPersona:\n${persona}`,
    messages: [{ role: "user", content: transcricao ? `Conversa até agora:\n\n${transcricao}\n\nEscreva a próxima mensagem dela.` : "Escreva a primeira mensagem dela para a Ray, abrindo a conversa." }],
  });
  await registrarUso(null, "simulador", modelo, r.usage, Date.now() - inicio);
  const texto = r.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  return NextResponse.json({ texto });
}
