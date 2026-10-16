import { after, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { anotar, clientes, FALA_EMAIL, FRASES_INICIO, falarRay, fraseEmNegrito, MAX_MENSAGENS_CLIENTE, montarNota, provasDe, salvarConversa } from "@/lib/conversa";
import { gerarMapa } from "@/lib/mapa";
import { buscarConversa, COOKIE_CONVERSA, conversaAtual, opcoesCookie, temAcesso, type Conversa } from "@/lib/sessao";
import type { Mensagem } from "@/lib/tipos";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  if (!(await temAcesso())) return NextResponse.json({ acesso: false });
  const c = await conversaAtual();
  return NextResponse.json({
    acesso: true,
    conversa: c ? { nome: c.nome, mensagens: c.mensagens, fase: c.fase, id: c.fase === "concluida" ? c.id : null } : null,
  });
}

const NOTA_PRIMEIRA = "Esta é a primeira mensagem dela. Aproveite tudo o que veio e não pergunte o que ela já contou. Se o nome não veio, acolha o que ela trouxe e pergunte só o primeiro nome.";
const NOTA_FRASE = "Ela clicou numa frase de início. Acolha a frase de um jeito que desperte curiosidade e mostre que essa pergunta tem resposta na história dela. Depois pergunte o primeiro nome, de forma leve, na mesma mensagem.";

export async function POST(req: Request) {
  if (!(await temAcesso())) return NextResponse.json({ erro: "Seu acesso não vale mais. Abra o link da sua compra de novo." }, { status: 401 });
  const { texto: bruto } = (await req.json().catch(() => ({}))) as { texto?: string };
  const texto = (bruto ?? "").trim().slice(0, 4000);
  if (!texto) return NextResponse.json({ erro: "Mensagem vazia." }, { status: 400 });

  const jar = await cookies();
  let c = await conversaAtual();
  let novaId: string | null = null;
  if (!c) {
    const sql = await db();
    novaId = crypto.randomUUID();
    await sql`insert into conversas (id) values (${novaId})`;
    c = (await buscarConversa(novaId)) as Conversa;
  }
  if (c.fase === "email" || c.fase === "concluida") return NextResponse.json({ erro: "Essa conversa já terminou." }, { status: 409 });
  if (clientes(c.mensagens) >= MAX_MENSAGENS_CLIENTE) return NextResponse.json({ erro: "Essa conversa chegou no limite." }, { status: 409 });

  const conversa: Conversa = c;
  const mensagens: Mensagem[] = [...conversa.mensagens, { autor: "cliente", texto, em: new Date().toISOString() }];
  await salvarConversa(conversa.id, { mensagens });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const enviar = (o: unknown) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        // frase já apresentada: confere a confirmação antes de a Ray falar
        if (conversa.fase === "hipotese") {
          const a = await anotar(conversa, mensagens);
          if (a?.confirmou) {
            // ajuste depois do Mapa: o email já existe, só refaz
            const fase = conversa.email ? "concluida" : "email";
            const fala = conversa.email ? "Fechado. Já estou refazendo o seu Mapa com a frase nova." : FALA_EMAIL;
            await salvarConversa(conversa.id, { mensagens: [...mensagens, { autor: "ray", texto: fala, em: new Date().toISOString() }], fase });
            enviar({ t: "delta", texto: fala });
            enviar({ t: "fim", fase, id: conversa.id });
            ctrl.close();
            after(() => gerarMapa(conversa.id));
            return;
          }
          if (a) conversa.estado = { ...conversa.estado, provas: provasDe(a), nota: montarNota({ ...conversa, mensagens }, a, provasDe(a)) };
        }

        let nota = conversa.estado.nota || "";
        if (clientes(mensagens) === 1) nota = FRASES_INICIO.includes(texto) ? NOTA_FRASE : NOTA_PRIMEIRA;
        const resposta = await falarRay(conversa, mensagens, nota, (d) => enviar({ t: "delta", texto: d }));
        if (!resposta) throw new Error("vazia");
        const comRay: Mensagem[] = [...mensagens, { autor: "ray", texto: resposta, em: new Date().toISOString() }];

        // a frase em negrito só vale como hipótese quando o fechamento estava liberado
        const frase = fraseEmNegrito(resposta);
        // a Ray só usa negrito na frase final: se apareceu, a hipótese foi apresentada
        const liberado = true;
        const fase = frase && liberado ? "hipotese" : conversa.fase;
        await salvarConversa(conversa.id, { mensagens: comRay, fase, estado: { ...conversa.estado, frase: frase && liberado ? frase : conversa.estado.frase } });
        enviar({ t: "fim", fase });
        ctrl.close();

        // anotador em segundo plano: prepara a nota da próxima fala
        after(async () => {
          const atual = await buscarConversa(conversa.id);
          if (!atual) return;
          const a = await anotar(atual, comRay);
          if (!a) return;
          const provas = provasDe(a);
          const nome = atual.nome || a.nome.trim().slice(0, 80);
          const estado = { ...atual.estado, provas, nota: montarNota({ nome, mensagens: comRay, fase: atual.fase }, a, provas) };
          await salvarConversa(atual.id, { estado, nome });
        });
      } catch (e) {
        console.error("conversa", e);
        await (await db())`update conversas set erro = ${String(e instanceof Error ? e.message : e).slice(0, 500)} where id = ${conversa.id}`.catch(() => undefined);
        await salvarConversa(conversa.id, { mensagens: conversa.mensagens }).catch(() => undefined);
        enviar({ t: "erro", texto: "A Ray não conseguiu responder agora. Tenta mandar de novo." });
        ctrl.close();
      }
    },
  });

  const r = new NextResponse(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
  if (novaId) r.cookies.set(COOKIE_CONVERSA, novaId, opcoesCookie);
  void jar;
  return r;
}
