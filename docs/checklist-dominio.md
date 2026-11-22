# Checklist — mestreforno.com.br

Quando for a hora do domínio próprio. Não crie o arquivo `CNAME` antes disso: o GitHub Pages grava esse arquivo ao salvar o domínio nas configurações.

O endereço de hoje é `https://ledger77.github.io/mestreforno/`. Ele está em `SITE.siteUrl` (`js/config.js`) e, para os buscadores lerem sem JavaScript, também nestes pontos:

- `index.html` — `rel="canonical"`, `og:url`, `og:image`, `twitter:image`, JSON-LD (`url`, `image`, `logo`)
- `404.html` — `<base href>` e o link “Ir para o início”
- `sitemap.xml` — `<loc>`
- `robots.txt` — linha `Sitemap:`

Troque todos para `https://mestreforno.com.br/` no mesmo dia. O `robots.txt` de um site em subpasta do GitHub (`ledger77.github.io/robots.txt` é outro repositório) não vale para o Google. No domínio próprio, na raiz, ele passa a valer.

## DNS

No provedor do domínio `mestreforno.com.br`:

1. No ápice (`mestreforno.com.br`), quatro registros `A`:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
2. No ápice, quatro registros `AAAA`:
   - `2606:50c0:8000::153`
   - `2606:50c0:8001::153`
   - `2606:50c0:8002::153`
   - `2606:50c0:8003::153`
3. Se quiser `www`, um `CNAME` de `www` para `ledger77.github.io`.

Confira os IPs na documentação atual do GitHub Pages antes de publicar. Eles mudam pouco, mas a página oficial é a referência.

## GitHub Pages e HTTPS

1. No repositório, em Settings → Pages, em Custom domain, informe `mestreforno.com.br` e salve. O GitHub cria o `CNAME`.
2. Espere o DNS propagar e o certificado ser emitido.
3. Marque **Enforce HTTPS**.
4. Confira se `http://` e `https://ledger77.github.io/mestreforno/` abrem o domínio novo (o Pages redireciona).
5. Mande o link numa conversa de WhatsApp e veja se a imagem 1200×630 aparece.
6. Quando o número, o endereço e o horário forem reais, atualize o WhatsApp (`js/config.js` e os `href` de `wa.me`) e o JSON-LD (`telephone`, `streetAddress` e, se quiser, `openingHours`).
