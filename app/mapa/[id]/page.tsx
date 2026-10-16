"use client";
import "../mapa.css";
import { use, useEffect, useState } from "react";
import MapaDocumento from "@/components/MapaDocumento";
import type { MapaParcial } from "@/lib/tipos";

type Resposta = { status: "gerando" | "pronto" | "erro"; mapa: MapaParcial | null; nome: string; links: { p2: string; trama: string } };

export default function PaginaMapa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<Resposta | null>(null);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [ajustando, setAjustando] = useState(false);

  useEffect(() => {
    let vivo = true;
    let t: ReturnType<typeof setTimeout>;
    const buscar = async () => {
      try {
        const r = await fetch(`/api/mapa/${id}`, { cache: "no-store" });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || "Não achei esse Mapa.");
        const j = (await r.json()) as Resposta;
        if (!vivo) return;
        setD(j);
        if (j.status === "gerando") t = setTimeout(buscar, 2500);
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : "Não achei esse Mapa.");
      }
    };
    buscar();
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [id]);

  async function copiar() {
    await navigator.clipboard.writeText(location.href).catch(() => undefined);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function ajustar() {
    setAjustando(true);
    const r = await fetch(`/api/mapa/${id}/ajustar`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErro(j.erro || "Não deu certo agora.");
      setAjustando(false);
      return;
    }
    if (j.refazendo) location.reload();
    else location.href = "/";
  }

  if (erro) return <div className="mapa-pagina"><p style={{ textAlign: "center", marginTop: 80 }}>{erro} <a href="/meus-mapas">Ver meus resultados</a></p></div>;

  const vazio = !d?.mapa || !d.mapa.hipotese;
  return (
    <div className="mapa-pagina">
      <div className="barra-acoes nao-imprimir">
        <span>{d?.status === "gerando" ? "Montando o seu Mapa. As seções vão aparecendo." : d?.status === "erro" ? "Algo falhou ao montar o Mapa." : "Esse é o link do seu Mapa. Guarde ele."}</span>
        <div className="grupo">
          {d?.status === "pronto" ? (
            <>
              <button className="btn" onClick={copiar}>{copiado ? "Link copiado" : "Copiar link"}</button>
              <button className="btn" onClick={() => window.print()}>Baixar PDF</button>
              <button className="btn" onClick={ajustar} disabled={ajustando}>{ajustando ? "Abrindo..." : "Ajustar a frase"}</button>
            </>
          ) : d?.status === "erro" ? (
            <button className="btn forte" onClick={ajustar}>Tentar de novo</button>
          ) : null}
        </div>
      </div>
      {vazio ? (
        <main className="folha" role="status" aria-live="polite">
          <p className="doc" style={{ fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--terracota)" }}>Seu Mapa de Possibilidades</p>
          <h1 style={{ fontFamily: "var(--serif)", fontWeight: 500, fontSize: 40, margin: "8px 0 24px" }}>{d?.nome || "Montando..."}</h1>
          <p style={{ color: "var(--argila)" }}>Estou juntando tudo o que você contou: as histórias, os fios entre elas, quem te procura. Leva uns segundos.</p>
          <div className="esqueleto" style={{ width: "70%", marginTop: 32 }} />
          <div className="esqueleto" style={{ width: "55%" }} />
          <div className="esqueleto" style={{ width: "62%" }} />
        </main>
      ) : (
        <div className={d?.status === "gerando" ? "montando-suave" : ""}>
          <MapaDocumento m={d!.mapa!} nome={d!.nome} montando={d!.status !== "pronto"} links={d!.links} />
        </div>
      )}
      <div className="rodape nao-imprimir"><span>{d?.mapa?.nome || d?.nome}</span><span>Trama · Rayssa Ferreira</span></div>
      <p className="nao-imprimir" style={{ maxWidth: 880, margin: "28px auto 0", fontSize: 13, color: "var(--argila)", padding: "0 4px" }}>
        Seu Mapa fica salvo no seu email. Pra voltar de qualquer lugar, use <a href="/meus-mapas">Ver meus resultados</a> com o mesmo email.
      </p>
    </div>
  );
}
