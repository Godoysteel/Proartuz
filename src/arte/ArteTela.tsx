import { useEffect, useMemo, useState } from 'react'
import { entregar } from '../arquivo'
import Visualizador from './Visualizador'

const MAX_TRACO = 1100 // maior lado (px) usado na vetorização: equilíbrio entre detalhe e velocidade

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

  const [cores, setCores] = useState(8)
  const [manchas, setManchas] = useState(8)
  const [suavizar, setSuavizar] = useState(1)

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

  const vetorizar = () =>
    rodar('Vetorizando…', async () => {
      await new Promise((r) => setTimeout(r, 30)) // deixa a mensagem aparecer antes de travar o processamento
      const img = await carregarImg(urlImagem!)
      const s = Math.min(1, MAX_TRACO / Math.max(img.naturalWidth, img.naturalHeight))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(img.naturalWidth * s))
      c.height = Math.max(1, Math.round(img.naturalHeight * s))
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      const { default: ImageTracer } = await import('imagetracerjs')
      const dados = c.getContext('2d')!.getImageData(0, 0, c.width, c.height)
      // Borda suavizada (semitransparente) vira opaca ou transparente: evita centenas de camadas de "meio-tom".
      for (let i = 3; i < dados.data.length; i += 4) dados.data[i] = dados.data[i] < 128 ? 0 : 255
      const out = ImageTracer.imagedataToSVG(dados, {
        numberofcolors: cores,
        colorsampling: 2,
        colorquantcycles: 4,
        pathomit: manchas,
        ltres: 1,
        qtres: 1,
        blurradius: suavizar,
        blurdelta: 20,
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
              <div className="linha2">
                <button className="sec" disabled={!!ocupado} onClick={removerFundo}>
                  Remover fundo
                </button>
                <button
                  className="sec"
                  disabled={!!ocupado || atual === fonte}
                  onClick={() => {
                    setAtual(fonte)
                    setSvg(null)
                    setAba('imagem')
                  }}
                >
                  Restaurar original
                </button>
              </div>
              <small className="dica">Na primeira vez baixa o modelo de IA (cerca de 40 MB) e precisa de internet.</small>
            </section>

            <section className="card">
              <h2>Vetorizar</h2>
              <label className="campo">
                <span>Cores: {cores}</span>
                <input type="range" min="2" max="32" value={cores} onChange={(e) => setCores(Number(e.target.value))} />
              </label>
              <label className="campo">
                <span>Ignorar manchas pequenas: {manchas}</span>
                <input type="range" min="0" max="50" value={manchas} onChange={(e) => setManchas(Number(e.target.value))} />
              </label>
              <label className="campo">
                <span>Suavizar: {suavizar}</span>
                <input type="range" min="0" max="5" value={suavizar} onChange={(e) => setSuavizar(Number(e.target.value))} />
              </label>
              <button className="pri cheio" disabled={!!ocupado} onClick={vetorizar}>
                {svg ? 'Vetorizar de novo' : 'Vetorizar'}
              </button>
              <small className="dica">
                Funciona melhor em logos e ilustrações com poucas cores. Em fotos o resultado fica artificial.
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
