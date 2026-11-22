/*
  Atualiza os links do WhatsApp, redesenha o cardápio a partir de
  js/cardapio.js e controla o menu. O HTML já traz cardápio e links
  wa.me, então a página funciona se este arquivo não carregar.
*/
(function () {
  "use strict";

  function urlWhatsApp() {
    if (typeof SITE === "undefined" || !SITE) return "";
    var numero = String(SITE.whatsapp || "").replace(/\D/g, "");
    if (!numero) return "";
    var texto = encodeURIComponent(SITE.mensagem || "");
    return "https://wa.me/" + numero + "?text=" + texto;
  }

  function aplicarWhatsApp() {
    var url = urlWhatsApp();
    document.querySelectorAll("[data-whatsapp]").forEach(function (el) {
      if (url) el.href = url;
      if (!el.getAttribute("href") || el.getAttribute("href").charAt(0) === "#") {
        el.setAttribute("aria-disabled", "true");
        return;
      }
      el.removeAttribute("aria-disabled");
      el.target = "_blank";
      el.rel = "noopener noreferrer";
      if (!el.querySelector(".js-nova-aba")) {
        var nota = document.createElement("span");
        nota.className = "sr-only js-nova-aba";
        nota.textContent = " (abre em nova aba)";
        el.appendChild(nota);
      }
    });
  }

  function escapar(valor) {
    return String(valor == null ? "" : valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function idSeguro(valor) {
    var id = String(valor || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
    return id || "grupo";
  }

  function temCardapio() {
    return typeof CARDAPIO !== "undefined" && CARDAPIO && CARDAPIO.length;
  }

  function renderAtalhos() {
    var nav = document.querySelector("[data-menu-jump]");
    if (!nav || !temCardapio()) return;
    nav.innerHTML = CARDAPIO.map(function (grupo) {
      return '<a href="#' + idSeguro(grupo.id) + '">' + escapar(grupo.titulo) + "</a>";
    }).join("");
  }

  function renderCardapio() {
    var raiz = document.querySelector("[data-cardapio]");
    if (!raiz || !temCardapio()) return;

    raiz.innerHTML = CARDAPIO.map(function (grupo) {
      var itens = grupo.itens || [];
      var id = idSeguro(grupo.id);
      var cabeca =
        '<div class="menu-group__head">' +
        '<h3 id="titulo-' + id + '">' + escapar(grupo.titulo) + "</h3>" +
        (grupo.resumo ? "<p>" + escapar(grupo.resumo) + "</p>" : "") +
        "</div>";

      var corpo;
      if (!itens.length) {
        corpo = "<p>Nenhum item neste grupo ainda.</p>";
      } else {
        corpo =
          '<ul class="menu-grid">' +
          itens
            .map(function (item) {
              var preco = item.preco ? item.preco : "R$ --,--";
              var etiqueta = item.exemplo ? '<span class="badge">Exemplo</span>' : "";
              return (
                '<li class="item">' +
                '<div class="item__top"><h4>' + escapar(item.nome) + "</h4>" + etiqueta + "</div>" +
                "<p>" + escapar(item.descricao || "") + "</p>" +
                '<p class="price"><span class="sr-only">Preço: </span>' + escapar(preco) + "</p>" +
                "</li>"
              );
            })
            .join("") +
          "</ul>";
      }

      return (
        '<section class="menu-group" id="' + id + '" aria-labelledby="titulo-' + id + '">' +
        cabeca +
        corpo +
        "</section>"
      );
    }).join("");
  }

  function iniciarMenu() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.querySelector("#menu-site");
    if (!toggle || !nav) return;

    var desktop = window.matchMedia("(min-width: 860px)");
    var main = document.querySelector("main");
    var footer = document.querySelector(".site-footer");

    function setAberto(aberto, opcoes) {
      var travar = Boolean(aberto) && !desktop.matches;
      var estava = nav.classList.contains("is-open");
      nav.classList.toggle("is-open", travar);
      toggle.setAttribute("aria-expanded", travar ? "true" : "false");
      toggle.setAttribute("aria-label", travar ? "Fechar menu" : "Abrir menu");
      document.documentElement.classList.toggle("nav-open", travar);
      if (main) main.inert = travar;
      if (footer) footer.inert = travar;

      if (travar && !estava) {
        var primeiro = nav.querySelector("a");
        if (primeiro) primeiro.focus();
      }
      if (!travar && estava && !(opcoes && opcoes.manterFoco) && nav.contains(document.activeElement)) {
        toggle.focus();
      }
    }

    toggle.addEventListener("click", function () {
      setAberto(!nav.classList.contains("is-open"));
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setAberto(false, { manterFoco: true });
      });
    });

    document.addEventListener("keydown", function (evento) {
      if (evento.key === "Escape") setAberto(false);
    });

    document.addEventListener("click", function (evento) {
      if (!nav.classList.contains("is-open")) return;
      if (evento.target.closest(".site-header")) return;
      setAberto(false);
    });

    if (desktop.addEventListener) {
      desktop.addEventListener("change", function () {
        setAberto(false);
      });
    }

    var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
    var secoes = links
      .map(function (link) {
        return document.querySelector(link.getAttribute("href"));
      })
      .filter(Boolean);

    if (!("IntersectionObserver" in window) || !secoes.length) return;

    var ativas = new Set();
    var observador = null;
    var espera;

    function margem() {
      var altura = window.innerHeight || 800;
      var topo = Math.round(Math.max(72, Math.min(altura * 0.12, 110)));
      var fundo = Math.round(altura * 0.55);
      return "-" + topo + "px 0px -" + fundo + "px 0px";
    }

    function aplicar() {
      var id = null;
      secoes.forEach(function (secao) {
        if (ativas.has(secao.id)) id = secao.id;
      });
      links.forEach(function (link) {
        if (id && link.getAttribute("href") === "#" + id) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    function observar() {
      if (observador) observador.disconnect();
      ativas.clear();
      aplicar();
      observador = new IntersectionObserver(
        function (entradas) {
          entradas.forEach(function (entrada) {
            if (entrada.isIntersecting) ativas.add(entrada.target.id);
            else ativas.delete(entrada.target.id);
          });
          aplicar();
        },
        { rootMargin: margem(), threshold: 0 }
      );
      secoes.forEach(function (secao) {
        observador.observe(secao);
      });
    }

    observar();
    window.addEventListener("resize", function () {
      window.clearTimeout(espera);
      espera = window.setTimeout(observar, 150);
    });
  }

  function marcarAno() {
    document.querySelectorAll("[data-ano]").forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  aplicarWhatsApp();
  renderAtalhos();
  renderCardapio();
  iniciarMenu();
  marcarAno();
})();
