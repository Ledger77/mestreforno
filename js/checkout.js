/*
  Checkout: resumo do pedido (com +/− e remover), retirada ou
  entrega, e mensagem do WhatsApp. Não pede Pix. A taxa de
  entrega é combinada no WhatsApp. Sem JavaScript, a página
  segue com o link genérico do WhatsApp.
*/
(function () {
  "use strict";

  var estado = {
    passo: "resumo",
    modo: "",
    nome: "",
    rua: "",
    numero: "",
    bairro: "",
    referencia: "",
    observacao: "",
  };

  var ultimoFoco = null;

  function $(sel, raiz) {
    return (raiz || document).querySelector(sel);
  }

  function $$(sel, raiz) {
    return Array.prototype.slice.call((raiz || document).querySelectorAll(sel));
  }

  function formatarReais(centavos) {
    var n = (Number(centavos) || 0) / 100;
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatarReaisMsg(centavos) {
    var n = (Number(centavos) || 0) / 100;
    return "R$ " + n.toFixed(2).replace(".", ",");
  }

  function urlWhatsApp(texto) {
    if (typeof SITE === "undefined" || !SITE) return "";
    var numero = String(SITE.whatsapp || "").replace(/\D/g, "");
    if (!numero) return "";
    var msg = texto != null ? texto : SITE.mensagem || "";
    return "https://wa.me/" + numero + "?text=" + encodeURIComponent(msg);
  }

  function escapar(valor) {
    return String(valor == null ? "" : valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mapaItens() {
    var mapa = {};
    if (typeof CARDAPIO === "undefined" || !CARDAPIO) return mapa;
    CARDAPIO.forEach(function (grupo) {
      (grupo.itens || []).forEach(function (item) {
        mapa[item.id] = item;
      });
    });
    return mapa;
  }

  function linhasPedido(pedido, itens) {
    var linhas = [];
    var subtotal = 0;
    Object.keys(pedido || {}).forEach(function (id) {
      var qtd = Number(pedido[id]) || 0;
      var item = itens[id];
      if (!qtd || !item) return;
      var linha = qtd * (Number(item.centavos) || 0);
      subtotal += linha;
      linhas.push({
        id: id,
        nome: item.nome,
        qtd: qtd,
        preco: item.preco,
        linhaCentavos: linha,
      });
    });
    return { linhas: linhas, subtotal: subtotal };
  }

  function validarPrimeiroNome(valor) {
    var n = String(valor || "").trim();
    try {
      n = n.normalize("NFC");
    } catch (e) {}
    if (!n) return { ok: false, erro: "Digite o primeiro nome." };
    if (/\s/.test(n)) {
      return { ok: false, erro: "Só o primeiro nome, sem sobrenome. Ex.: João" };
    }
    if (n.length < 2) {
      return { ok: false, erro: "O nome precisa ter pelo menos duas letras. Ex.: João" };
    }
    var okForma = false;
    try {
      okForma = /^\p{L}+(?:['’\-]\p{L}+)*$/u.test(n);
    } catch (e) {
      okForma = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’\-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/.test(n);
    }
    if (!okForma) {
      return { ok: false, erro: "Use só letras no primeiro nome. Ex.: João" };
    }
    return { ok: true, nome: n };
  }

  function setErro(el, msg) {
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || "";
  }

  function pedidoAtual() {
    return window.MF && typeof MF.lerPedido === "function" ? MF.lerPedido() : {};
  }

  function textoRetirada() {
    if (typeof RETIRADA !== "undefined" && RETIRADA && RETIRADA.texto) return RETIRADA.texto;
    return "Rua Grande Cidade (antiga Rua Vinte e Cinco de Dezembro), nº 110 (antigo 836), Compensa 2, Manaus/AM. Referência: final da rua, portão marrom de ferro com listras brancas.";
  }

  function mapsRetirada() {
    if (typeof RETIRADA !== "undefined" && RETIRADA && RETIRADA.maps) return RETIRADA.maps;
    return "https://www.google.com/maps/search/?api=1&query=R.+Vinte+e+Cinco+de+Dezembro,+140+-+Compensa,+Manaus+-+AM,+69035-540";
  }

  function dialogEl() {
    return document.getElementById("checkout");
  }

  function ordem(passo) {
    return { resumo: 0, receber: 1, dados: 2 }[passo] || 0;
  }

  function mostrarPasso(id) {
    estado.passo = id;
    $$("[data-checkout-passo]").forEach(function (el) {
      el.hidden = el.getAttribute("data-checkout-passo") !== id;
    });
    $$("[data-passo-indicador]").forEach(function (el) {
      var meu = el.getAttribute("data-passo-indicador");
      var atual = meu === id;
      el.classList.toggle("is-atual", atual);
      el.classList.toggle("is-feito", ordem(meu) < ordem(id));
      if (atual) el.setAttribute("aria-current", "step");
      else el.removeAttribute("aria-current");
    });
    var titulo = {
      resumo: "Seu pedido",
      receber: "Como você quer receber?",
      dados: estado.modo === "retirada" ? "Retirada no local" : "Entrega",
    };
    var h = $("#checkout-titulo");
    if (h) h.textContent = titulo[id] || "Finalize seu pedido";
    var primeiro = dialogEl() && dialogEl().querySelector("[data-checkout-passo='" + id + "']");
    var visivel = primeiro && (primeiro.querySelector("[data-bloco]:not([hidden])") || primeiro);
    var foco = visivel && visivel.querySelector("input:not([disabled]), button, select, textarea, a.btn");
    if (foco) {
      try {
        foco.focus();
      } catch (e) {}
    }
  }

  function renderResumo() {
    var itens = mapaItens();
    var dados = linhasPedido(pedidoAtual(), itens);
    var lista = $("[data-checkout-itens]");
    var sub = $("[data-checkout-subtotal]");
    if (lista) {
      if (!dados.linhas.length) {
        lista.innerHTML = "<p>Nenhum item ainda. Escolha no cardápio, com as quantidades que quiser.</p>";
      } else {
        lista.innerHTML =
          "<ul>" +
          dados.linhas
            .map(function (l) {
              return (
                "<li class='checkout__item' data-item-linha='" +
                escapar(l.id) +
                "'>" +
                "<div class='checkout__item-info'>" +
                "<strong>" +
                escapar(l.nome) +
                "</strong>" +
                "<span>" +
                formatarReais(l.linhaCentavos) +
                "</span>" +
                "</div>" +
                "<div class='checkout__item-acoes'>" +
                "<div class='qty'>" +
                "<button type='button' data-menos='" +
                escapar(l.id) +
                "' aria-label='Tirar " +
                escapar(l.nome) +
                "'>−</button>" +
                "<span data-qty aria-live='polite'>" +
                l.qtd +
                "</span>" +
                "<button type='button' data-mais='" +
                escapar(l.id) +
                "' aria-label='Adicionar " +
                escapar(l.nome) +
                "'>+</button>" +
                "</div>" +
                "<button type='button' class='checkout__remover' data-remover='" +
                escapar(l.id) +
                "' aria-label='Remover " +
                escapar(l.nome) +
                " do pedido'>×</button>" +
                "</div>" +
                "</li>"
              );
            })
            .join("") +
          "</ul>";
      }
    }
    if (sub) {
      sub.hidden = !dados.linhas.length;
      sub.textContent = dados.linhas.length ? "Subtotal: " + formatarReais(dados.subtotal) : "";
    }
    var seguir = $("[data-checkout-para='receber']");
    if (seguir) seguir.disabled = !dados.linhas.length;
  }

  function atualizarBlocoDados() {
    $$("[data-bloco]").forEach(function (el) {
      el.hidden = el.getAttribute("data-bloco") !== estado.modo;
    });
    $$("[data-endereco-retirada], [data-endereco-origem]").forEach(function (el) {
      el.textContent = textoRetirada();
    });
    $$("[data-endereco-maps]").forEach(function (el) {
      el.href = mapsRetirada();
      el.target = "_blank";
      el.rel = "noopener noreferrer";
    });
    atualizarTotais();
    atualizarLinkWhatsApp();
  }

  function atualizarTotais() {
    var itens = mapaItens();
    var dados = linhasPedido(pedidoAtual(), itens);
    var boxes = $$("[data-checkout-totais]");
    if (!boxes.length) return;
    var html = "<p>Subtotal: <strong>" + formatarReais(dados.subtotal) + "</strong></p>";
    boxes.forEach(function (box) {
      box.innerHTML = html;
    });
  }

  function montarMensagem() {
    var itens = mapaItens();
    var dados = linhasPedido(pedidoAtual(), itens);
    if (!dados.linhas.length) return SITE && SITE.mensagem ? SITE.mensagem : "";

    var linhas = ["Olá, Mestre Forno! Quero fazer um pedido.", ""];
    if (estado.nome) linhas.push("Nome: " + estado.nome);

    if (estado.modo === "retirada") {
      linhas.push("Modo: Retirada no local");
    } else if (estado.modo === "delivery") {
      linhas.push("Modo: Entrega");
      var end = [estado.rua.trim(), estado.numero.trim() && "nº " + estado.numero.trim(), estado.bairro.trim(), "Manaus/AM"]
        .filter(Boolean)
        .join(", ");
      if (end) linhas.push("Endereço: " + end);
      if (estado.referencia.trim()) linhas.push("Referência: " + estado.referencia.trim());
    }
    if (estado.observacao && estado.observacao.trim()) {
      linhas.push("Observação: " + estado.observacao.trim());
    }

    linhas.push("");
    linhas.push("Pedido:");
    dados.linhas.forEach(function (l) {
      linhas.push("* " + l.qtd + "× " + l.nome + " — " + formatarReaisMsg(l.linhaCentavos));
    });
    linhas.push("");
    linhas.push("Subtotal: " + formatarReaisMsg(dados.subtotal));
    return linhas.join("\n");
  }

  function podeFinalizar() {
    if (!linhasPedido(pedidoAtual(), mapaItens()).linhas.length) return false;
    if (estado.modo === "retirada") return validarPrimeiroNome(estado.nome).ok;
    if (estado.modo === "delivery") {
      return (
        validarPrimeiroNome(estado.nome).ok &&
        Boolean(estado.rua.trim() && estado.numero.trim() && estado.bairro.trim())
      );
    }
    return false;
  }

  function atualizarLinkWhatsApp() {
    var ok = podeFinalizar();
    var url = ok ? urlWhatsApp(montarMensagem()) : "";
    $$("[data-checkout-wa]").forEach(function (el) {
      el.classList.toggle("is-bloqueado", !ok);
      if (!url || !ok) {
        el.setAttribute("aria-disabled", "true");
        el.removeAttribute("href");
        el.removeAttribute("data-wa-url");
        return;
      }
      el.setAttribute("data-wa-url", url);
      if (el.tagName === "A") {
        el.href = url;
        el.target = "_blank";
        el.rel = "noopener noreferrer";
      }
      el.removeAttribute("aria-disabled");
    });
    return ok;
  }

  function podeAbrir() {
    return linhasPedido(pedidoAtual(), mapaItens()).linhas.length > 0;
  }

  function abrir(origem) {
    if (!podeAbrir()) {
      var cardapio = document.getElementById("cardapio");
      var reduzir = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (cardapio) cardapio.scrollIntoView({ behavior: reduzir ? "auto" : "smooth", block: "start" });
      return;
    }
    ultimoFoco = origem || document.activeElement;
    var d = dialogEl();
    if (!d) return;
    renderResumo();
    if (typeof d.showModal === "function") d.showModal();
    else {
      d.setAttribute("open", "");
      d.classList.add("is-fallback");
    }
    document.documentElement.classList.add("checkout-aberto");
    mostrarPasso("resumo");
  }

  function fechar() {
    var d = dialogEl();
    if (!d) return;
    if (typeof d.close === "function" && d.open) d.close();
    else {
      d.removeAttribute("open");
      d.classList.remove("is-fallback");
    }
    document.documentElement.classList.remove("checkout-aberto");
    var origem = ultimoFoco && document.contains(ultimoFoco) ? ultimoFoco : $("[data-abre-checkout]");
    if (origem) {
      try {
        origem.focus();
      } catch (e) {}
    }
  }

  function depoisDeEnviarWhatsApp() {
    estado.observacao = "";
    $$("[data-observacao]").forEach(function (el) {
      el.value = "";
    });
    if (window.MF && typeof MF.limparPedido === "function") MF.limparPedido();
    fechar();
  }

  function ligarCampos() {
    var nomeRet = $("#nome-retirada");
    var nomeDel = $("#nome-delivery");
    function syncNome(valor, erroSel) {
      var v = validarPrimeiroNome(valor);
      estado.nome = v.ok ? v.nome : String(valor || "").trim();
      var vazio = !String(valor || "").trim();
      setErro($(erroSel), v.ok || vazio ? "" : v.erro);
      var campo = erroSel.indexOf("retirada") >= 0 ? $("#nome-retirada") : $("#nome-delivery");
      if (campo) campo.setAttribute("aria-invalid", v.ok || vazio ? "false" : "true");
      atualizarLinkWhatsApp();
    }
    if (nomeRet) {
      nomeRet.addEventListener("input", function () {
        if (nomeDel) nomeDel.value = nomeRet.value;
        syncNome(nomeRet.value, "[data-erro-nome-retirada]");
      });
    }
    if (nomeDel) {
      nomeDel.addEventListener("input", function () {
        if (nomeRet) nomeRet.value = nomeDel.value;
        syncNome(nomeDel.value, "[data-erro-nome-delivery]");
      });
    }

    ["rua", "numero", "bairro", "referencia"].forEach(function (campo) {
      var el = $("#end-" + campo);
      if (!el) return;
      el.addEventListener("input", function () {
        estado[campo] = el.value;
        setErro($("[data-erro-endereco]"), "");
        atualizarLinkWhatsApp();
      });
    });

    var obsCampos = $$("[data-observacao]");
    obsCampos.forEach(function (el) {
      el.addEventListener("input", function () {
        estado.observacao = el.value;
        obsCampos.forEach(function (outro) {
          if (outro !== el) outro.value = el.value;
        });
        atualizarLinkWhatsApp();
      });
    });

    $$("input[name='modo-receber']").forEach(function (el) {
      el.addEventListener("change", function () {
        estado.modo = el.value;
      });
    });
  }

  function iniciar() {
    var d = dialogEl();
    if (!d) return;

    ligarCampos();

    var lista = $("[data-checkout-itens]");
    if (lista) {
      lista.addEventListener("click", function (ev) {
        var mais = ev.target.closest && ev.target.closest("[data-mais]");
        var menos = ev.target.closest && ev.target.closest("[data-menos]");
        var remover = ev.target.closest && ev.target.closest("[data-remover]");
        if (mais && window.MF && MF.alterarItem) MF.alterarItem(mais.getAttribute("data-mais"), 1);
        else if (menos && window.MF && MF.alterarItem) MF.alterarItem(menos.getAttribute("data-menos"), -1);
        else if (remover && window.MF && MF.removerItem) MF.removerItem(remover.getAttribute("data-remover"));
      });
    }

    document.addEventListener("click", function (ev) {
      var abre = ev.target.closest && ev.target.closest("[data-abre-checkout]");
      if (abre) {
        ev.preventDefault();
        abrir(abre);
      }
    });

    $$("[data-checkout-fechar]").forEach(function (el) {
      el.addEventListener("click", fechar);
    });

    d.addEventListener("cancel", function () {
      document.documentElement.classList.remove("checkout-aberto");
    });
    d.addEventListener("close", function () {
      document.documentElement.classList.remove("checkout-aberto");
    });

    $("[data-checkout-para='receber']") &&
      $("[data-checkout-para='receber']").addEventListener("click", function () {
        if (!podeAbrir()) return;
        mostrarPasso("receber");
      });

    $("[data-checkout-para='dados']") &&
      $("[data-checkout-para='dados']").addEventListener("click", function () {
        var escolhido = $("input[name='modo-receber']:checked");
        var erro = $("[data-erro-modo]");
        if (!escolhido) {
          setErro(erro, "Escolha retirada no local ou entrega para continuar.");
          return;
        }
        setErro(erro, "");
        estado.modo = escolhido.value;
        atualizarBlocoDados();
        mostrarPasso("dados");
      });

    $$("[data-checkout-voltar]").forEach(function (el) {
      el.addEventListener("click", function () {
        mostrarPasso(el.getAttribute("data-checkout-voltar") || "resumo");
      });
    });

    $$("[data-checkout-wa]").forEach(function (el) {
      el.addEventListener("click", function (ev) {
        var bloqueado = el.getAttribute("aria-disabled") === "true" || el.classList.contains("is-bloqueado");
        var url = el.getAttribute("data-wa-url") || el.getAttribute("href") || "";
        if (!bloqueado && url) {
          ev.preventDefault();
          // window.open com "noopener" devolve null mesmo quando a aba abre,
          // então não dá para usar o retorno como prova de popup bloqueado.
          // Limpa memória e storage no clique, independente da navegação
          // (o WhatsApp abre em nova aba; esta aba continua com o estado).
          var janela = window.open(url, "_blank");
          if (janela) {
            try {
              janela.opener = null;
            } catch (e) {}
          }
          depoisDeEnviarWhatsApp();
          return;
        }
        ev.preventDefault();
        var nomeSel = estado.modo === "retirada" ? "[data-erro-nome-retirada]" : "[data-erro-nome-delivery]";
        var v = validarPrimeiroNome(estado.nome);
        if (!v.ok) setErro($(nomeSel), v.erro || "Digite o primeiro nome.");
        if (estado.modo === "delivery") {
          var endErro = $("[data-erro-endereco]");
          if (!estado.rua.trim() || !estado.numero.trim() || !estado.bairro.trim()) {
            setErro(endErro, "Preencha rua, número e bairro.");
          }
        }
        var invalido = null;
        if (estado.modo === "retirada") invalido = $("#nome-retirada");
        else if (!v.ok) invalido = $("#nome-delivery");
        else if (!$("#end-rua").value.trim()) invalido = $("#end-rua");
        else if (!$("#end-numero").value.trim()) invalido = $("#end-numero");
        else if (!$("#end-bairro").value.trim()) invalido = $("#end-bairro");
        if (invalido) {
          try {
            invalido.focus();
          } catch (e) {}
        }
      });
    });

    document.addEventListener("keydown", function (ev) {
      var d = dialogEl();
      if (ev.key !== "Escape" || !d) return;
      if (d.open || d.hasAttribute("open")) fechar();
    });

    document.addEventListener("mf:pedido-atualizado", function (ev) {
      if (d.open || d.hasAttribute("open")) {
        var foco = document.activeElement;
        var focoAcao = "";
        var focoId = "";
        if (foco && lista && lista.contains(foco)) {
          focoAcao = foco.hasAttribute("data-mais")
            ? "mais"
            : foco.hasAttribute("data-menos")
              ? "menos"
              : foco.hasAttribute("data-remover")
                ? "remover"
                : "";
          focoId = foco.getAttribute("data-mais") || foco.getAttribute("data-menos") || foco.getAttribute("data-remover") || "";
        }
        renderResumo();
        atualizarTotais();
        atualizarLinkWhatsApp();
        if (!podeAbrir()) {
          fechar();
          return;
        }
        if (focoAcao && focoId) {
          var sel = focoAcao === "mais" ? "[data-mais='" + focoId + "']" : focoAcao === "menos" ? "[data-menos='" + focoId + "']" : "[data-remover='" + focoId + "']";
          var novo = lista && lista.querySelector(sel);
          if (novo) {
            try { novo.focus(); } catch (e) {}
          }
        }
      }
    });

    window.MF = window.MF || {};
    MF.abrirCheckout = abrir;
    MF.fecharCheckout = fechar;
    MF.montarMensagemCheckout = montarMensagem;
    MF.urlWhatsApp = urlWhatsApp;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
