import { Fragment } from "react";

/** markdown mínimo da Ray: parágrafos e **negrito**, tolerando negrito ainda aberto no streaming */
export default function Texto({ texto }: { texto: string }) {
  const paragrafos = texto.split(/\n\s*\n/).filter((p) => p.trim());
  return (
    <>
      {paragrafos.map((p, i) => {
        const partes = p.split(/(\*\*[^*]*\*\*|\*\*[^*]*$)/g).filter(Boolean);
        return (
          <p key={i}>
            {partes.map((x, k) =>
              x.startsWith("**") ? <strong key={k}>{x.replace(/^\*\*|\*\*$/g, "")}</strong> : <Fragment key={k}>{x.split("\n").map((l, j, a) => <Fragment key={j}>{l}{j < a.length - 1 ? <br /> : null}</Fragment>)}</Fragment>,
            )}
          </p>
        );
      })}
    </>
  );
}
