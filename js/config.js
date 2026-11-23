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
  Entrega e retirada.
  -------------------
  origem.lat / origem.lon: eixo da Rua Grande Cidade no
  OpenStreetMap (way 48649158, Compensa, CEP 69035-650).
  O número 110 não estava mapeado; a rua tem cerca de 200 m,
  o bastante para as faixas de 5 e 10 km. Geocodificado em
  22/11/2026 via Nominatim e fixado aqui de propósito.

  LIMITE_VOLUME_MOTO: acima deste volume, só carro.
    un (salgado) = 1
    pizza        = 8
    cento        = 20
  Com o valor 16: até 16 salgados ou 2 pizzas ainda vão de
  moto; 3 pizzas (24) ou 1 cento (20) vão só de carro.

  faixas[].moto e faixas[].carro estão em centavos e são o
  TETO (estimativa máxima) mostrado ao cliente.
*/
const ENTREGA = {
  origem: {
    logradouro: "Rua Grande Cidade (antiga Rua 25 de Dezembro)",
    numero: "110",
    bairro: "Compensa 2",
    cidade: "Manaus",
    uf: "AM",
    cep: "69035-650",
    referencia: "Final da rua, portão marrom de ferro com listras brancas",
    lat: -3.1054946,
    lon: -60.0586411,
  },
  LIMITE_VOLUME_MOTO: 16,
  volumePorUnidade: {
    un: 1,
    pizza: 8,
    cento: 20,
  },
  faixas: [
    { id: "ate-5", ateKm: 5, moto: 1090, carro: 1890, rotulo: "até 5 km" },
    { id: "5-10", ateKm: 10, moto: 1190, carro: 2890, rotulo: "5–10 km" },
    { id: "acima-10", ateKm: Infinity, moto: 1990, carro: 5690, rotulo: "acima de 10 km" },
  ],
  fatorLinhaReta: 1.3,
  /* Recorte urbano de Manaus (não o município rural inteiro).
     Nominatim: viewbox = oeste, norte, leste, sul. */
  manaus: {
    oeste: -60.15,
    norte: -2.92,
    leste: -59.86,
    sul: -3.2,
  },
  nominatim: "https://nominatim.openstreetmap.org/search",
  osrm: "https://router.project-osrm.org/route/v1/driving/",
};
