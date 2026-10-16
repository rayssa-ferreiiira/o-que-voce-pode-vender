"use client";
import "../chat.css";
import { useEffect, useState } from "react";

type Item = { id: string; frase: string; em: string };

export default function MeusMapas() {
  const [lembrado, setLembrado] = useState<string | null>(null);
  const [mapas, setMapas] = useState<Item[] | null>(null);
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    fetch("/api/meus-mapas").then((r) => r.json()).then((j) => {
      if (j.email) { setLembrado(j.email); setMapas(j.mapas); }
    });
  }, []);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setBuscando(true);
    const r = await fetch("/api/meus-mapas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const j = await r.json();
    setBuscando(false);
    if (!r.ok) return setErro(j.erro);
    if (!j.mapas.length) return setErro("Não encontrei Mapas com esse email. Confere se é o mesmo que você usou no fim da conversa.");
    setLembrado(j.email);
    setMapas(j.mapas);
  }

  async function esquecer() {
    await fetch("/api/meus-mapas", { method: "DELETE" });
    setLembrado(null);
    setMapas(null);
  }

  return (
    <div className="app">
      <header className="topo"><a className="marca-topo" href="/">O que você pode vender?</a><nav><a href="/">Ir pra conversa</a></nav></header>
      <div className="portao">
        {lembrado && mapas ? (
          <div style={{ width: "100%", maxWidth: 520 }}>
            <h1 style={{ fontFamily: "var(--serif)", fontWeight: 500, fontSize: 32 }}>Seus Mapas</h1>
            <p style={{ color: "var(--argila)", margin: "8px 0 22px" }}>{lembrado} · <button onClick={esquecer} style={{ background: "none", border: 0, color: "var(--terracota)", cursor: "pointer" }}>Não é você?</button></p>
            <div className="inicios" style={{ maxWidth: "none" }}>
              {mapas.map((m) => (
                <a key={m.id} href={`/mapa/${m.id}`} style={{ display: "block", textAlign: "left", textDecoration: "none", color: "var(--tinta)", border: "1px solid var(--fio)", borderRadius: 14, padding: "14px 16px" }}>
                  <span style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{m.frase}</span>
                  <small style={{ display: "block", color: "var(--argila)", marginTop: 4 }}>{new Date(m.em).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}</small>
                </a>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={buscar}>
            <h1>Ver meus resultados</h1>
            <p>Digite o email que você deu no fim da conversa.</p>
            <div className="campo">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" aria-label="Seu email" required autoFocus />
              <button type="submit" disabled={buscando}>{buscando ? "..." : "Ver"}</button>
            </div>
            {erro ? <p className="erro">{erro}</p> : null}
          </form>
        )}
      </div>
    </div>
  );
}
