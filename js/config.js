/*
  Configuração do site — Mestre Forno
  ------------------------------------
  siteUrl: endereço público, com barra no final.
           Agora:  "https://ledger77.github.io/mestreforno/"
           Depois: "https://mestreforno.com.br/"
           Troque junto com o canonical, o Open Graph, o JSON-LD,
           o sitemap.xml, o robots.txt e o <base> do 404.html.
           O passo a passo está em docs/checklist-dominio.md.

  whatsapp: DDI + DDD + número, só dígitos.
            Os links wa.me também estão no HTML (index.html e
            404.html) para o pedido funcionar sem JavaScript.
            Se mudar o número, atualize os dois lugares.

  mensagem: texto genérico que abre a conversa quando o
            visitante ainda não montou um pedido no cardápio.
*/
const SITE = {
  siteUrl: "https://ledger77.github.io/mestreforno/",
  whatsapp: "5592992487642",
  mensagem: "Olá, Mestre Forno! Quero fazer um pedido.",
};

/*
  Endereço da casa, mostrado no checkout na retirada e, no
  delivery, como o ponto de onde a entrega sai. A taxa é
  combinada no WhatsApp; a entrega é feita por aplicativo,
  como a 99 Entrega. Este endereço não entra na mensagem.
*/
const RETIRADA = {
  texto:
    "Rua Grande Cidade (antiga Rua Vinte e Cinco de Dezembro), nº 110, Compensa 2, Manaus/AM. Referência: final da rua, portão marrom de ferro com listras brancas.",
};
