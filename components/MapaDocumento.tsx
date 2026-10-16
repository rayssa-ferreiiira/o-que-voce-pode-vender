"use client";
import { useEffect, useRef, useState } from "react";
import { ROTULO_MODELO, ROTULO_TEMA, type MapaParcial, type Sinais } from "@/lib/tipos";

const CORES = ["var(--terracota)", "var(--oliva)", "var(--ocre)", "var(--argila)"];
const HEX: Record<string, string> = { "var(--terracota)": "#C2562F", "var(--oliva)": "#61704F", "var(--ocre)": "#B4863A", "var(--argila)": "#7D6050" };
const NOMES_SINAIS: [keyof Sinais, string][] = [["experiencia", "Experiência"], ["reconhecimento", "Reconhecimento"], ["publico", "Público"], ["aplicacao", "Aplicação"]];
const TIPO: Record<string, string> = { procura: "Procura", pagamento: "Pagamento", "problema recorrente": "Problema recorrente", reconhecimento: "Reconhecimento" };

function dataLonga(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
}

function Lacuna({ m, secao }: { m: MapaParcial; secao: string }) {
  const l = (m.lacunas ?? []).filter((x) => x.secao === secao);
  return <>{l.map((x, i) => <p key={i} className="pouca recuo">{x.texto}</p>)}</>;
}

function Esqueleto() {
  return <div className="recuo" aria-hidden><div className="esqueleto" style={{ width: "80%" }} /><div className="esqueleto" style={{ width: "65%" }} /><div className="esqueleto" style={{ width: "72%" }} /></div>;
}

function Trama({ m }: { m: MapaParcial }) {
  const ref = useRef<HTMLDivElement>(null);
  const [foco, setFoco] = useState<number | null>(null);
  const padroes = (m.padroes ?? []).filter((p) => p.historias.length >= 2);

  useEffect(() => {
    const trama = ref.current;
    if (!trama) return;
    const desenhar = () => {
      const svg = trama.querySelector("svg.fios") as SVGSVGElement | null;
      if (!svg) return;
      const tb = trama.getBoundingClientRect();
      const nos = [...trama.querySelectorAll(".historias .no")].map((n) => {
        const r = n.getBoundingClientRect();
        return { x: r.left - tb.left + r.width / 2, y: r.top - tb.top + r.height / 2 };
      });
      svg.style.height = trama.offsetHeight + "px";
      const w = svg.getBoundingClientRect().width;
      svg.innerHTML = padroes
        .map((p, pi) => {
          const pts = p.historias.map((i) => nos[i]).filter(Boolean);
          if (pts.length < 2) return "";
          const off = w * 0.18 + pi * (w * 0.2);
          let d = `M${pts[0].x} ${pts[0].y}`;
          for (let k = 1; k < pts.length; k++) {
            const a = pts[k - 1], b = pts[k];
            const cx = a.x - off - (b.y - a.y) * 0.08;
            d += ` C${cx} ${a.y + (b.y - a.y) * 0.2} ${cx} ${b.y - (b.y - a.y) * 0.2} ${b.x} ${b.y}`;
          }
          return `<path data-i="${pi}" d="${d}" stroke="${HEX[CORES[pi % 4]]}"/>`;
        })
        .join("");
    };
    desenhar();
    const mq = matchMedia("print");
    addEventListener("resize", desenhar);
    addEventListener("beforeprint", desenhar);
    addEventListener("afterprint", desenhar);
    mq.addEventListener("change", desenhar);
    document.fonts?.ready.then(desenhar);
    return () => {
      removeEventListener("resize", desenhar);
      removeEventListener("beforeprint", desenhar);
      removeEventListener("afterprint", desenhar);
      mq.removeEventListener("change", desenhar);
    };
  }, [m.trajetoria, m.padroes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    ref.current?.querySelectorAll("path").forEach((p) => p.classList.toggle("on", foco !== null && p.dataset.i === String(foco)));
  }, [foco]);

  return (
    <div className={`trama${foco !== null ? " foco" : ""}`} ref={ref}>
      <svg className="fios" aria-hidden="true" />
      <ol className="historias">
        {(m.trajetoria ?? []).map((h, i) => (
          <li key={i}>
            <span className="no" />
            {h.periodo ? <div className="periodo">{h.periodo}</div> : null}
            <h3>{h.situacao}</h3>
            <p>{h.oQueFez}</p>
            {h.resultado ? <p className="res"><b>Resultado:</b> {h.resultado}</p> : null}
          </li>
        ))}
      </ol>
      {padroes.length ? (
        <div className="legenda">
          {padroes.map((p, i) => (
            <div key={i} onMouseEnter={() => setFoco(i)} onMouseLeave={() => setFoco(null)}>
              <i style={{ background: CORES[i % 4] }} />
              <span>
                {p.padrao}
                <small>Histórias {p.historias.map((x) => x + 1).join(", ").replace(/, (\d+)$/, " e $1")}</small>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Barras({ v }: { v: number }) {
  return <span className="barra" aria-label={`${v} de 3`}>{[0, 1, 2].map((k) => <b key={k} className={k < v ? "c" : ""} />)}</span>;
}

export default function MapaDocumento({ m, nome, montando, links }: { m: MapaParcial; nome: string; montando: boolean; links: { p2: string; trama: string } }) {
  const nomeExibido = m.nome || nome || "Você";
  const rec = m.modeloRecomendado ? m.modelos?.find((x) => x.modelo === m.modeloRecomendado) : undefined;
  const modelos = m.modelos ? [...m.modelos].sort((a, b) => (a.modelo === m.modeloRecomendado ? -1 : b.modelo === m.modeloRecomendado ? 1 : b.aderencia - a.aderencia)) : [];
  const temTema = (m.descobrir ?? []).length > 0;

  useEffect(() => {
    // nome da cliente no rodapé do PDF
    const id = "rodape-pdf";
    document.getElementById(id)?.remove();
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `@media print{@page{@bottom-left{content:${JSON.stringify(nomeExibido)};font-family:'DM Sans',sans-serif;font-size:8pt;color:#7D6050}}@page :first{@bottom-left{content:none}}}`;
    document.head.appendChild(s);
    return () => s.remove();
  }, [nomeExibido]);

  return (
    <main className="folha">
      <div className="capa-pagina">
        <div>
          <header className="capa">
            <div>
              <div className="doc">Seu Mapa de Possibilidades</div>
              <h1>{nomeExibido}</h1>
            </div>
            <div className="meta">O que você pode vender?<br />{dataLonga(m.geradoEm)}</div>
          </header>
          {m.hipotese?.frase ? (
            <div className="hipotese">
              <div className="rotulo">Por onde começar</div>
              <div>
                <blockquote>{m.hipotese.frase}</blockquote>
                {m.hipotese.porque ? <p>{m.hipotese.porque}</p> : null}
              </div>
            </div>
          ) : <Esqueleto />}
          {m.sintese ? <p className="sintese">{m.sintese}</p> : null}
        </div>
        <div className="marca"><span>Este é um documento pessoal, feito a partir da sua conversa.</span><b>O que você pode vender?</b></div>
      </div>

      <section className="trama-sec quebra">
        <div className="cab">
          <h2>A trama da sua trajetória</h2>
          <p className="nota">Cada ponto é uma história que você contou. Os fios ligam as histórias que têm algo em comum.</p>
        </div>
        {m.trajetoria?.length ? <Trama m={m} /> : <Esqueleto />}
        <Lacuna m={m} secao="trajetoria" />
        <Lacuna m={m} secao="padroes" />
      </section>

      <section className="quebra">
        <div className="dupla">
          <div>
            <h3>O que você sabe resolver</h3>
            {m.resolve?.length ? <ul>{m.resolve.map((r, i) => <li key={i}>{r}</li>)}</ul> : <Esqueleto />}
          </div>
          <div>
            <h3>Sinais de que alguém precisa disso</h3>
            {m.sinaisDemanda?.length ? (
              <ul>{m.sinaisDemanda.map((s, i) => <li key={i}><span className="tipo">{TIPO[s.tipo] ?? s.tipo}</span>{s.sinal}</li>)}</ul>
            ) : <Esqueleto />}
          </div>
        </div>
        <Lacuna m={m} secao="resolve" />
        <Lacuna m={m} secao="sinaisDemanda" />
      </section>

      <section className="quebra">
        <div className="cab"><h2>Suas possibilidades</h2><p className="nota">Os caminhos que a sua história sustenta, comparados pelos mesmos quatro sinais.</p></div>
        {m.possibilidades?.length ? (
          <div className="poss recuo">
            {m.possibilidades.map((p, i) => (
              <article key={i} className={i === 0 ? "prio" : ""}>
                <div>
                  {i === 0 ? <span className="tag">Por onde começar</span> : null}
                  <h3>{p.direcao}</h3>
                  <ul>{p.fundamentos.map((f, k) => <li key={k}>{f}</li>)}</ul>
                </div>
                <div className="sinais">
                  {NOMES_SINAIS.map(([k, rot]) => <div className="sinal" key={k}><span>{rot}</span><Barras v={p.sinais[k]} /></div>)}
                </div>
              </article>
            ))}
          </div>
        ) : <Esqueleto />}
        <Lacuna m={m} secao="possibilidades" />
      </section>

      <section className="quebra">
        <div className="cab"><h2>O modelo que combina com você</h2><p className="nota">Pelo jeito como você contou que gosta de ajudar.</p></div>
        {modelos.length ? (
          <div className="recuo">
            <div className="modelos">
              {modelos.map((x) => (
                <article key={x.modelo} className={x.modelo === m.modeloRecomendado ? "rec" : ""}>
                  {x.modelo === m.modeloRecomendado ? <span className="indica">Mais aderente</span> : null}
                  <h3>{ROTULO_MODELO[x.modelo]}</h3>
                  <div className="pontos" aria-label={`aderência ${x.aderencia} de 3`}>{[0, 1, 2].map((k) => <b key={k} className={k < x.aderencia ? "c" : ""} />)}</div>
                  <p>{x.porque}</p>
                </article>
              ))}
            </div>
            {rec?.comoSeria ? <div className="comoSeria"><span>Como seria</span><p>{rec.comoSeria}</p></div> : null}
          </div>
        ) : <Esqueleto />}
        <Lacuna m={m} secao="modelos" />
      </section>

      <section className="quebra">
        <div className="cab"><h2>Quem poderia se beneficiar</h2></div>
        {m.publico?.quem ? (
          <div className="recuo">
            <div className="publico">
              {m.publico.frase ? <p className="fala">{m.publico.frase}</p> : <p className="fala">{m.publico.precisa}</p>}
              <dl>
                <div><dt>Quem</dt><dd>{m.publico.quem}</dd></div>
                {m.publico.momento ? <div><dt>Momento</dt><dd>{m.publico.momento}</dd></div> : null}
                {m.publico.ondeEsta ? <div><dt>Onde está</dt><dd>{m.publico.ondeEsta}</dd></div> : null}
                {m.publico.frase && m.publico.precisa ? <div><dt>Do que precisa</dt><dd>{m.publico.precisa}</dd></div> : null}
              </dl>
            </div>
          </div>
        ) : <Esqueleto />}
        <Lacuna m={m} secao="publico" />
      </section>

      <section>
        <div className="cab"><h2>Sua história de credibilidade</h2><p className="nota">Pra dizer em voz alta quando alguém perguntar o que você faz.</p></div>
        {m.credibilidade?.length ? <ul className="cred recuo">{m.credibilidade.map((c, i) => <li key={i}>{c}</li>)}</ul> : <Esqueleto />}
        <Lacuna m={m} secao="credibilidade" />
      </section>

      <section className="quebra">
        <div className="cab"><h2>O que ainda vale descobrir</h2><p className="nota">As perguntas que transformam essa hipótese num produto seu.</p></div>
        {temTema ? (
          <>
            <ul className="desc recuo">
              {m.descobrir!.map((d, i) => (
                <li key={i}><div>{m.descobrir![i - 1]?.tema !== d.tema ? <span className="tema">{ROTULO_TEMA[d.tema]}</span> : null}<span>{d.pergunta}</span></div></li>
              ))}
            </ul>
            <p className="ponte recuo">{links.trama ? <a href={links.trama} target="_blank" rel="noreferrer">Essas são as perguntas que a gente responde junto na Trama.</a> : "Essas são as perguntas que a gente responde junto na Trama."}</p>
          </>
        ) : <Esqueleto />}
      </section>

      {!montando ? (
        <footer className="fecho">
          <p className="aviso">Este mapa organiza as possibilidades que a sua trajetória sustenta. Se existe demanda e quanto ela vale, isso se verifica depois, conversando com quem poderia comprar.</p>
          {links.p2 ? (
            <div className="proximo">
              <p>O próximo passo é transformar essa hipótese numa ideia concreta de produto.</p>
              <a href={links.p2} target="_blank" rel="noreferrer">Conhecer o próximo passo</a>
            </div>
          ) : null}
        </footer>
      ) : null}
    </main>
  );
}
