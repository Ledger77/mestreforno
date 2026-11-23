/*
  Checkout: resumo do pedido, retirada ou delivery, e mensagem
  do WhatsApp. Não pede Pix na mensagem. Sem JavaScript, a
  página segue com o link genérico do WhatsApp.
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
    resultados: [],
    escolhido: null,
    distancia: null,
    faixa: null,
    faixaManual: false,
    veiculo: "",
    geoFalhou: false,
  };

  var ultimoFoco = null;
  var calcSeq = 0;

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

  function volumeAtual() {
    var itens = mapaItens();
    return EntregaServico.volumeDoPedido(pedidoAtual(), itens);
  }

  function motoOk() {
    return EntregaServico.motoPermitida(volumeAtual());
  }

  function dialogEl() {
    return document.getElementById("checkout");
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
      dados: estado.modo === "retirada" ? "Retirada no local" : "Delivery",
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

  function ordem(passo) {
    return { resumo: 0, receber: 1, dados: 2 }[passo] || 0;
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
                "<li><strong>" +
                escapar(l.nome) +
                "</strong> — " +
                l.qtd +
                "× " +
                escapar(l.preco) +
                " = " +
                formatarReais(l.linhaCentavos) +
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
    var end = $("[data-endereco-retirada]");
    if (end) end.textContent = EntregaServico.textoOrigem();
    atualizarVeiculo();
    atualizarTotais();
    atualizarLinkWhatsApp();
  }

  function atualizarVeiculo() {
    var aviso = $("[data-aviso-moto]");
    var ok = motoOk();
    var radioMoto = $("#veiculo-moto");
    var radioCarro = $("#veiculo-carro");
    if (!estado.veiculo) estado.veiculo = ok ? "moto" : "carro";
    if (radioMoto) {
      radioMoto.disabled = !ok;
      if (!ok && estado.veiculo === "moto") estado.veiculo = "carro";
      if (!ok) radioMoto.checked = false;
    }
    if (estado.veiculo === "carro" && radioCarro) radioCarro.checked = true;
    if (estado.veiculo === "moto" && radioMoto && ok) radioMoto.checked = true;
    if (aviso) {
      aviso.hidden = false;
      aviso.textContent = ok
        ? "Pedidos com muitos produtos precisam ir de carro, porque não cabem na bag da moto. O seu ainda pode ir de moto ou de carro."
        : "Pedidos com muitos produtos precisam ir de carro, porque não cabem na bag da moto. Neste pedido, só o carro está disponível.";
    }
  }

  function taxaCentavos() {
    if (estado.modo !== "delivery" || !estado.faixa || !estado.veiculo) return null;
    return estado.veiculo === "carro" ? estado.faixa.carro : estado.faixa.moto;
  }

  function atualizarTotais() {
    var itens = mapaItens();
    var dados = linhasPedido(pedidoAtual(), itens);
    var boxes = $$("[data-checkout-totais]");
    if (!boxes.length) return;
    function preencher(html) {
      boxes.forEach(function (box) {
        box.innerHTML = html;
      });
    }
    if (estado.modo === "retirada") {
      preencher(
        "<p>Total dos produtos: <strong>" +
          formatarReais(dados.subtotal) +
          "</strong></p><p class='checkout__nota'>Na retirada não há taxa de entrega.</p>"
      );
      return;
    }
    var partes = ["<p>Subtotal dos produtos: <strong>" + formatarReais(dados.subtotal) + "</strong></p>"];
    if (estado.distancia) {
      partes.push(
        "<p>Distância: <strong>" +
          escapar(EntregaServico.textoDistancia(estado.distancia)) +
          "</strong>" +
          (estado.faixaManual ? " (faixa escolhida à mão)" : "") +
          "</p>"
      );
    }
    if (estado.escolhido && estado.escolhido.aviso) {
      partes.push("<p class='checkout__nota'>" + escapar(estado.escolhido.aviso) + "</p>");
    }
    if (estado.faixa) {
      partes.push("<p>Faixa: <strong>" + escapar(estado.faixa.rotulo) + "</strong></p>");
    }
    var taxa = taxaCentavos();
    if (taxa != null) {
      partes.push(
        "<p>Taxa estimada (valor máximo, 99 Entrega): <strong>" +
          formatarReais(taxa) +
          "</strong></p>"
      );
      partes.push(
        "<p>Total estimado: <strong>" + formatarReais(dados.subtotal + taxa) + "</strong></p>"
      );
      partes.push(
        "<p class='checkout__nota'>Você nunca paga mais do que o valor mostrado aqui. Se a 99 Entrega cobrar menos, você paga o valor real, menor. Se cobrar mais, você paga só esta taxa.</p>"
      );
    } else if (estado.geoFalhou) {
      partes.push(
        "<p class='checkout__nota'>Não localizamos o ponto no mapa. Você pode escolher a faixa à mão ou seguir e combinar a taxa no WhatsApp.</p>"
      );
    }
    preencher(partes.join(""));
  }

  function montarMensagem() {
    var itens = mapaItens();
    var dados = linhasPedido(pedidoAtual(), itens);
    if (!dados.linhas.length) return SITE && SITE.mensagem ? SITE.mensagem : "";

    var linhas = ["Olá, Mestre Forno! Quero fazer um pedido.", ""];
    if (estado.nome) linhas.push("Nome: " + estado.nome);

    if (estado.modo === "retirada") {
      linhas.push("Modo: vou retirar no local");
      linhas.push("Endereço da retirada: " + EntregaServico.textoOrigem());
    } else if (estado.modo === "delivery") {
      linhas.push("Modo: delivery (entrega pela 99 Entrega)");
      var end =
        [estado.rua, estado.numero && "nº " + estado.numero, estado.bairro, "Manaus/AM"]
          .filter(Boolean)
          .join(", ");
      if (end) linhas.push("Endereço: " + end);
      if (estado.referencia) linhas.push("Referência: " + estado.referencia);
      if (estado.escolhido && estado.escolhido.label) {
        linhas.push("Endereço encontrado: " + estado.escolhido.label);
      }
      if (estado.escolhido && estado.escolhido.aviso) {
        linhas.push(estado.escolhido.aviso);
      }
    }

    linhas.push("");
    linhas.push("Pedido:");
    dados.linhas.forEach(function (l) {
      linhas.push("• " + l.qtd + "× " + l.nome + " (" + l.preco + ") — " + formatarReais(l.linhaCentavos));
    });
    linhas.push("");

    if (estado.modo === "retirada") {
      linhas.push("Total: " + formatarReais(dados.subtotal));
    } else {
      linhas.push("Subtotal: " + formatarReais(dados.subtotal));
      if (estado.distancia) {
        linhas.push("Distância: " + EntregaServico.textoDistancia(estado.distancia));
      }
      if (estado.faixa) {
        linhas.push(
          "Faixa: " + estado.faixa.rotulo + (estado.faixaManual ? " (escolhida à mão)" : "")
        );
      }
      if (estado.veiculo) linhas.push("Veículo: " + (estado.veiculo === "carro" ? "carro" : "moto"));
      var taxa = taxaCentavos();
      if (taxa != null) {
        linhas.push("Taxa estimada (valor máximo): " + formatarReais(taxa));
        linhas.push("Total estimado: " + formatarReais(dados.subtotal + taxa));
      } else {
        linhas.push("Taxa de entrega: a combinar no WhatsApp (entrega pela 99 Entrega).");
      }
    }
    return linhas.join("\n");
  }

  function atualizarLinkWhatsApp() {
    var podeFinalizar = false;
    if (estado.modo === "retirada") {
      podeFinalizar = validarPrimeiroNome(estado.nome).ok;
    } else if (estado.modo === "delivery") {
      var nomeOk = validarPrimeiroNome(estado.nome).ok;
      var endOk = estado.rua.trim() && estado.numero.trim() && estado.bairro.trim();
      var precisaVeiculo = estado.faixa && taxaCentavos() == null;
      var temTeto = Boolean(estado.faixa) || estado.geoFalhou;
      podeFinalizar = nomeOk && endOk && !precisaVeiculo && temTeto;
    }
    var url = podeFinalizar ? urlWhatsApp(montarMensagem()) : "";
    $$("[data-checkout-wa]").forEach(function (el) {
      el.classList.toggle("is-bloqueado", !podeFinalizar);
      if (!url || !podeFinalizar) {
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
    return podeFinalizar;
  }

  function podeAbrir() {
    return linhasPedido(pedidoAtual(), mapaItens()).linhas.length > 0;
  }

  function abrir(origem) {
    if (!podeAbrir()) {
      var cardapio = document.getElementById("cardapio");
      if (cardapio) cardapio.scrollIntoView({ behavior: "smooth", block: "start" });
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

  function mostrarResultados(lista) {
    var box = $("[data-geo-resultado]");
    if (!box) return;
    if (!lista.length) {
      box.hidden = false;
      box.innerHTML =
        "<p role='status'>Não encontramos esse endereço em Manaus. Confira os dados, escolha a faixa à mão ou siga e combine no WhatsApp.</p>";
      return;
    }
    lista = lista.slice(0, 5);
    estado.resultados = lista;
    var opts = lista
      .map(function (item, i) {
        var texto = item.rotulo || EntregaServico.rotuloDestino(item) || item.label;
        return (
          "<label class='checkout__opcao'><input type='radio' name='geo-escolha' value='" +
          i +
          "'" +
          (i === 0 ? " checked" : "") +
          "> <span>" +
          escapar(texto) +
          "</span></label>"
        );
      })
      .join("");
    var intro = (lista[0] && lista[0].aviso) || "Encontramos este endereço. Confira se está certo:";
    box.hidden = false;
    box.innerHTML =
      "<p>" +
      escapar(intro) +
      "</p>" +
      "<div class='checkout__lista'>" +
      opts +
      "</div>";
  }

  function aplicarDestino(dest, opcoes) {
    var seq = opcoes && opcoes.seq != null ? opcoes.seq : ++calcSeq;
    estado.escolhido = dest;
    var status = $("[data-geo-status]");
    if (status) {
      status.hidden = false;
      status.textContent = "Calculando a distância…";
    }
    return EntregaServico.estimarDistancia(dest).then(function (dist) {
      if (seq !== calcSeq) return;
      estado.distancia = dist;
      if (!(opcoes && opcoes.manterFaixaManual)) {
        estado.faixa = EntregaServico.faixaPorKm(dist.km);
        estado.faixaManual = false;
        var sel = $("#faixa-manual");
        if (sel) sel.value = "";
      }
      estado.geoFalhou = false;
      atualizarVeiculo();
      atualizarTotais();
      atualizarLinkWhatsApp();
      var status = $("[data-geo-status]");
      if (status) {
        status.hidden = false;
        status.textContent =
          "Distância: " +
          EntregaServico.textoDistancia(dist) +
          ". Faixa: " +
          (estado.faixa ? estado.faixa.rotulo : "—") +
          ".";
        try {
          var tot = $("[data-bloco='delivery'] [data-checkout-totais]");
          (tot || status).scrollIntoView({ block: "nearest", behavior: "smooth" });
        } catch (e) {}
      }
    });
  }

  function calcularEntrega() {
    var status = $("[data-geo-status]");
    var erro = $("[data-erro-endereco]");
    setErro(erro, "");
    var rua = estado.rua.trim();
    var numero = estado.numero.trim();
    var bairro = estado.bairro.trim();
    if (!rua || !numero || !bairro) {
      setErro(erro, "Preencha rua, número e bairro para calcular a entrega.");
      return;
    }
    if (status) {
      status.hidden = false;
      status.textContent = "Buscando o endereço em Manaus…";
    }
    var botao = $("[data-calcular-entrega]");
    if (botao) botao.disabled = true;
    var seq = ++calcSeq;
    EntregaServico.geocodificar({
      rua: rua,
      numero: numero,
      bairro: bairro,
      referencia: String(estado.referencia || "").trim(),
    })
      .then(function (lista) {
        if (seq !== calcSeq) return;
        estado.resultados = lista;
        if (!lista.length) {
          estado.geoFalhou = true;
          estado.escolhido = null;
          estado.distancia = null;
          if (!estado.faixaManual) estado.faixa = null;
          mostrarResultados([]);
          if (status) status.hidden = true;
          atualizarTotais();
          atualizarLinkWhatsApp();
          return;
        }
        mostrarResultados(lista);
        return aplicarDestino(lista[0], { seq: seq });
      })
      .catch(function () {
        estado.geoFalhou = true;
        estado.escolhido = null;
        estado.distancia = null;
        mostrarResultados([]);
        if (status) {
          status.hidden = false;
          status.textContent = "Não deu para consultar o mapa agora. Escolha a faixa à mão ou siga e combine no WhatsApp.";
        }
        atualizarTotais();
        atualizarLinkWhatsApp();
      })
      .finally(function () {
        if (botao) botao.disabled = false;
      });
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
        calcSeq += 1;
        estado.escolhido = null;
        estado.distancia = null;
        estado.geoFalhou = false;
        if (!estado.faixaManual) estado.faixa = null;
        var box = $("[data-geo-resultado]");
        if (box) {
          box.hidden = true;
          box.innerHTML = "";
        }
        var st = $("[data-geo-status]");
        if (st) {
          st.hidden = true;
          st.textContent = "";
        }
        atualizarTotais();
        atualizarLinkWhatsApp();
      });
    });

    $$("input[name='modo-receber']").forEach(function (el) {
      el.addEventListener("change", function () {
        estado.modo = el.value;
      });
    });

    $$("input[name='veiculo']").forEach(function (el) {
      el.addEventListener("change", function () {
        if (el.value === "moto" && !motoOk()) {
          el.checked = false;
          var carro = $("#veiculo-carro");
          if (carro) carro.checked = true;
          estado.veiculo = "carro";
        } else {
          estado.veiculo = el.value;
        }
        atualizarTotais();
        atualizarLinkWhatsApp();
      });
    });

    var faixa = $("#faixa-manual");
    if (faixa) {
      faixa.addEventListener("change", function () {
        var escolhida = EntregaServico.faixaPorId(faixa.value);
        var calculada = estado.distancia ? EntregaServico.faixaPorKm(estado.distancia.km) : null;
        var erroFaixa = $("[data-erro-faixa]");
        if (!escolhida) {
          estado.faixaManual = false;
          estado.faixa = calculada;
          setErro(erroFaixa, "");
        } else if (calculada && escolhida.ateKm < calculada.ateKm) {
          faixa.value = "";
          estado.faixa = calculada;
          estado.faixaManual = false;
          setErro(
            erroFaixa,
            "A distância calculada é de " +
              String(estado.distancia.kmExibido).replace(".", ",") +
              " km. Escolha essa faixa ou uma maior."
          );
        } else {
          estado.faixa = escolhida;
          estado.faixaManual = true;
          setErro(erroFaixa, "");
        }
        atualizarTotais();
        atualizarLinkWhatsApp();
      });
    }

    var geoBox = $("[data-geo-resultado]");
    if (geoBox) {
      geoBox.addEventListener("change", function (ev) {
        var alvo = ev.target;
        if (!alvo || alvo.name !== "geo-escolha") return;
        var item = estado.resultados[Number(alvo.value)];
        if (item) {
          estado.distancia = null;
          atualizarTotais();
          atualizarLinkWhatsApp();
          aplicarDestino(item);
        }
      });
    }
  }

  function iniciar() {
    var d = dialogEl();
    if (!d) return;

    ligarCampos();

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
          setErro(erro, "Escolha retirada no local ou delivery para continuar.");
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

    var calc = $("[data-calcular-entrega]");
    if (calc) calc.addEventListener("click", calcularEntrega);

    $$("[data-checkout-wa]").forEach(function (el) {
      el.addEventListener("click", function (ev) {
        var bloqueado = el.getAttribute("aria-disabled") === "true" || el.classList.contains("is-bloqueado");
        if (bloqueado) ev.preventDefault();
        var url = el.getAttribute("data-wa-url") || el.getAttribute("href") || "";
        if (!bloqueado && el.tagName !== "A" && url) {
          ev.preventDefault();
          window.open(url, "_blank", "noopener,noreferrer");
          return;
        }
        if (!bloqueado) return;
        ev.preventDefault();
        var nomeSel =
          estado.modo === "retirada" ? "[data-erro-nome-retirada]" : "[data-erro-nome-delivery]";
        var v = validarPrimeiroNome(estado.nome);
        if (!v.ok) setErro($(nomeSel), v.erro || "Digite o primeiro nome.");
        if (estado.modo === "delivery") {
          var endErro = $("[data-erro-endereco]");
          if (!estado.rua.trim() || !estado.numero.trim() || !estado.bairro.trim()) {
            setErro(endErro, "Preencha rua, número e bairro.");
          } else if (!estado.faixa && !estado.geoFalhou) {
            setErro(endErro, "Calcule a entrega ou escolha a faixa para ver a taxa máxima.");
          }
        }
        var invalido =
          (estado.modo === "retirada" && $("#nome-retirada")) ||
          (estado.modo === "delivery" &&
            (!v.ok ? $("#nome-delivery") : !$("#end-rua").value.trim() ? $("#end-rua") : !$("#end-numero").value.trim() ? $("#end-numero") : !$("#end-bairro").value.trim() ? $("#end-bairro") : $("[data-calcular-entrega]")));
        if (!v.ok && estado.modo === "retirada") invalido = $("#nome-retirada");
        if (invalido) {
          try { invalido.focus(); } catch (e) {}
        }
      });
    });

    document.addEventListener("keydown", function (ev) {
      var d = dialogEl();
      if (ev.key !== "Escape" || !d) return;
      if (d.open || d.hasAttribute("open")) fechar();
    });

    document.addEventListener("mf:pedido-atualizado", function () {
      if (d.open || d.hasAttribute("open")) {
        renderResumo();
        atualizarBlocoDados();
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
