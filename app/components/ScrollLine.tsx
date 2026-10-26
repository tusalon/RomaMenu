"use client";

import { useEffect, useRef } from "react";

/**
 * Un hilo dorado que zigzaguea por la pagina y se dibuja a medida que se baja, con una gota
 * en la punta. Corre por los margenes y solo cruza el contenido al cambiar de lado, fino y
 * transparente: acompana sin competir con la comida.
 */
const TRAMO = 460; // altura de cada giro del zigzag, en px

export function ScrollLine() {
  const svg = useRef<SVGSVGElement>(null);
  const line = useRef<SVGPathElement>(null);
  const dot = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const s = svg.current, path = line.current, head = dot.current;
    const host = s?.parentElement;
    if (!s || !path || !head || !host) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let length = 1, frame = 0;

    function build() {
      const w = host!.clientWidth, h = host!.clientHeight;
      s!.setAttribute("viewBox", `0 0 ${w} ${h}`);
      s!.setAttribute("width", String(w));
      s!.setAttribute("height", String(h));
      // Curvas en S entre dos carriles, cerca de cada borde.
      // Los carriles caen en los margenes de la pagina: ahi el hilo se ve limpio y solo cruza el contenido al cambiar de lado.
      const margen = (w - Math.min(1180, w - 40)) / 2;
      const izq = Math.min(140, Math.max(12, margen * 0.5)), der = w - izq;
      let d = `M ${der} 0`;
      let x = der;
      for (let y = 0; y < h; y += TRAMO) {
        const next = x === der ? izq : der;
        const y2 = Math.min(y + TRAMO, h);
        const mid = (y + y2) / 2;
        d += ` C ${x} ${mid}, ${next} ${mid}, ${next} ${y2}`;
        x = next;
      }
      path!.setAttribute("d", d);
      length = path!.getTotalLength() || 1;
      path!.style.strokeDasharray = String(length);
      update();
    }

    function update() {
      frame = 0;
      const top = host!.getBoundingClientRect().top;
      // La punta va un poco por debajo del centro de la pantalla.
      const p = reduce ? 1 : Math.min(1, Math.max(0, (window.innerHeight * 0.6 - top) / host!.clientHeight));
      path!.style.strokeDashoffset = String(length * (1 - p));
      const pt = path!.getPointAtLength(length * p);
      head!.setAttribute("cx", String(pt.x));
      head!.setAttribute("cy", String(pt.y));
      head!.style.opacity = !reduce && p > 0.002 && p < 0.998 ? "1" : "0";
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };

    build();
    const ro = new ResizeObserver(build);
    ro.observe(host);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { ro.disconnect(); window.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, []);

  return (
    <svg ref={svg} className="scroll-line" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="scroll-line-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d6a05b" />
          <stop offset="1" stopColor="#b84e14" />
        </linearGradient>
      </defs>
      <path ref={line} fill="none" stroke="url(#scroll-line-gold)" strokeWidth="1.5" strokeLinecap="round" />
      <circle ref={dot} r="4.5" className="scroll-line-dot" />
    </svg>
  );
}
