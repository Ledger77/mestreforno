# Mestre Forno

Site da Mestre Forno, salgados e pizzas em Manaus/AM. Página estática (`index.html`, CSS e um JavaScript pequeno), sem etapa de build, para o GitHub Pages servir da raiz do branch padrão.

Os caminhos de imagem, CSS e JS são relativos. O endereço público de hoje é `https://ledger77.github.io/mestreforno/`. O domínio `mestreforno.com.br` entra depois, pelo [checklist de DNS e HTTPS](docs/checklist-dominio.md). Não há arquivo `CNAME` nesta fase.

## Ver no computador

Na pasta do projeto:

```bash
python3 -m http.server 8000
```

Abra `http://localhost:8000/`. Para ver como no GitHub Pages, sirva a pasta pai e abra `/mestreforno/`.

## Editar o cardápio

A lista editável é **`js/cardapio.js`**. Com JavaScript, a página monta os cartões e os filtros (Salgados, Pizzas) a partir dela.

- Preço é texto, no formato `"R$ 8,00"`. Enquanto não houver preço, deixe `"R$ --,--"`.
- `exemplo: true` mostra a etiqueta “Exemplo”. No item oficial, use `exemplo: false`.
- Para um produto novo, copie um bloco `{ ... }` para dentro de `itens`. Um grupo novo, com `id` e `titulo`, também ganha filtro.

A mesma lista está escrita na seção Cardápio do **`index.html`**, para quem abre o site sem JavaScript. Se mudar um item no arquivo JS, mude o cartão correspondente no HTML.

## Editar o WhatsApp

Número e mensagem ficam em **`js/config.js`**, na constante `SITE`.

- `whatsapp`: DDI + DDD + número, só dígitos. `5592992487642` é um marcador.
- `mensagem`: o texto que já abre na conversa. O padrão é `Olá, Mestre Forno! Quero fazer um pedido.`

Os botões já nascem com o link `wa.me` no HTML (`index.html` e `404.html`), então o pedido abre sem JavaScript. Se trocar o número ou a mensagem, atualize `SITE` e também esses `href`.

## Editar o endereço público

`SITE.siteUrl` em `js/config.js` guarda o endereço. Canonical, Open Graph, JSON-LD, `sitemap.xml`, `robots.txt` e o `404.html` repetem a mesma URL para os buscadores. A lista completa está no checklist do domínio.

## Editar os textos

Hero, aviso do cardápio, como pedir, entrega, horário, retirada, sobre e rodapé estão no **`index.html`**. O Instagram do rodapé é `https://instagram.com/mestreforno`.

## Marca

- Preto `#000000`, amarelo `#FFC629`, branco `#FFFFFF`.
- Texto amarelo só em fundo preto. Em fundo claro, o texto fica preto.
- Papel `#f4f2ee` e texto `#1a1a1a` são neutros de apoio, não cor de marca.
- Títulos em Montserrat ExtraBold, hospedada em `assets/fonts/` (pesos 500, 700 e 800).
- Logos oficiais em `assets/`. Não estique nem mude as cores. O viewBox do logo horizontal só corta a margem transparente, sem alterar o desenho.

## Versão de teste

Os itens e os preços do cardápio nesta versão são exemplos fictícios, só para o endereço de teste. As fotos e os vídeos também são encenações, não imagens oficiais da casa.

## Pedido, retirada e entrega

Com JavaScript, o visitante monta o pedido no cardápio (vários itens e quantidades), abre a lista do pedido para ajustar ou remover itens, escolhe retirada ou entrega e abre o WhatsApp com a mensagem pronta. A mensagem não pede Pix e não traz taxa. A taxa de entrega é combinada pelo WhatsApp. A entrega é feita por aplicativo, como a 99 Entrega.

O endereço da casa fica em `js/config.js` (`RETIRADA`). No delivery, o cliente informa rua, número, bairro e referência, e o checkout também mostra de onde a entrega sai (esse endereço da casa não entra na mensagem do WhatsApp). Em retirada e entrega há um campo opcional de observação; se preenchido, entra na mensagem como `Observação: …`. O carrinho vale por cerca de 2 horas na mesma visita e é limpo depois de enviar para o WhatsApp; uma visita nova começa vazia.
