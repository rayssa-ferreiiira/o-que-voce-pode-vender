import "../../../chat.css";
import Texto from "@/components/Texto";
import { adminLogado, buscarConversa } from "@/lib/sessao";

export const dynamic = "force-dynamic";

export default async function ConversaAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await adminLogado())) return <p style={{ padding: 40 }}><a href="/admin">Entrar no admin</a></p>;
  const c = await buscarConversa(id);
  if (!c) return <p style={{ padding: 40 }}>Não encontrada.</p>;
  return (
    <div className="app">
      <header className="topo"><a href="/admin">← Admin</a><span>{c.nome || "(sem nome)"} · {c.email ?? "sem email"} · {c.fase}</span></header>
      <div className="miolo">
        <div className="mensagens">
          {c.mensagens.map((m, i) => m.autor === "cliente" ? <div key={i} className="msg-cliente">{m.texto}</div> : <div key={i} className="msg-ray"><span className="av">R</span><div className="txt"><Texto texto={m.texto} /></div></div>)}
        </div>
        <details style={{ marginTop: 24, fontSize: 13, color: "var(--argila)" }}>
          <summary>Nota e provas do anotador</summary>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{JSON.stringify(c.estado, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
}
