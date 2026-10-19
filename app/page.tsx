"use client";
import "./chat.css";
import { useCallback, useEffect, useRef, useState } from "react";
import Texto from "@/components/Texto";
import type { Mensagem } from "@/lib/tipos";

const FRASES = [
  "Sei fazer muita coisa, mas não sei o que poderia vender",
  "Será que alguém pagaria pelo que eu sei?",
  "Quero criar algo meu, mas não sei por onde começar",
];

type Estado = { acesso: boolean; conversa: { nome: string; mensagens: Mensagem[]; fase: string; id: string | null } | null };

export default function Home() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [fase, setFase] = useState("explorando");
  const [mapaId, setMapaId] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [falando, setFalando] = useState(false);
  const [erro, setErro] = useState("");
  const [codigo, setCodigo] = useState("");
  const [email, setEmail] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);
  const caixaRef = useRef<HTMLTextAreaElement>(null);

  const carregar = useCallback(async () => {
    const r = await fetch("/api/conversa", { cache: "no-store" });
    const j = (await r.json()) as Estado;
    setEstado(j);
    setMensagens(j.conversa?.mensagens ?? []);
    setFase(j.conversa?.fase ?? "explorando");
    setMapaId(j.conversa?.id ?? null);
  }, []);

  useEffect(() => {
    carregar();
    if (new URLSearchParams(location.search).get("codigo") === "invalido") setErro("Esse link de acesso não vale. Confere o email da sua compra.");
  }, [carregar]);

  // só acompanha o fim da conversa se ela já estiver lá embaixo
  const colado = useRef(true);
  useEffect(() => {
    const aoRolar = () => { colado.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 120; };
    addEventListener("scroll", aoRolar, { passive: true });
    return () => removeEventListener("scroll", aoRolar);
  }, []);
  useEffect(() => {
    if (colado.current) window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "auto" });
  }, [mensagens, falando]);

  useEffect(() => {
    const t = caixaRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 200) + "px";
  }, [texto]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const r = await fetch("/api/acesso", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ codigo }) });
    if (!r.ok) return setErro((await r.json()).erro);
    carregar();
  }

  async function enviar(conteudo: string) {
    const t = conteudo.trim();
    if (!t || falando) return;
    setErro("");
    setTexto("");
    setFalando(true);
    colado.current = true;
    const antes = mensagens;
    setMensagens([...antes, { autor: "cliente", texto: t }, { autor: "ray", texto: "" }]);
    try {
      const r = await fetch("/api/conversa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ texto: t }) });
      if (!r.ok || !r.body) throw new Error((await r.json().catch(() => ({}))).erro || "Não consegui enviar. Tenta de novo.");
      const leitor = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let resposta = "";
      for (;;) {
        const { value, done } = await leitor.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n")) >= 0) {
          const linha = buf.slice(0, i);
          buf = buf.slice(i + 1);
          if (!linha.trim()) continue;
          const ev = JSON.parse(linha);
          if (ev.t === "delta") {
            resposta += ev.texto;
            setMensagens([...antes, { autor: "cliente", texto: t }, { autor: "ray", texto: resposta }]);
          } else if (ev.t === "fim") {
            setFase(ev.fase);
            if (ev.fase === "concluida" && ev.id) setTimeout(() => (location.href = `/mapa/${ev.id}`), 1200);
          } else if (ev.t === "erro") throw new Error(ev.texto);
        }
      }
    } catch (e) {
      setMensagens(antes);
      setTexto(t);
      setErro(e instanceof Error ? e.message : "Algo deu errado.");
    } finally {
      setFalando(false);
      caixaRef.current?.focus();
    }
  }

  async function mandarEmail(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const r = await fetch("/api/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const j = await r.json();
    if (!r.ok) return setErro(j.erro);
    location.href = `/mapa/${j.id}`;
  }

  async function novaConversa() {
    const r = await fetch("/api/conversa/nova", { method: "POST" });
    const j = await r.json();
    if (!r.ok) return setErro(j.erro);
    setMensagens([]);
    setFase("explorando");
    setMapaId(null);
  }

  if (!estado) return <div className="app" />;

  if (!estado.acesso) {
    return (
      <div className="app">
        <div className="portao">
          <form onSubmit={entrar}>
            <h1>O que você pode vender?</h1>
            <p>Entre com o código de acesso que chegou no email da sua compra.</p>
            <div className="campo">
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Seu código" aria-label="Código de acesso" autoFocus />
              <button type="submit">Entrar</button>
            </div>
            {erro ? <p className="erro">{erro}</p> : null}
            <p style={{ marginTop: 28, fontSize: 14 }}><a href="/meus-mapas">Já fez? Ver meus resultados</a></p>
          </form>
        </div>
      </div>
    );
  }

  const vazio = mensagens.length === 0;
  const ultima = mensagens.at(-1);
  return (
    <div className="app">
      <header className="topo">
        <span className="marca-topo">O que você pode vender?</span>
        <nav>
          {!vazio ? <button onClick={novaConversa}>Nova conversa</button> : null}
          <a href="/meus-mapas">Ver meus resultados</a>
        </nav>
      </header>
      <div className="miolo">
        {vazio ? (
          <div className="boas-vindas">
            <div className="selo" aria-hidden>R</div>
            <h1>O que você pode vender?</h1>
            <p className="promessa">Em 15 minutos, saia com o seu Mapa: o que você pode vender, pra quem e por onde começar, a partir da experiência que você já tem, no trabalho e fora dele.</p>
            <p className="aviso-inicio">Esta é uma conversa investigativa. A Ray vai fazer bastante pergunta pra entender a sua trajetória, porque é daí que sai o seu Mapa. Leva em média 15 minutos.</p>
            <p className="rotulo-inicios">Não sabe por onde começar? Escolha uma frase:</p>
            <div className="inicios">
              {FRASES.map((f) => <button key={f} onClick={() => enviar(f)}>{f}</button>)}
            </div>
          </div>
        ) : (
          <div className="mensagens" aria-live="polite">
            {mensagens.map((m, i) =>
              m.autor === "cliente" ? (
                <div key={i} className="msg-cliente">{m.texto}</div>
              ) : (
                <div key={i} className="msg-ray">
                  <span className="av" aria-hidden>R</span>
                  <div className="txt">
                    {m.texto ? <Texto texto={m.texto} /> : <div className="pensando" aria-label="A Ray está escrevendo"><i /><i /><i /></div>}
                  </div>
                </div>
              ),
            )}
            {fase === "concluida" && !falando && ultima?.autor === "ray" ? (
              <div className="fim-conversa">
                {mapaId ? <a className="forte" href={`/mapa/${mapaId}`}>Abrir o meu Mapa</a> : null}
                <button onClick={novaConversa}>Começar outra conversa</button>
              </div>
            ) : null}
            <div ref={fimRef} />
          </div>
        )}

        <div className="compor">
          {fase === "email" ? (
            <form className="caixa" onSubmit={mandarEmail}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" aria-label="Seu email" autoFocus required />
              <button className="enviar texto" type="submit">Liberar meu Mapa</button>
            </form>
          ) : fase === "concluida" ? null : (
            <form className="caixa" onSubmit={(e) => { e.preventDefault(); enviar(texto); }}>
              <textarea
                ref={caixaRef}
                rows={1}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); enviar(texto); } }}
                placeholder={vazio ? "Ou conte o que você faz hoje..." : "Escreva sua resposta..."}
                aria-label="Sua mensagem"
              />
              <button className="enviar" type="submit" disabled={falando || !texto.trim()} aria-label="Enviar">↑</button>
            </form>
          )}
          {erro ? <p className="erro">{erro}</p> : <p className="dica">Você não precisa citar empresa, cliente nem dado interno.</p>}
        </div>
      </div>
    </div>
  );
}
