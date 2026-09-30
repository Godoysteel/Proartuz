# Proartuz

PWA (React + Vite + jsPDF) para gerar propostas comerciais em PDF pelo celular.
Tudo roda no aparelho: os dados ficam no localStorage e o PDF é gerado no navegador.

- Capa editável: cor sólida, faixa lateral ou foto de fundo, título, subtítulo, cor e logo.
- Emitente e logo ficam salvos e pré-preenchem as próximas propostas.
- Seções de texto livres (pagamento, prazo, garantia...), itens, desconto, validade.
- "Compartilhar PDF" abre o menu do celular (WhatsApp, e-mail); no PC baixa o arquivo.

## Rodar
npm install && npm run dev      # desenvolvimento
npm run build                   # gera dist/ (PWA)

## Instalar no celular
O PWA precisa de HTTPS. Publique a pasta `dist/` (ex.: Vercel: GitHub Pages (workflow já incluído) ou Vercel),
abra o link no Chrome/Safari do celular e use "Adicionar à tela inicial".

## Fluxo
Desenvolva e teste no PC com `npm run dev` (http://localhost:5173). Nada vai para o celular até publicar:
`git tag vX.Y.Z && git push origin vX.Y.Z` publica o site (GitHub Pages) e gera o APK em Releases.

## Área Arte
Ferramenta dentro do app (botão "Arte" na barra): remove fundo (IA no navegador, baixa ~40 MB na 1ª vez), vetoriza (imagetracerjs) e exporta SVG, PDF vetorial e PNG no tamanho em cm. Carrega sob demanda (lazy) para não pesar a área de propostas.
