import { useCallback, useEffect, useRef, useState } from 'react'

type Vista = { s: number; x: number; y: number } // s = px de tela por px da imagem; x,y = deslocamento

const ZOOM_MAX = 40 // 4000%: dá para ver cada pixel das bordas

// Visualizador com zoom (roda do mouse, pinça, botões) e arraste. Mantém posição ao alternar imagem/vetor.
export default function Visualizador({
  dim,
  urlImagem,
  svg,
  modo,
  resetKey,
}: {
  dim: { w: number; h: number } | null
  urlImagem: string
  svg: string | null
  modo: 'imagem' | 'vetor'
  resetKey: unknown
}) {
  const area = useRef<HTMLDivElement>(null)
  const [tam, setTam] = useState({ w: 0, h: 0 })
  const [v, setV] = useState<Vista>({ s: 1, x: 0, y: 0 })
  const [cheia, setCheia] = useState(false)
  const encaixado = useRef(true)
  const ponteiros = useRef(new Map<number, { x: number; y: number }>())
  const distancia = useRef(0)

  const fit = dim && tam.w ? Math.min(tam.w / dim.w, tam.h / dim.h) : 1
  const maxS = Math.max(ZOOM_MAX, fit)

  // mantém a imagem dentro da área (centralizada quando menor que ela)
  const limita = useCallback(
    (s: number, x: number, y: number): Vista => {
      if (!dim) return { s, x, y }
      const W = dim.w * s
      const H = dim.h * s
      return {
        s,
        x: W <= tam.w ? (tam.w - W) / 2 : Math.min(0, Math.max(tam.w - W, x)),
        y: H <= tam.h ? (tam.h - H) / 2 : Math.min(0, Math.max(tam.h - H, y)),
      }
    },
    [dim, tam],
  )

  const zoomEm = useCallback(
    (p: Vista, cx: number, cy: number, fator: number): Vista => {
      const s2 = Math.min(maxS, Math.max(fit, p.s * fator))
      const k = s2 / p.s
      const n = limita(s2, cx - (cx - p.x) * k, cy - (cy - p.y) * k)
      encaixado.current = s2 <= fit * 1.001
      return n
    },
    [fit, maxS, limita],
  )

  const ajustar = useCallback(() => {
    encaixado.current = true
    setV(limita(fit, 0, 0))
  }, [fit, limita])

  useEffect(() => {
    const el = area.current
    if (!el) return
    const ro = new ResizeObserver(() => setTam({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setTam({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [cheia])

  // nova imagem ou novo tamanho da área: reencaixa (se estava encaixado) ou só reajusta os limites
  useEffect(() => {
    if (!dim || !tam.w) return
    if (encaixado.current) setV(limita(fit, 0, 0))
    else setV((p) => limita(Math.max(fit, p.s), p.x, p.y))
  }, [dim, tam, fit, limita])
  useEffect(() => {
    encaixado.current = true
    setV(limita(fit, 0, 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  // roda do mouse (precisa de listener não passivo para impedir a rolagem da página)
  useEffect(() => {
    const el = area.current
    if (!el) return
    const roda = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018))
      setV((p) => zoomEm(p, e.clientX - r.left, e.clientY - r.top, f))
    }
    el.addEventListener('wheel', roda, { passive: false })
    return () => el.removeEventListener('wheel', roda)
  }, [zoomEm])

  const dist = () => {
    const [a, b] = [...ponteiros.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  const aoMover = (e: React.PointerEvent) => {
    const ant = ponteiros.current.get(e.pointerId)
    if (!ant) return
    const r = area.current!.getBoundingClientRect()
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (ponteiros.current.size === 2) {
      const d = dist()
      const [a, b] = [...ponteiros.current.values()]
      const f = distancia.current ? d / distancia.current : 1
      distancia.current = d
      setV((p) => zoomEm(p, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, f))
    } else {
      const dx = e.clientX - ant.x
      const dy = e.clientY - ant.y
      setV((p) => limita(p.s, p.x + dx, p.y + dy))
    }
  }

  const centro = () => ({ x: tam.w / 2, y: tam.h / 2 })
  const passo = (f: number) => {
    const c = centro()
    setV((p) => zoomEm(p, c.x, c.y, f))
  }
  const tamanhoReal = () => {
    const c = centro()
    setV((p) => zoomEm(p, c.x, c.y, Math.max(1, fit) / p.s))
  }

  return (
    <div className={'visor' + (cheia ? ' cheia' : '')}>
      <div
        ref={area}
        className="visor-area fundo-xadrez"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId)
          ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
          if (ponteiros.current.size === 2) distancia.current = dist()
        }}
        onPointerMove={aoMover}
        onPointerUp={(e) => {
          ponteiros.current.delete(e.pointerId)
          distancia.current = 0
        }}
        onPointerCancel={(e) => {
          ponteiros.current.delete(e.pointerId)
          distancia.current = 0
        }}
        onDoubleClick={(e) => {
          const r = area.current!.getBoundingClientRect()
          const cx = e.clientX - r.left
          const cy = e.clientY - r.top
          setV((p) => (p.s > fit * 1.5 ? limita(fit, 0, 0) : zoomEm(p, cx, cy, Math.max(8, fit * 4) / p.s)))
        }}
      >
        {dim && tam.w > 0 && (
          <div
            className="visor-conteudo"
            style={{ width: dim.w, height: dim.h, transform: `translate(${v.x}px, ${v.y}px) scale(${v.s})` }}
          >
            {modo === 'vetor' && svg ? (
              <div className="svg-inline" dangerouslySetInnerHTML={{ __html: svg }} />
            ) : (
              <img src={urlImagem} alt="Prévia" draggable={false} style={{ imageRendering: v.s > 2 ? 'pixelated' : 'auto' }} />
            )}
          </div>
        )}
      </div>
      <div className="visor-barra">
        <button onClick={() => passo(1 / 1.6)} aria-label="Diminuir zoom">
          −
        </button>
        <span>{Math.round(v.s * 100)}%</span>
        <button onClick={() => passo(1.6)} aria-label="Aumentar zoom">
          +
        </button>
        <button onClick={ajustar}>Ajustar</button>
        <button onClick={tamanhoReal}>100%</button>
        <button onClick={() => setCheia((c) => !c)}>{cheia ? 'Fechar' : 'Tela cheia'}</button>
      </div>
    </div>
  )
}
