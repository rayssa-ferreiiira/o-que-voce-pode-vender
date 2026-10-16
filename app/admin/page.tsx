import "../chat.css";
import { db } from "@/lib/db";
import { MODELO_ANOTADOR, MODELO_MAPA, MODELO_RAY, PRECOS } from "@/lib/ia";
import { adminLogado, config } from "@/lib/sessao";

export const dynamic = "force-dynamic";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const usd = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 3 });
const num = (s: string, padrao: number) => (Number(s.replace(",", ".")) || padrao);

const card: React.CSSProperties = { background: "var(--linho)", borderRadius: 12, padding: "16px 18px" };
const rot: React.CSSProperties = { fontSize: 12, color: "var(--argila)", fontWeight: 600, display: "block" };
const grande: React.CSSProperties = { fontFamily: "var(--serif)", fontSize: 26, lineHeight: 1.2 };
const input: React.CSSProperties = { width: "100%", border: "1px solid var(--fio)", background: "#fffdf9", borderRadius: 8, padding: "8px 10px", marginTop: 4 };

export default async function Admin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (!(await adminLogado())) {
    return (
      <div className="app"><div className="portao">
        <form method="post" action="/api/admin/login">
          <h1>Admin</h1>
          <p>Senha do painel.</p>
          <div className="campo"><input type="password" name="senha" aria-label="Senha" autoFocus /><button>Entrar</button></div>
          {sp.erro ? <p className="erro">Senha errada.</p> : null}
        </form>
      </div></div>
    );
  }

  const filtro = sp.filtro === "testes" ? "testes" : sp.filtro === "todas" ? "todas" : "clientes";
  const sql = await db();
  const cond = filtro === "todas" ? sql`true` : filtro === "testes" ? sql`c.teste` : sql`not c.teste`;

  const [codigo, urlP2, urlTrama, cambioS, precoS, taxaS, fixoS] = await Promise.all(["codigo_acesso", "url_p2", "url_trama", "cambio", "preco_venda", "taxa_plataforma", "custo_fixo_mes"].map(config));
  const cambio = num(cambioS, 5.4), preco = num(precoS, 57), taxa = num(taxaS, 10) / 100, fixo = num(fixoS, 0);

  const porConversa = await sql<{ id: string; nome: string; email: string | null; fase: string; teste: boolean; atualizado: Date; msgs: number; ray: number; anot: number; mapa: number; total: number; mapa_status: string }[]>`
    select c.id, c.nome, c.email, c.fase, c.teste, c.atualizado, c.mapa_status, jsonb_array_length(c.mensagens)::int as msgs,
      coalesce(sum(u.custo_usd) filter (where u.tipo = 'conversa'), 0)::float as ray,
      coalesce(sum(u.custo_usd) filter (where u.tipo = 'anotador'), 0)::float as anot,
      coalesce(sum(u.custo_usd) filter (where u.tipo = 'mapa'), 0)::float as mapa,
      coalesce(sum(u.custo_usd), 0)::float as total
    from conversas c left join uso_ia u on u.conversa_id = c.id
    where ${cond}
    group by c.id order by c.atualizado desc limit 200`;

  const completas = porConversa.filter((c) => c.fase === "concluida" && c.mapa_status === "pronto");
  const media = (f: (c: (typeof completas)[number]) => number) => (completas.length ? completas.reduce((s, c) => s + f(c), 0) / completas.length : 0);
  const mTotal = media((c) => c.total), mRay = media((c) => c.ray), mAnot = media((c) => c.anot), mMapa = media((c) => c.mapa), mMsgs = media((c) => c.msgs);

  const [mes] = await sql<{ total: number; conversas: number; mapas: number }[]>`
    select coalesce(sum(u.custo_usd), 0)::float as total,
      (select count(*)::int from conversas c where ${cond} and date_trunc('month', c.criado) = date_trunc('month', now())) as conversas,
      (select count(*)::int from conversas c where ${cond} and c.mapa_status = 'pronto' and date_trunc('month', c.atualizado) = date_trunc('month', now())) as mapas
    from uso_ia u left join conversas c on c.id = u.conversa_id
    where date_trunc('month', u.criado) = date_trunc('month', now()) and ${filtro === "todas" ? sql`true` : filtro === "testes" ? sql`(c.teste or u.conversa_id is null)` : sql`c.teste = false`}`;

  const liquido = preco * (1 - taxa);
  const custo1 = mTotal * cambio, custo3 = mTotal * 3 * cambio;
  const mesBrl = mes.total * cambio + fixo;
  const margem1 = liquido - custo1;
  const equilibrio = fixo > 0 && margem1 > 0 ? Math.ceil(fixo / margem1) : null;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px 80px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontFamily: "var(--serif)", fontWeight: 500, fontSize: 32 }}>Admin</h1>
        <nav style={{ display: "flex", gap: 14, fontSize: 14 }}>
          {(["clientes", "testes", "todas"] as const).map((f) => <a key={f} href={`/admin?filtro=${f}`} style={{ fontWeight: f === filtro ? 700 : 400 }}>{f === "clientes" ? "Clientes" : f === "testes" ? "Testes" : "Todas"}</a>)}
        </nav>
      </header>
      {sp.salvo ? <p style={{ color: "var(--oliva)", marginTop: 8 }}>Salvo.</p> : null}

      <h2 style={{ fontFamily: "var(--serif)", fontWeight: 500, fontSize: 22, margin: "28px 0 12px" }}>Quanto está custando</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        <div style={card}><span style={rot}>Conversa completa (média)</span><span style={grande}>{brl(mTotal * cambio)}</span><small style={{ display: "block", color: "var(--argila)" }}>{usd(mTotal)} · {completas.length} conversas · {Math.round(mMsgs)} mensagens em média</small></div>
        <div style={card}><span style={rot}>Separado</span><small style={{ display: "block", lineHeight: 1.8 }}>Ray: {brl(mRay * cambio)}<br />Anotador: {brl(mAnot * cambio)}<br />Mapa: {brl(mMapa * cambio)}</small></div>
        <div style={card}><span style={rot}>Por venda de {brl(preco)} (líquido {brl(liquido)})</span><small style={{ display: "block", lineHeight: 1.8 }}>1 conversa: custo {brl(custo1)}, margem {brl(liquido - custo1)} ({liquido ? Math.round(((liquido - custo1) / liquido) * 100) : 0}%)<br />3 conversas: custo {brl(custo3)}, margem {brl(liquido - custo3)} ({liquido ? Math.round(((liquido - custo3) / liquido) * 100) : 0}%)</small></div>
        <div style={card}><span style={rot}>Neste mês</span><span style={grande}>{brl(mesBrl)}</span><small style={{ display: "block", color: "var(--argila)" }}>IA {brl(mes.total * cambio)} + fixos {brl(fixo)} · {mes.conversas} conversas · {mes.mapas} Mapas</small></div>
        <div style={card}><span style={rot}>Ponto de equilíbrio do mês</span><span style={grande}>{equilibrio ? `${equilibrio} vendas` : "—"}</span><small style={{ display: "block", color: "var(--argila)" }}>{fixo ? "Pra pagar os custos fixos com a margem de 1 conversa." : "Preencha os custos fixos abaixo."}</small></div>
      </div>
      <p style={{ fontSize: 12, color: "var(--argila)", marginTop: 10 }}>
        Preços por milhão de tokens usados no cálculo: {Object.entries(PRECOS).map(([m, p]) => `${m} US$ ${p.entrada} entrada / US$ ${p.saida} saída`).join(" · ")}. Modelos: Ray {MODELO_RAY}, anotador {MODELO_ANOTADOR}, Mapa {MODELO_MAPA}. Confira também o consumo no console da Anthropic.
      </p>

      <h2 style={{ fontFamily: "var(--serif)", fontWeight: 500, fontSize: 22, margin: "36px 0 12px" }}>Configuração</h2>
      <form method="post" action="/api/admin/config" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, alignItems: "end" }}>
        <label style={rot}>Código de acesso<input name="codigo_acesso" defaultValue={codigo} style={input} /></label>
        <label style={rot}>Link do próximo passo (P2)<input name="url_p2" defaultValue={urlP2} style={input} placeholder="https://" /></label>
        <label style={rot}>Link da Trama<input name="url_trama" defaultValue={urlTrama} style={input} placeholder="https://" /></label>
        <label style={rot}>Câmbio US$ → R$<input name="cambio" defaultValue={cambioS || "5,40"} style={input} /></label>
        <label style={rot}>Preço de venda (R$)<input name="preco_venda" defaultValue={precoS || "57"} style={input} /></label>
        <label style={rot}>Taxa da plataforma (%)<input name="taxa_plataforma" defaultValue={taxaS || "10"} style={input} /></label>
        <label style={rot}>Custos fixos do mês (R$, ex.: Vercel)<input name="custo_fixo_mes" defaultValue={fixoS || "0"} style={input} /></label>
        <button className="btn" style={{ border: 0, background: "var(--terracota)", color: "var(--papel)", borderRadius: 999, padding: "10px 18px", cursor: "pointer" }}>Salvar</button>
      </form>
      {codigo ? <p style={{ fontSize: 13, color: "var(--argila)", marginTop: 8 }}>Link de acesso pra mandar na compra: <code>/c/{codigo}</code></p> : <p className="erro" style={{ textAlign: "left" }}>Defina um código de acesso, senão ninguém entra.</p>}

      <h2 style={{ fontFamily: "var(--serif)", fontWeight: 500, fontSize: 22, margin: "36px 0 12px" }}>Conversas</h2>
      <form method="post" action="/api/admin/teste" style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input name="email" placeholder="email pra marcar como teste" style={{ ...input, width: 280, marginTop: 0 }} />
        <input type="hidden" name="teste" value="1" /><input type="hidden" name="volta" value={`/admin?filtro=${filtro}`} />
        <button style={{ border: "1px solid var(--fio)", background: "var(--papel)", borderRadius: 999, padding: "6px 14px", cursor: "pointer" }}>Marcar como teste</button>
      </form>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr style={{ textAlign: "left", color: "var(--argila)" }}><th>Quando</th><th>Nome</th><th>Email</th><th>Fase</th><th>Msgs</th><th>Custo</th><th>Mapa</th><th /></tr></thead>
          <tbody>
            {porConversa.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid var(--linho-2)" }}>
                <td style={{ padding: "8px 6px 8px 0", whiteSpace: "nowrap" }}>{c.atualizado.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                <td><a href={`/admin/conversa/${c.id}`}>{c.nome || "(sem nome)"}</a>{c.teste ? <small style={{ color: "var(--ocre)" }}> teste</small> : null}</td>
                <td style={{ wordBreak: "break-all" }}>{c.email ?? ""}</td>
                <td>{c.fase}</td>
                <td>{c.msgs}</td>
                <td>{brl(c.total * cambio)}</td>
                <td>{c.mapa_status === "pronto" ? <a href={`/mapa/${c.id}`}>abrir</a> : c.mapa_status}</td>
                <td>
                  <form method="post" action="/api/admin/teste"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="teste" value={c.teste ? "0" : "1"} /><input type="hidden" name="volta" value={`/admin?filtro=${filtro}`} />
                    <button style={{ background: "none", border: 0, color: "var(--argila)", cursor: "pointer", fontSize: 12 }}>{c.teste ? "não é teste" : "é teste"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
