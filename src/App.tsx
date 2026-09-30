import { useEffect, useMemo, useState } from 'react'
import type { CoverStyle, Parte, Proposta } from './types'
import {
  QUADRO_H,
  QUADRO_W,
  areaVisivel,
  brl,
  carregarImg,
  carregarLogo,
  carregarOriginal,
  dataBR,
  novaProposta,
  totais,
  uid,
} from './util'
import { useRef } from 'react'
import { desenharCapa } from './capaPreview'
import { gerarPdf } from './pdf'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

const KEY = 'propostas.v1'

const carregar = (): Proposta[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export default function App() {
  const [lista, setLista] = useState<Proposta[]>(carregar)
  const [aberta, setAberta] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lista))
    } catch {
      alert('Sem espaço para salvar. Use imagens de capa menores.')
    }
  }, [lista])

  const atual = lista.find((p) => p.id === aberta)

  const salvar = (p: Proposta) => {
    localStorage.setItem('emitente', JSON.stringify(p.emitente))
    if (p.logo) localStorage.setItem('logo', p.logo)
    setLista((l) => l.map((x) => (x.id === p.id ? { ...p, atualizadaEm: Date.now() } : x)))
  }

  if (atual) return <Editor key={atual.id} proposta={atual} onChange={salvar} onVoltar={() => setAberta(null)} />

  const criar = () => {
    const p = novaProposta()
    setLista((l) => [p, ...l])
    setAberta(p.id)
  }

  return (
    <div className="app">
      <header className="topo">
        <h1>Proartuz</h1>
      </header>
      <main>
        {lista.length === 0 && <p className="vazio">Nenhuma proposta ainda. Toque em “Nova proposta”.</p>}
        {lista
          .slice()
          .sort((a, b) => b.atualizadaEm - a.atualizadaEm)
          .map((p) => (
            <div key={p.id} className="card lista-item" onClick={() => setAberta(p.id)}>
              <div>
                <strong>{p.cliente.nome || 'Sem cliente'}</strong>
                <small>
                  {dataBR(p.data)} · {brl(totais(p).total)}
                </small>
              </div>
              <div className="acoes">
                <button
                  className="link"
                  onClick={(e) => {
                    e.stopPropagation()
                    const c = { ...structuredClone(p), id: uid(), atualizadaEm: Date.now() }
                    setLista((l) => [c, ...l])
                  }}
                >
                  Duplicar
                </button>
                <button
                  className="link perigo"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm('Excluir esta proposta?')) setLista((l) => l.filter((x) => x.id !== p.id))
                  }}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
      </main>
      <button className="fab" onClick={criar}>
        + Nova proposta
      </button>
    </div>
  )
}

const Campo = ({
  rotulo,
  valor,
  onChange,
  tipo = 'text',
  multi,
  ...rest
}: {
  rotulo: string
  valor: string | number
  onChange: (v: string) => void
  tipo?: string
  multi?: boolean
} & Record<string, unknown>) => (
  <label className="campo">
    <span>{rotulo}</span>
    {multi ? (
      <textarea rows={4} value={valor} onChange={(e) => onChange(e.target.value)} />
    ) : (
      <input type={tipo} value={valor} onChange={(e) => onChange(e.target.value)} {...rest} />
    )}
  </label>
)

function ParteForm({ p, onChange }: { p: Parte; onChange: (p: Parte) => void }) {
  const set = (k: keyof Parte) => (v: string) => onChange({ ...p, [k]: v })
  return (
    <>
      <Campo rotulo="Nome / Razão social" valor={p.nome} onChange={set('nome')} />
      <Campo rotulo="CNPJ / CPF" valor={p.documento} onChange={set('documento')} inputMode="numeric" />
      <Campo rotulo="Endereço" valor={p.endereco} onChange={set('endereco')} />
      <Campo rotulo="E-mail" valor={p.email} onChange={set('email')} tipo="email" />
      <Campo rotulo="Telefone" valor={p.telefone} onChange={set('telefone')} tipo="tel" />
    </>
  )
}

function CapaPreview({ p, onChange }: { p: Proposta; onChange: (v: { zoom: number; x: number; y: number }) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [foto, setFoto] = useState<HTMLImageElement | null>(null)
  const [logo, setLogo] = useState<HTMLImageElement | null>(null)
  const arraste = useRef<{ px: number; py: number } | null>(null)
  const { capa } = p
  const zoom = capa.imgZoom ?? 1
  const x = capa.imgX ?? 0.5
  const y = capa.imgY ?? 0.5
  const editavel = capa.estilo === 'imagem' && !!foto

  useEffect(() => {
    if (capa.imagem) carregarImg(capa.imagem).then(setFoto)
    else setFoto(null)
  }, [capa.imagem])
  useEffect(() => {
    if (p.logo) carregarImg(p.logo).then(setLogo)
    else setLogo(null)
  }, [p.logo])

  useEffect(() => {
    const c = ref.current
    if (c) desenharCapa(c.getContext('2d')!, c.width, p, foto, logo)
  }, [p, foto, logo])

  const limita = (n: number) => Math.min(1, Math.max(0, n))
  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!arraste.current || !foto) return
    const box = e.currentTarget.getBoundingClientRect()
    const mmPorPx = 210 / box.width
    const dx = (e.clientX - arraste.current.px) * mmPorPx
    const dy = (e.clientY - arraste.current.py) * mmPorPx
    arraste.current = { px: e.clientX, py: e.clientY }
    const a = areaVisivel(foto.width, foto.height, zoom, x, y)
    // arrastar a foto para a direita = mostrar mais da esquerda dela
    const nx = foto.width - a.vw > 1 ? x - (dx / QUADRO_W) * (a.vw / (foto.width - a.vw)) : x
    const ny = foto.height - a.vh > 1 ? y - (dy / QUADRO_H) * (a.vh / (foto.height - a.vh)) : y
    onChange({ zoom, x: limita(nx), y: limita(ny) })
  }

  return (
    <div className="enquadrar">
      <canvas
        ref={ref}
        width={630}
        height={891}
        className={editavel ? 'editavel' : ''}
        onPointerDown={(e) => {
          if (!editavel) return
          e.currentTarget.setPointerCapture?.(e.pointerId)
          arraste.current = { px: e.clientX, py: e.clientY }
        }}
        onPointerMove={mover}
        onPointerUp={() => (arraste.current = null)}
        onPointerCancel={() => (arraste.current = null)}
      />
      <small>
        Prévia da folha (A4): a foto fica no fundo da faixa do título.
        {capa.estilo === 'imagem' && ' Arraste a foto para enquadrar.'}
      </small>
      {capa.estilo === 'imagem' && capa.imagem && (
        <label className="zoom">
          <span>Zoom</span>
          <input
            type="range"
            min="1"
            max="4"
            step="0.05"
            value={zoom}
            onChange={(e) => onChange({ zoom: Number(e.target.value), x, y })}
          />
        </label>
      )}
    </div>
  )
}

const ESTILOS: { id: CoverStyle; nome: string }[] = [
  { id: 'solida', nome: 'Cor de fundo' },
  { id: 'imagem', nome: 'Foto de fundo' },
]

const CORES = ['#0f3d5e', '#1b1b1b', '#b3261e', '#1f7a4d', '#c77d0a', '#5b3fa0']

function Editor({
  proposta,
  onChange,
  onVoltar,
}: {
  proposta: Proposta
  onChange: (p: Proposta) => void
  onVoltar: () => void
}) {
  const [p, setP] = useState(proposta)
  const [gerando, setGerando] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => onChange(p), 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p])

  const { subtotal, total } = useMemo(() => totais(p), [p])
  const up = (patch: Partial<Proposta>) => setP((x) => ({ ...x, ...patch }))
  const upCapa = (patch: Partial<Proposta['capa']>) => setP((x) => ({ ...x, capa: { ...x.capa, ...patch } }))

  const gerar = async (compartilhar: boolean) => {
    setGerando(true)
    try {
      const { blob, nome } = await gerarPdf(p)
      if (Capacitor.isNativePlatform()) {
        // No app Android o WebView não baixa blobs: salva em arquivo e abre o menu de compartilhar.
        const dados = await new Promise<string>((res) => {
          const r = new FileReader()
          r.onload = () => res((r.result as string).split(',')[1])
          r.readAsDataURL(blob)
        })
        const salvo = await Filesystem.writeFile({ path: nome, data: dados, directory: Directory.Cache })
        await Share.share({ title: nome, url: salvo.uri, dialogTitle: 'Enviar proposta' })
        return
      }
      const file = new File([blob], nome, { type: 'application/pdf' })
      if (compartilhar && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: nome })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = nome
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 10000)
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') alert('Erro ao gerar PDF: ' + (e as Error).message)
    } finally {
      setGerando(false)
    }
  }

  return (
    <div className="app">
      <header className="topo">
        <button className="link claro" onClick={onVoltar}>
          ‹ Voltar
        </button>
        <h1>{p.cliente.nome || 'Nova proposta'}</h1>
      </header>
      <main>
        <section className="card">
          <h2>Título e capa</h2>
          <CapaPreview p={p} onChange={(v) => upCapa({ imgZoom: v.zoom, imgX: v.x, imgY: v.y })} />
          <div className="estilos">
            {ESTILOS.map((e) => (
              <button
                key={e.id}
                className={'chip' + (p.capa.estilo === e.id ? ' ativo' : '')}
                onClick={() => upCapa({ estilo: e.id })}
              >
                {e.nome}
              </button>
            ))}
          </div>
          <Campo rotulo="Título da capa" valor={p.capa.titulo} onChange={(v) => upCapa({ titulo: v })} />
          <Campo rotulo="Subtítulo (opcional)" valor={p.capa.subtitulo} onChange={(v) => upCapa({ subtitulo: v })} />
          <div className="campo">
            <span>Cor</span>
            <div className="cores">
              {CORES.map((c) => (
                <button
                  key={c}
                  aria-label={c}
                  className={'cor' + (p.capa.cor === c ? ' ativo' : '')}
                  style={{ background: c }}
                  onClick={() => upCapa({ cor: c })}
                />
              ))}
              <input type="color" value={p.capa.cor} onChange={(e) => upCapa({ cor: e.target.value })} />
            </div>
          </div>
          {p.capa.estilo === 'imagem' && (
            <div className="campo">
              <span>Foto da capa</span>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (f) upCapa({ imagem: await carregarOriginal(f), imgZoom: 1, imgX: 0.5, imgY: 0.5 })
                }}
              />
            </div>
          )}
          <label className="campo">
            <span>Logo (aparece na capa e no cabeçalho)</span>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) up({ logo: await carregarLogo(f) })
              }}
            />
            {p.logo && (
              <div className="logo-prev">
                <img src={p.logo} alt="Logo" />
                <button className="link perigo" onClick={() => up({ logo: '' })}>
                  Remover
                </button>
              </div>
            )}
          </label>
        </section>

        <section className="card">
          <h2>Proposta</h2>
          <div className="linha2">
            <Campo rotulo="Data" tipo="date" valor={p.data} onChange={(v) => up({ data: v })} />
            <Campo
              rotulo="Validade (dias)"
              tipo="number"
              inputMode="numeric"
              valor={p.validadeDias}
              onChange={(v) => up({ validadeDias: Number(v) || 0 })}
            />
          </div>
          <Campo
            rotulo="Texto de apresentação"
            multi
            valor={p.apresentacao}
            onChange={(v) => up({ apresentacao: v })}
          />
        </section>

        <section className="card">
          <h2>Seus dados (emitente)</h2>
          <ParteForm p={p.emitente} onChange={(v) => up({ emitente: v })} />
        </section>

        <section className="card">
          <h2>Cliente</h2>
          <ParteForm p={p.cliente} onChange={(v) => up({ cliente: v })} />
        </section>

        <section className="card">
          <h2>Produtos e serviços</h2>
          {p.itens.map((i, idx) => {
            const setI = (patch: Partial<typeof i>) =>
              up({ itens: p.itens.map((x) => (x.id === i.id ? { ...x, ...patch } : x)) })
            return (
              <div key={i.id} className="item">
                <Campo rotulo={`Item ${idx + 1}`} valor={i.descricao} onChange={(v) => setI({ descricao: v })} />
                <Campo rotulo="Detalhe (opcional)" valor={i.detalhe} onChange={(v) => setI({ detalhe: v })} />
                <div className="linha2">
                  <Campo
                    rotulo="Qtd"
                    tipo="number"
                    inputMode="decimal"
                    valor={i.qtd}
                    onChange={(v) => setI({ qtd: Number(v) || 0 })}
                  />
                  <Campo
                    rotulo="Valor unitário (R$)"
                    tipo="number"
                    inputMode="decimal"
                    step="0.01"
                    valor={i.valor}
                    onChange={(v) => setI({ valor: Number(v) || 0 })}
                  />
                </div>
                <div className="item-rodape">
                  <strong>{brl(i.qtd * i.valor)}</strong>
                  {p.itens.length > 1 && (
                    <button className="link perigo" onClick={() => up({ itens: p.itens.filter((x) => x.id !== i.id) })}>
                      Remover item
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          <button
            className="sec"
            onClick={() =>
              up({ itens: [...p.itens, { id: uid(), descricao: '', detalhe: '', qtd: 1, valor: 0 }] })
            }
          >
            + Adicionar item
          </button>
          <Campo
            rotulo="Desconto (R$)"
            tipo="number"
            inputMode="decimal"
            step="0.01"
            valor={p.desconto}
            onChange={(v) => up({ desconto: Number(v) || 0 })}
          />
          <div className="totais">
            <span>Subtotal {brl(subtotal)}</span>
            <strong>Total {brl(total)}</strong>
          </div>
        </section>

        <section className="card">
          <h2>Condições e textos</h2>
          {p.secoes.map((s) => {
            const setS = (patch: Partial<typeof s>) =>
              up({ secoes: p.secoes.map((x) => (x.id === s.id ? { ...x, ...patch } : x)) })
            return (
              <div key={s.id} className="item">
                <Campo rotulo="Título" valor={s.titulo} onChange={(v) => setS({ titulo: v })} />
                <Campo rotulo="Texto" multi valor={s.texto} onChange={(v) => setS({ texto: v })} />
                <button className="link perigo" onClick={() => up({ secoes: p.secoes.filter((x) => x.id !== s.id) })}>
                  Remover seção
                </button>
              </div>
            )
          })}
          <button className="sec" onClick={() => up({ secoes: [...p.secoes, { id: uid(), titulo: '', texto: '' }] })}>
            + Adicionar seção
          </button>
        </section>
      </main>

      <div className="barra">
        <button className="sec" disabled={gerando} onClick={() => gerar(false)}>
          Baixar PDF
        </button>
        <button className="pri" disabled={gerando} onClick={() => gerar(true)}>
          {gerando ? 'Gerando…' : 'Compartilhar PDF'}
        </button>
      </div>
    </div>
  )
}
