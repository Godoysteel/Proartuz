import { useEffect, useMemo, useState } from 'react'
import { entregar } from '../arquivo'
import { mediana } from './filtro'
import { paleta } from './paleta'
import Visualizador from './Visualizador'

// Maior lado (px) usado na vetorização. Imagens menores são ampliadas antes: curvas mais suaves.
const QUALIDADE = { rapida: 900, normal: 1600, alta: 2400 } as const
type Qualidade = keyof typeof QUALIDADE

const PRESETS = [
  { nome: 'Logo simples', cores: 6, suavizar: 3, curvas: 20, manchas: 16 },
  { nome: 'Logo colorido', cores: 12, suavizar: 2, curvas: 15, manchas: 12 },
  { nome: 'Detalhado', cores: 24, suavizar: 1, curvas: 8, manchas: 6 },
]

const carregarImg = (src: string): Promise<HTMLImageElement> =>
  new Promise((ok, erro) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = () => erro(new Error('Não foi possível abrir a imagem'))
    img.src = src
  })

const paraBlob = (c: HTMLCanvasElement, tipo = 'image/png') =>
  new Promise<Blob>((ok, erro) => c.toBlob((b) => (b ? ok(b) : erro(new Error('Falha ao gerar imagem'))), tipo))

// Remove camadas totalmente transparentes que o vetorizador gera em imagens com fundo removido.
const limparSvg = (svg: string) => svg.replace(/<path[^>]*opacity="0"[^>]*\/>/g, '')

export default function ArteTela({
  onUsarLogo,
  temProposta,
}: {
  onUsarLogo: (dataUrl: string) => void
  temProposta: boolean
}) {
  const [fonte, setFonte] = useState<Blob | null>(null) // arquivo original
  const [atual, setAtual] = useState<Blob | null>(null) // imagem em uso (após remover fundo)
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null)
  const [svg, setSvg] = useState<string | null>(null)
  const [aba, setAba] = useState<'imagem' | 'vetor'>('imagem')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const [cores, setCores] = useState(12)
  const [manchas, setManchas] = useState(12)
  const [suavizar, setSuavizar] = useState(2)
  const [curvas, setCurvas] = useState(15) // 5..40: quanto maior, curvas mais lisas e simples
  const [qualidade, setQualidade] = useState<Qualidade>('normal')

  const [tolerancia, setTolerancia] = useState(30)
  const [limparBorda, setLimparBorda] = useState(1)

  const [largura, setLargura] = useState(20) // cm
  const [dpi, setDpi] = useState(300)

  const urlImagem = useMemo(() => (atual ? URL.createObjectURL(atual) : null), [atual])
  const urlSvg = useMemo(() => (svg ? URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })) : null), [svg])
  useEffect(() => () => void (urlImagem && URL.revokeObjectURL(urlImagem)), [urlImagem])
  useEffect(() => () => void (urlSvg && URL.revokeObjectURL(urlSvg)), [urlSvg])

  useEffect(() => {
    if (!urlImagem) return setDim(null)
    carregarImg(urlImagem).then((i) => setDim({ w: i.naturalWidth, h: i.naturalHeight }))
  }, [urlImagem])

  const rodar = async (msg: string, fn: () => Promise<void>) => {
    setOcupado(msg)
    setAviso(null)
    try {
      await fn()
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setAviso((e as Error).message || 'Algo deu errado')
    } finally {
      setOcupado(null)
    }
  }

  const escolher = (f: File | undefined) => {
    if (!f) return
    setFonte(f)
    setAtual(f)
    setSvg(null)
    setAba('imagem')
    setAviso(null)
  }

  const removerFundo = () =>
    rodar('Preparando…', async () => {
      const { removeBackground } = await import('@imgly/background-removal')
      const out = await removeBackground(atual!, {
        output: { format: 'image/png' },
        progress: (_chave: string, atualN: number, total: number) =>
          setOcupado(total ? `Removendo fundo… ${Math.round((atualN / total) * 100)}%` : 'Removendo fundo…'),
      })
      setAtual(out)
      setSvg(null)
      setAba('imagem')
    })

  // Fundo liso (branco, cor chapada): apaga só o que está ligado às bordas e parecido com a cor do fundo,
  // então brancos dentro da arte (letras, detalhes) são preservados.
  const removerFundoLiso = () =>
    rodar('Removendo fundo…', async () => {
      await new Promise((r) => setTimeout(r, 30))
      const img = await carregarImg(urlImagem!)
      const w = img.naturalWidth
      const h = img.naturalHeight
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(img, 0, 0)
      const dados = ctx.getImageData(0, 0, w, h)
      const d = dados.data
      // cor do fundo = média de pequenos blocos nos 4 cantos
      let r = 0, g = 0, b = 0, n = 0
      for (const [cx, cy] of [[0, 0], [w - 5, 0], [0, h - 5], [w - 5, h - 5]]) {
        for (let y = Math.max(0, cy); y < Math.min(h, cy + 5); y++)
          for (let x = Math.max(0, cx); x < Math.min(w, cx + 5); x++) {
            const i = (y * w + x) * 4
            r += d[i]; g += d[i + 1]; b += d[i + 2]; n++
          }
      }
      r /= n; g /= n; b /= n
      const limite = tolerancia * tolerancia * 3
      const parecido = (p: number) => {
        const i = p * 4
        if (d[i + 3] === 0) return true
        const dr = d[i] - r, dg = d[i + 1] - g, db = d[i + 2] - b
        return dr * dr + dg * dg + db * db <= limite
      }
      const visto = new Uint8Array(w * h)
      const pilha = new Int32Array(w * h)
      let topo = 0
      const empurra = (p: number) => {
        if (!visto[p] && parecido(p)) {
          visto[p] = 1
          pilha[topo++] = p
        }
      }
      for (let x = 0; x < w; x++) { empurra(x); empurra((h - 1) * w + x) }
      for (let y = 0; y < h; y++) { empurra(y * w); empurra(y * w + w - 1) }
      while (topo) {
        const p = pilha[--topo]
        const x = p % w
        if (x > 0) empurra(p - 1)
        if (x < w - 1) empurra(p + 1)
        if (p >= w) empurra(p - w)
        if (p < w * (h - 1)) empurra(p + w)
      }
      // "Limpar borda": come alguns pixels do contorno, onde ficam franjas claras do JPEG
      for (let k = 0; k < limparBorda; k++) {
        const marcar: number[] = []
        for (let p = 0; p < w * h; p++) {
          if (visto[p]) continue
          const x = p % w
          if ((x > 0 && visto[p - 1]) || (x < w - 1 && visto[p + 1]) || (p >= w && visto[p - w]) || (p < w * (h - 1) && visto[p + w])) marcar.push(p)
        }
        for (const p of marcar) visto[p] = 1
      }
      for (let p = 0; p < w * h; p++) if (visto[p]) d[p * 4 + 3] = 0
      ctx.putImageData(dados, 0, 0)
      setAtual(await paraBlob(c))
      setSvg(null)
      setAba('imagem')
    })

  const vetorizar = () =>
    rodar('Vetorizando…', async () => {
      await new Promise((r) => setTimeout(r, 30)) // deixa a mensagem aparecer antes de travar o processamento
      const img = await carregarImg(urlImagem!)
      const alvo = QUALIDADE[qualidade]
      const s = alvo / Math.max(img.naturalWidth, img.naturalHeight)
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(img.naturalWidth * s))
      c.height = Math.max(1, Math.round(img.naturalHeight * s))
      const cx = c.getContext('2d', { willReadFrequently: true })!
      cx.imageSmoothingQuality = 'high'
      cx.drawImage(img, 0, 0, c.width, c.height)
      const { default: ImageTracer } = await import('imagetracerjs')
      const dados = cx.getImageData(0, 0, c.width, c.height)
      // Borda suavizada (semitransparente) vira opaca ou transparente: evita centenas de camadas de "meio-tom".
      for (let i = 3; i < dados.data.length; i += 4) dados.data[i] = dados.data[i] < 128 ? 0 : 255
      if (suavizar > 0) mediana(dados, Math.ceil(suavizar / 2)) // 1-2: uma passada; 3-4: duas; 5: três
      const out = ImageTracer.imagedataToSVG(dados, {
        pal: paleta(dados, cores), // cores escolhidas por nós; a biblioteca só refina
        colorsampling: 0,
        colorquantcycles: 2,
        pathomit: Math.round((manchas * alvo) / 1100),
        ltres: curvas / 10,
        qtres: curvas / 10,
        blurradius: 0, // o ruído já foi tratado pelo filtro de mediana, que preserva as bordas
        strokewidth: 0,
        roundcoords: 2,
        viewbox: true,
        desc: false,
      })
      setSvg(limparSvg(out))
      setAba('vetor')
    })

  const altura = dim ? (largura * dim.h) / dim.w : 0
  const dpiEfetivo = dim && largura > 0 ? Math.round(dim.w / (largura / 2.54)) : 0
  const semNome = 'arte'

  // SVG com o tamanho físico embutido, para abrir na medida certa em programas de edição.
  const svgComTamanho = () =>
    svg!.replace('<svg ', `<svg width="${largura.toFixed(2)}cm" height="${altura.toFixed(2)}cm" `)

  const rasterizar = async (larguraPx: number): Promise<HTMLCanvasElement> => {
    const c = document.createElement('canvas')
    c.width = Math.round(larguraPx)
    c.height = Math.round((larguraPx * dim!.h) / dim!.w)
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    if (svg) {
      // o SVG é redesenhado no tamanho final: sai nítido em qualquer resolução
      const u = URL.createObjectURL(new Blob([svgComTamanho()], { type: 'image/svg+xml' }))
      try {
        ctx.drawImage(await carregarImg(u), 0, 0, c.width, c.height)
      } finally {
        URL.revokeObjectURL(u)
      }
    } else {
      ctx.drawImage(await carregarImg(urlImagem!), 0, 0, c.width, c.height)
    }
    return c
  }

  const baixarSvg = () =>
    rodar('Gerando SVG…', async () => {
      await entregar(new Blob([svgComTamanho()], { type: 'image/svg+xml' }), `${semNome}.svg`)
    })

  const baixarPdf = () =>
    rodar('Gerando PDF…', async () => {
      const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')])
      const w = largura * 10
      const h = altura * 10
      const doc = new jsPDF({ unit: 'mm', format: [w, h], orientation: w > h ? 'l' : 'p' })
      const host = document.createElement('div')
      host.style.cssText = 'position:fixed;left:-99999px;top:0;width:1000px'
      host.innerHTML = svgComTamanho()
      document.body.appendChild(host)
      try {
        await svg2pdf(host.querySelector('svg')!, doc, { x: 0, y: 0, width: w, height: h })
      } finally {
        host.remove()
      }
      await entregar(doc.output('blob'), `${semNome}-${largura}cm.pdf`)
    })

  const baixarPng = () =>
    rodar('Gerando PNG…', async () => {
      const px = Math.min(9000, (largura / 2.54) * dpi)
      const c = await rasterizar(px)
      await entregar(await paraBlob(c), `${semNome}-${largura}cm-${dpi}dpi.png`)
    })

  const usarLogo = () =>
    rodar('Aplicando…', async () => {
      const c = await rasterizar(500)
      onUsarLogo(c.toDataURL('image/png'))
      setAviso(temProposta ? 'Logo aplicado na proposta aberta e nas próximas.' : 'Logo salvo para as próximas propostas.')
    })

  return (
    <div className="app">
      <header className="topo">
        <h1>Proartuz · Arte</h1>
      </header>
      <main>
        <section className="card">
          <h2>Imagem</h2>
          <input type="file" accept="image/*" onChange={(e) => escolher(e.target.files?.[0])} />
          {urlImagem && (
            <>
              <div className="abas">
                <button className={aba === 'imagem' ? 'ativo' : ''} onClick={() => setAba('imagem')}>
                  Imagem
                </button>
                <button className={aba === 'vetor' ? 'ativo' : ''} disabled={!svg} onClick={() => setAba('vetor')}>
                  Vetor
                </button>
              </div>
              <Visualizador dim={dim} urlImagem={urlImagem} svg={svg} modo={aba} resetKey={fonte} />
              {dim && (
                <small className="dica">
                  {dim.w} × {dim.h} px{svg && aba === 'vetor' ? ' · vetor: sem limite de tamanho' : ''} · role para dar zoom, arraste para mover
                </small>
              )}
            </>
          )}
          {!urlImagem && <p className="dica">Escolha uma logo, arte ou imagem gerada por IA.</p>}
        </section>

        {urlImagem && (
          <>
            <section className="card">
              <h2>Fundo</h2>
              <p className="dica sem-topo">
                <b>Fundo liso</b> (branco ou uma cor só) é o mais preciso para logos: preserva os brancos dentro da arte.
                <b> IA</b> serve para fotos e fundos complicados, mas pode apagar partes claras da arte.
              </p>
              <label className="campo">
                <span>Tolerância da cor: {tolerancia}</span>
                <input type="range" min="5" max="90" value={tolerancia} onChange={(e) => setTolerancia(Number(e.target.value))} />
              </label>
              <label className="campo">
                <span>Limpar borda (px): {limparBorda}</span>
                <input type="range" min="0" max="4" value={limparBorda} onChange={(e) => setLimparBorda(Number(e.target.value))} />
              </label>
              <div className="linha2">
                <button className="pri" disabled={!!ocupado} onClick={removerFundoLiso}>
                  Remover fundo liso
                </button>
                <button className="sec" disabled={!!ocupado} onClick={removerFundo}>
                  Remover com IA
                </button>
              </div>
              <button
                className="sec cheio"
                disabled={!!ocupado || atual === fonte}
                onClick={() => {
                  setAtual(fonte)
                  setSvg(null)
                  setAba('imagem')
                }}
              >
                Restaurar original
              </button>
              <small className="dica">A IA baixa um modelo (cerca de 40 MB) na primeira vez e precisa de internet.</small>
            </section>

            <section className="card">
              <h2>Vetorizar</h2>
              <div className="estilos">
                {PRESETS.map((p) => (
                  <button
                    key={p.nome}
                    className="chip"
                    onClick={() => {
                      setCores(p.cores)
                      setSuavizar(p.suavizar)
                      setCurvas(p.curvas)
                      setManchas(p.manchas)
                    }}
                  >
                    {p.nome}
                  </button>
                ))}
              </div>
              <label className="campo">
                <span>Cores: {cores}</span>
                <input type="range" min="2" max="32" value={cores} onChange={(e) => setCores(Number(e.target.value))} />
              </label>
              <label className="campo">
                <span>Curvas mais lisas: {curvas}</span>
                <input type="range" min="5" max="40" value={curvas} onChange={(e) => setCurvas(Number(e.target.value))} />
              </label>
              <label className="campo">
                <span>Reduzir ruído (JPEG): {suavizar}</span>
                <input type="range" min="0" max="5" value={suavizar} onChange={(e) => setSuavizar(Number(e.target.value))} />
              </label>
              <label className="campo">
                <span>Ignorar manchas pequenas: {manchas}</span>
                <input type="range" min="0" max="50" value={manchas} onChange={(e) => setManchas(Number(e.target.value))} />
              </label>
              <div className="abas">
                {(['rapida', 'normal', 'alta'] as const).map((q) => (
                  <button key={q} className={qualidade === q ? 'ativo' : ''} onClick={() => setQualidade(q)}>
                    {q === 'rapida' ? 'Rápida' : q === 'normal' ? 'Normal' : 'Alta'}
                  </button>
                ))}
              </div>
              <button className="pri cheio" disabled={!!ocupado} onClick={vetorizar}>
                {svg ? 'Vetorizar de novo' : 'Vetorizar'}
              </button>
              <small className="dica">
                Funciona melhor em logos e ilustrações. Uma imagem pequena ou já comprimida (como as do WhatsApp) limita o
                resultado: use "Alta" e "Reduzir ruído", ou peça o arquivo original ao cliente.
              </small>
            </section>

            <section className="card">
              <h2>Tamanho e exportação</h2>
              <div className="linha2">
                <label className="campo">
                  <span>Largura (cm)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="1"
                    value={largura}
                    onChange={(e) => setLargura(Math.max(1, Number(e.target.value) || 1))}
                  />
                </label>
                <label className="campo">
                  <span>Altura (cm)</span>
                  <input type="text" readOnly value={altura ? altura.toFixed(1) : ''} />
                </label>
              </div>
              {!svg && dim && (
                <small className={'dica ' + (dpiEfetivo < 150 ? 'alerta' : '')}>
                  Nesse tamanho a imagem tem {dpiEfetivo} dpi. Adesivo pede 300; lona vista de longe, 100 a 150.
                  {dpiEfetivo < 150 && ' Vetorize para não perder qualidade.'}
                </small>
              )}
              <label className="campo">
                <span>Resolução do PNG (dpi)</span>
                <input type="number" inputMode="numeric" min="50" max="600" value={dpi} onChange={(e) => setDpi(Math.max(50, Number(e.target.value) || 300))} />
              </label>
              <div className="exportar">
                <button className="sec" disabled={!!ocupado || !svg} onClick={baixarSvg}>
                  SVG
                </button>
                <button className="sec" disabled={!!ocupado || !svg} onClick={baixarPdf}>
                  PDF vetor
                </button>
                <button className="sec" disabled={!!ocupado} onClick={baixarPng}>
                  PNG
                </button>
              </div>
              <button className="sec" disabled={!!ocupado} onClick={usarLogo}>
                Usar como logo nas propostas
              </button>
              {!svg && <small className="dica">SVG e PDF vetor ficam disponíveis depois de vetorizar.</small>}
            </section>
          </>
        )}

        {aviso && <p className="aviso">{aviso}</p>}
      </main>
      {ocupado && (
        <div className="ocupado" role="status">
          <div>{ocupado}</div>
        </div>
      )}
    </div>
  )
}
