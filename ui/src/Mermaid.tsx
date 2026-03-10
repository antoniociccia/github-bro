import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    git0: "#7fff00",
    git1: "#ff6b6b",
    git2: "#4ecdc4",
    git3: "#ffe66d",
    gitBranchLabel0: "#0f1923",
    gitBranchLabel1: "#0f1923",
    gitBranchLabel2: "#0f1923",
    gitBranchLabel3: "#0f1923",
    commitLabelColor: "#c9d1d9",
    commitLabelBackground: "#1a2332",
    tagLabelBackground: "#7fff00",
    tagLabelColor: "#0f1923",
  },
  gitGraph: {
    mainBranchName: "main",
    showCommitLabel: true,
    rotateCommitLabel: false,
  },
});

let counter = 0;

export default function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState("");

  useEffect(() => {
    const id = `mermaid-${counter++}`;
    mermaid.render(id, chart).then(({ svg }) => setSvg(svg)).catch(() => {});
  }, [chart]);

  return (
    <div
      ref={ref}
      className="my-4 overflow-x-auto rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
