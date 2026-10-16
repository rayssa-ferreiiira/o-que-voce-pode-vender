import { after, NextResponse } from "next/server";
import { gerarMapa } from "@/lib/mapa";
import { buscarConversa, config } from "@/lib/sessao";

export const runtime = "nodejs";
export const maxDuration = 300;

/** o link do Mapa funciona como chave: devolve só o Mapa e o nome, nunca a conversa */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await buscarConversa(id);
  if (!c || (c.fase !== "email" && c.fase !== "concluida" && !c.mapa)) return NextResponse.json({ erro: "Mapa não encontrado." }, { status: 404 });

  const travado = c.mapa_status === "gerando" && c.mapa_iniciado && Date.now() - c.mapa_iniciado.getTime() > 240_000;
  if ((c.mapa_status === "nenhum" && (c.fase === "email" || c.fase === "concluida")) || travado) after(() => gerarMapa(c.id));

  const [urlP2, urlTrama] = await Promise.all([config("url_p2"), config("url_trama")]);
  return NextResponse.json(
    { status: travado ? "gerando" : c.mapa_status === "nenhum" ? "gerando" : c.mapa_status, mapa: c.mapa, nome: c.nome, links: { p2: urlP2, trama: urlTrama } },
    { headers: { "cache-control": "no-store" } },
  );
}
