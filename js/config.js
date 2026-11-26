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
  maps: link do Google Maps para o ponto (abre em nova aba).
        Usa o nº 140 / CEP 69035-540 de propósito: no Maps, o
        endereço atual (110 / 69035-650) cai em outro ponto da
        mesma rua. O texto visível e o JSON-LD continuam com o 110.
*/
const RETIRADA = {
  texto:
    "Rua Grande Cidade (antiga Rua Vinte e Cinco de Dezembro), nº 110 (antigo 836), Compensa 2, Manaus/AM. Referência: final da rua, portão marrom de ferro com listras brancas.",
  maps:
    "https://www.google.com/maps/search/?api=1&query=R.+Vinte+e+Cinco+de+Dezembro,+140+-+Compensa,+Manaus+-+AM,+69035-540",
};

/*
  Horários da casa, no fuso America/Manaus (UTC-4 o ano todo).
  A faixa de status e o texto em "Como pedir" saem daqui.
  Semana: 0 = domingo, 1 = segunda, … 6 = sábado.
  abre/fecha no formato HH:MM (24h). Se mudar, atualize também
  o openingHoursSpecification do JSON-LD em index.html.
  exemplo: true enquanto forem horários fictícios de teste.
*/
const HORARIOS = {
  fuso: "America/Manaus",
  exemplo: true,
  fechandoMinutos: 60,
  semana: {
    0: { abre: "08:00", fecha: "17:00" },
    1: { abre: "08:00", fecha: "20:00" },
    2: { abre: "08:00", fecha: "20:00" },
    3: { abre: "08:00", fecha: "20:00" },
    4: { abre: "08:00", fecha: "20:00" },
    5: { abre: "08:00", fecha: "20:00" },
    6: { abre: "08:00", fecha: "17:00" },
  },
};

/*
  Texto único de pagamento, usado no cardápio e no checkout.
  Por enquanto o pagamento é somente Pix, combinado no WhatsApp.
  A mensagem do pedido não inclui Pix nem valor de taxa.
*/
const PAGAMENTO = {
  texto: "Pagamento: somente Pix, combinado no WhatsApp.",
};
