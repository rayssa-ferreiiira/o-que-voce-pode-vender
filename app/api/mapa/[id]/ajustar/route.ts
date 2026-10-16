import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { salvarConversa } from "@/lib/conversa";
import { after } from "next/server";
import { gerarMapa } from "@/lib/mapa";
import { buscarConversa, COOKIE_CONVERSA, opcoesCookie } from "@/lib/sessao";

/** reabre a conversa só pra ajustar a frase, sem gastar uma conversa nova */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jar = await cookies();
  const c = await buscarConversa(id);
  if (!c) return NextResponse.json({ erro: "Mapa não encontrado." }, { status: 404 });
  if (c.mapa_status === "erro") {
    after(() => gerarMapa(id));
    return NextResponse.json({ ok: true, refazendo: true });
  }
  if (jar.get(COOKIE_CONVERSA)?.value !== id) return NextResponse.json({ erro: "Só dá pra ajustar a frase no navegador onde a conversa aconteceu." }, { status: 403 });
  const frase = c.mapa?.hipotese?.frase || c.estado.frase || "";
  await salvarConversa(id, {
    fase: "hipotese",
    mensagens: [...c.mensagens, { autor: "ray", texto: `Vamos ajustar. Hoje a frase está assim:\n\n**${frase}**\n\nO que não faz sentido pra você?`, em: new Date().toISOString() }],
  });
  const r = NextResponse.json({ ok: true });
  r.cookies.set(COOKIE_CONVERSA, id, opcoesCookie);
  return r;
}
