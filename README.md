# Mestre Forno

Site da Mestre Forno, salgados e pizzas em Manaus/AM. É uma página estática (`index.html`, CSS e um JavaScript pequeno), sem etapa de build, para o GitHub Pages servir da raiz do branch padrão.

Os caminhos de imagem, CSS e JS são relativos. Assim o site funciona em `https://ledger77.github.io/mestreforno/` e, mais tarde, em `mestreforno.com.br`. Não há arquivo `CNAME` de propósito: o domínio próprio entra depois.

## Ver no computador

Na pasta do projeto:

```bash
python3 -m http.server 8000
```

Abra `http://localhost:8000/`.

## Editar o cardápio

Tudo fica em **`js/cardapio.js`**. Cada item tem `nome`, `descricao`, `preco` e `exemplo`.

- Preço é texto. Use o formato brasileiro, por exemplo `"R$ 8,00"`. Enquanto não houver preço, deixe `"R$ --,--"`.
- `exemplo: true` mostra a etiqueta “Exemplo”. No item oficial, mude para `exemplo: false`.
- Para um produto novo, copie um bloco `{ ... }` para dentro de `itens`.
- Os grupos são dois: Salgados e Pizzas. Dá para criar outro grupo copiando o objeto inteiro (com `id`, `titulo`, `resumo` e `itens`).

## Editar o WhatsApp

O número e a mensagem ficam só em **`js/config.js`**, na constante `SITE`.

- `whatsapp`: DDI + DDD + número, só dígitos, entre aspas. O valor `5592900000000` é um marcador até o número real existir.
- `mensagem`: o texto que já abre escrito na conversa. O padrão é `Olá, Mestre Forno! Quero fazer um pedido.`

Os botões do cabeçalho, do hero, da seção “Como pedir” e do rodapé montam o link `wa.me` a partir daí.

## Editar os textos

Os textos visíveis da página estão no **`index.html`**: hero, aviso do cardápio, como pedir, entrega, horário, retirada, sobre e rodapé. O Instagram do rodapé aponta para `https://instagram.com/mestreforno`.

## Marca

- Preto `#000000`, amarelo `#FFC629`, branco `#FFFFFF`.
- Texto amarelo só em fundo preto. Em fundo claro, o texto fica preto.
- Títulos em Montserrat ExtraBold (Google Fonts).
- Logos oficiais em `assets/`: símbolo, completo e horizontal com fundo transparente, para usar em fundo preto. O selo 1080 é a imagem de compartilhamento; o favicon foi gerado a partir dele. Não estique nem mude as cores das logos.
