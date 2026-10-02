import { Fragment, type ReactNode } from "react";

// Put components (e.g. links) into a translated sentence:
//   rich("I accept the {terms}", { terms: <Link …>Terms</Link> })
// Works in server and client components.
export function rich(template: string, parts: Record<string, ReactNode>) {
  return template.split(/(\{\w+\})/).map((piece, i) => {
    const key = piece.match(/^\{(\w+)\}$/)?.[1];
    return <Fragment key={i}>{key && key in parts ? parts[key] : piece}</Fragment>;
  });
}
