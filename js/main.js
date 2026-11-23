/*
  Liga o WhatsApp, o cardápio com quantidades, o vídeo do hero,
  as revelações e o menu. O HTML já traz o cardápio e os links
  wa.me, então a página continua utilizável se este arquivo falhar.
*/
(function () {
  "use strict";

  var STORAGE = "mestreforno-pedido";
  var EXPIRA_MS = 2 * 60 * 60 * 1000;

  function urlWhatsApp(texto) {
    if (typeof SITE === "undefined" || !SITE) return "";
    var numero = String(SITE.whatsapp || "").replace(/\D/g, "");
    if (!numero) return "";
    var msg = texto != null ? texto : SITE.mensagem || "";
    return "https://wa.me/" + numero + "?text=" + encodeURIComponent(msg);
  }

  function aplicarLink(el, url) {
    if (!url) {
      el.setAttribute("aria-disabled", "true");
      return;
    }
    el.href = url;
    el.removeAttribute("aria-disabled");
    el.target = "_blank";
    el.rel = "noopener noreferrer";
    if (!el.querySelector(".js-nova-aba")) {
      var nota = document.createElement("span");
      nota.className = "sr-only js-nova-aba";
      nota.textContent = " (abre em nova aba)";
      el.appendChild(nota);
    }
  }

  function aplicarWhatsAppGenerico() {
    var url = urlWhatsApp();
    document.querySelectorAll("[data-whatsapp]").forEach(function (el) {
      aplicarLink(el, url);
    });
  }

  function escapar(valor) {
    return String(valor == null ? "" : valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatarReais(centavos) {
    var n = (Number(centavos) || 0) / 100;
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

  function itensValidos(dados) {
    var limpo = {};
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) return limpo;
    Object.keys(dados).forEach(function (id) {
      var q = Number(dados[id]);
      if (!id || !Number.isFinite(q)) return;
      q = Math.floor(q);
      if (q < 1) return;
      limpo[id] = Math.min(q, 99);
    });
    return limpo;
  }

  function lerPedido() {
    try {
      var bruto = localStorage.getItem(STORAGE);
      var dados = bruto ? JSON.parse(bruto) : null;
      if (!dados || typeof dados !== "object" || Array.isArray(dados)) return {};
      // Formato antigo (só o mapa de itens), ou registro sem data: trata como visita anterior.
      if (typeof dados.em !== "number" || !dados.itens) {
        try {
          localStorage.removeItem(STORAGE);
        } catch (e) {}
        return {};
      }
      if (Date.now() - dados.em > EXPIRA_MS) {
        try {
          localStorage.removeItem(STORAGE);
        } catch (e) {}
        return {};
      }
      return itensValidos(dados.itens);
    } catch (e) {
      return {};
    }
  }

  function gravarPedido(pedido) {
    try {
      var limpo = itensValidos(pedido);
      if (!Object.keys(limpo).length) {
        localStorage.removeItem(STORAGE);
        return;
      }
      localStorage.setItem(
        STORAGE,
        JSON.stringify({ v: 1, em: Date.now(), itens: limpo })
      );
    } catch (e) {}
  }

  function totalItens(pedido) {
    return Object.keys(pedido).reduce(function (s, id) {
      return s + (Number(pedido[id]) || 0);
    }, 0);
  }

  function subtotalCentavos(pedido, itens) {
    return Object.keys(pedido).reduce(function (s, id) {
      var q = Number(pedido[id]) || 0;
      var item = itens[id];
      if (!q || !item) return s;
      return s + q * (Number(item.centavos) || 0);
    }, 0);
  }

  function iniciarPedido() {
    var itens = mapaItens();
    var pedido = lerPedido();
    var bar = document.querySelector("[data-pedido-bar]");
    var rotulo = document.querySelector("[data-pedido-rotulo]");
    var subEl = document.querySelector("[data-pedido-subtotal]");

    function quantidadeDe(id) {
      return Number(pedido[id]) || 0;
    }

    function atualizarControles() {
      document.querySelectorAll("[data-item]").forEach(function (card) {
        var id = card.getAttribute("data-item");
        var q = quantidadeDe(id);
        var span = card.querySelector("[data-qty]");
        if (span) span.textContent = String(q);
        card.classList.toggle("is-escolhido", q > 0);
      });

      var n = totalItens(pedido);
      var subtotal = subtotalCentavos(pedido, itens);
      document.querySelectorAll("[data-pedido-badge]").forEach(function (el) {
        el.textContent = String(n);
      });
      document.querySelectorAll("[data-header-pedido]").forEach(function (el) {
        el.hidden = n === 0;
        el.setAttribute("aria-label", n ? ("Pedido, " + n + (n === 1 ? " item" : " itens")) : "Pedido");
      });
      if (rotulo) {
        rotulo.textContent = n
          ? n + (n === 1 ? " item escolhido" : " itens escolhidos")
          : "Nenhum item ainda";
      }
      if (subEl) {
        subEl.hidden = n === 0;
        subEl.textContent = n ? "Subtotal " + formatarReais(subtotal) : "";
      }
      if (bar) {
        bar.classList.toggle("tem-itens", n > 0);
        bar.hidden = n === 0;
      }
      document.documentElement.classList.toggle("tem-pedido", n > 0);

      document.dispatchEvent(
        new CustomEvent("mf:pedido-atualizado", { detail: { pedido: pedido, n: n, subtotal: subtotal } })
      );
    }

    function mudar(id, delta) {
      if (!itens[id]) return;
      var atual = quantidadeDe(id) + delta;
      if (atual <= 0) delete pedido[id];
      else pedido[id] = Math.min(atual, 99);
      gravarPedido(pedido);
      atualizarControles();
    }

    document.querySelectorAll("[data-item]").forEach(function (card) {
      var id = card.getAttribute("data-item");
      var mais = card.querySelector("[data-mais]");
      var menos = card.querySelector("[data-menos]");
      if (mais) mais.addEventListener("click", function () { mudar(id, 1); });
      if (menos) menos.addEventListener("click", function () { mudar(id, -1); });
    });

    window.addEventListener("storage", function (ev) {
      if (ev.key !== STORAGE) return;
      pedido = lerPedido();
      atualizarControles();
    });

    function sincronizarPedido() {
      pedido = lerPedido();
      atualizarControles();
    }

    // bfcache / voltar do WhatsApp Web (wa.me, api.whatsapp, web.whatsapp)
    // e retorno à aba: relê o storage para não reexibir um carrinho já limpo.
    window.addEventListener("pageshow", sincronizarPedido);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") sincronizarPedido();
    });

    window.MF = window.MF || {};
    MF.lerPedido = function () {
      return pedido;
    };
    MF.alterarItem = function (id, delta) {
      mudar(id, delta);
    };
    MF.removerItem = function (id) {
      if (!itens[id] && !pedido[id]) return;
      delete pedido[id];
      gravarPedido(pedido);
      atualizarControles();
    };
    MF.limparPedido = function () {
      pedido = {};
      gravarPedido(pedido);
      atualizarControles();
    };
    MF.formatarReais = formatarReais;
    MF.urlWhatsApp = urlWhatsApp;

    atualizarControles();
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

    if ("IntersectionObserver" in window && secoes.length) {
      var atual = null;
      var observador = new IntersectionObserver(
        function (entradas) {
          var visivel = entradas.some(function (entrada) {
            return entrada.isIntersecting;
          });
          entradas.forEach(function (entrada) {
            if (!entrada.isIntersecting) return;
            atual = entrada.target.id;
          });
          links.forEach(function (link) {
            if (visivel && atual && link.getAttribute("href") === "#" + atual) {
              link.setAttribute("aria-current", "true");
            } else {
              link.removeAttribute("aria-current");
            }
          });
          if (!visivel) atual = null;
        },
        { rootMargin: "-40% 0px -45% 0px", threshold: 0 }
      );
      secoes.forEach(function (secao) {
        observador.observe(secao);
      });
    }
  }

  function podeVideo() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (c) {
      if (c.saveData) return false;
      var tipo = String(c.effectiveType || "");
      if (tipo === "slow-2g" || tipo === "2g") return false;
    }
    return true;
  }

  function ligarVideo(seletor, src, botaoPausa) {
    var video = document.querySelector(seletor);
    if (!video || !src) return;
    if (!podeVideo()) return;
    video.src = src;
    var play = video.play();
    if (play && play.catch) play.catch(function () {});
    if (botaoPausa) {
      botaoPausa.hidden = false;
      botaoPausa.addEventListener("click", function () {
        if (video.paused) {
          var p = video.play();
          if (p && p.catch) p.catch(function () {});
          botaoPausa.textContent = "Pausar vídeo";
        } else {
          video.pause();
          botaoPausa.textContent = "Reproduzir vídeo";
        }
      });
    }
  }

  function iniciarVideos() {
    ligarVideo(".hero__video", "assets/video/hero-queijo.mp4", document.querySelector(".hero__pause"));
    var clip = document.querySelector(".historia-clip__video");
    if (clip && clip.getAttribute("data-src") && "IntersectionObserver" in window && podeVideo()) {
      var o2 = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (entrada) {
          if (!entrada.isIntersecting) return;
          ligarVideo(".historia-clip__video", clip.getAttribute("data-src"));
          o2.disconnect();
        });
      }, { rootMargin: "200px 0px" });
      o2.observe(clip);
    }

    var assinatura = document.querySelector(".assinatura");
    var videoAssinatura = document.querySelector(".assinatura__video");
    if (!assinatura || !videoAssinatura || !podeVideo()) return;
    if (!("IntersectionObserver" in window)) {
      ligarVideo(".assinatura__video", "assets/video/forno-abre.mp4");
      return;
    }
    var visto = false;
    var obs = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (entrada) {
          if (!entrada.isIntersecting || visto) return;
          visto = true;
          ligarVideo(".assinatura__video", "assets/video/forno-abre.mp4");
          obs.disconnect();
        });
      },
      { rootMargin: "200px 0px" }
    );
    obs.observe(assinatura);
  }

  function iniciarRevelacoes() {
    var blocos = document.querySelectorAll(".reveal");
    if (!blocos.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      blocos.forEach(function (el) {
        el.classList.add("is-in");
      });
      return;
    }
    if (!("IntersectionObserver" in window)) {
      blocos.forEach(function (el) {
        el.classList.add("is-in");
      });
      return;
    }
    var obs = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (entrada) {
          if (!entrada.isIntersecting) return;
          entrada.target.classList.add("is-in");
          obs.unobserve(entrada.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    blocos.forEach(function (el) {
      obs.observe(el);
    });
  }

  function marcarAno() {
    document.querySelectorAll("[data-ano]").forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  aplicarWhatsAppGenerico();
  iniciarPedido();
  iniciarMenu();
  iniciarVideos();
  iniciarRevelacoes();
  marcarAno();
})();
