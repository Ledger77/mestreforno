/*
  Cardápio — Mestre Forno
  -----------------------
  Este arquivo é a lista que o JavaScript usa para montar os
  cartões e os atalhos (Salgados, Pizzas e qualquer grupo novo).
  A mesma lista está escrita no index.html para aparecer sem
  JavaScript. Se mudar um item aqui, mude o cartão correspondente
  na seção Cardápio do index.html.

  Para trocar um item, edite nome, descricao e preco.
  Preço no formato brasileiro, como texto: "R$ 8,00".
  Enquanto o preço não existir, deixe "R$ --,--".

  exemplo: true  → mostra a etiqueta "Exemplo" no cartão.
  exemplo: false → item tratado como oficial (sem a etiqueta).

  Para incluir um item, copie um bloco { ... } para dentro
  de "itens". Pode deixar a vírgula no último bloco.
*/
const CARDAPIO = [
  {
    id: "salgados",
    titulo: "Salgados",
    resumo: "",
    itens: [
      {
        nome: "Coxinha de frango",
        descricao: "Descrição a confirmar.",
        preco: "R$ --,--",
        exemplo: true,
      },
      {
        nome: "Risole de queijo",
        descricao: "Descrição a confirmar.",
        preco: "R$ --,--",
        exemplo: true,
      },
      {
        nome: "Pastel de carne",
        descricao: "Descrição a confirmar.",
        preco: "R$ --,--",
        exemplo: true,
      },
      {
        nome: "Bolinha de queijo",
        descricao: "Descrição a confirmar.",
        preco: "R$ --,--",
        exemplo: true,
      },
      {
        nome: "Enroladinho de salsicha",
        descricao: "Descrição a confirmar.",
        preco: "R$ --,--",
        exemplo: true,
      },
      {
        nome: "Esfiha de carne",
        descricao: "Descrição a confirmar.",
        preco: "R$ --,--",
        exemplo: true,
      },
    ],
  },
  {
    id: "pizzas",
    titulo: "Pizzas",
    resumo: "",
    itens: [
      {
        nome: "Mussarela",
        descricao: "Descrição a confirmar.",
        preco: "R$ --,--",
        exemplo: true,
      },
      {
        nome: "Calabresa",
        descricao: "Descrição a confirmar.",
        preco: "R$ --,--",
        exemplo: true,
      },
      {
        nome: "Frango com catupiry",
        descricao: "Descrição a confirmar.",
        preco: "R$ --,--",
        exemplo: true,
      },
      {
        nome: "Portuguesa",
        descricao: "Descrição a confirmar.",
        preco: "R$ --,--",
        exemplo: true,
      },
    ],
  },
];
