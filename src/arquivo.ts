import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

// Entrega um arquivo gerado: no app Android salva e abre o menu de compartilhar
// (o WebView não baixa blobs); no navegador compartilha ou baixa.
export async function entregar(blob: Blob, nome: string, compartilhar = false) {
  if (Capacitor.isNativePlatform()) {
    const dados = await new Promise<string>((res) => {
      const r = new FileReader()
      r.onload = () => res((r.result as string).split(',')[1])
      r.readAsDataURL(blob)
    })
    const salvo = await Filesystem.writeFile({ path: nome, data: dados, directory: Directory.Cache })
    await Share.share({ title: nome, url: salvo.uri, dialogTitle: 'Enviar arquivo' })
    return
  }
  const file = new File([blob], nome, { type: blob.type })
  if (compartilhar && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: nome })
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
