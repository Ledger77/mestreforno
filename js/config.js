/*
  Configuração do site — Mestre Forno
  ------------------------------------
  siteUrl: endereço público, com barra no final.
           Agora:  "https://ledger77.github.io/mestreforno/"
           Depois: "https://mestreforno.com.br/"
           Troque junto com o canonical, o Open Graph, o JSON-LD,
           o sitemap.xml, o robots.txt e o <base> do 404.html.
           O passo a passo está em docs/checklist-dominio.md.

  whatsapp: DDI + DDD + número, só dígitos, entre aspas.
            O valor abaixo é um marcador, ainda não é o número da casa.
            Os links wa.me também estão escritos no HTML (index.html e
            404.html) para o pedido funcionar sem JavaScript. Se mudar
            o número, atualize os dois lugares.

  mensagem: texto que já abre escrito na conversa.
*/
const SITE = {
  siteUrl: "https://ledger77.github.io/mestreforno/",
  whatsapp: "5592900000000",
  mensagem: "Olá, Mestre Forno! Quero fazer um pedido.",
};
