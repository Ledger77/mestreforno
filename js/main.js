/*
  Liga o WhatsApp, o cardápio com quantidades, o vídeo do hero,
  as revelações e o menu. O HTML já traz o cardápio e os links
  wa.me, então a página continua utilizável se este arquivo falhar.
*/
(function () {
  "use strict";

  var STORAGE = "mestreforno-pedido";

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

  function lerPedido() {
    try {
      var bruto = localStorage.getItem(STORAGE);
      var dados = bruto ? JSON.parse(bruto) : {};
      return dados && typeof dados === "object" ? dados : {};
    } catch (e) {
      return {};
    }
  }

  function gravarPedido(pedido) {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(pedido));
    } catch (e) {}
  }

  function totalItens(pedido) {
    return Object.keys(pedido).reduce(function (s, id) {
      return s + (Number(pedido[id]) || 0);
    }, 0);
  }

  function montarMensagem(pedido, itens) {
    var linhas = ["Olá, Mestre Forno! Quero fazer um pedido:", ""];
    var subtotal = 0;
    var tem = false;
    Object.keys(pedido).forEach(function (id) {
      var qtd = Number(pedido[id]) || 0;
      var item = itens[id];
      if (!qtd || !item) return;
      tem = true;
      subtotal += qtd * (Number(item.centavos) || 0);
      linhas.push("• " + qtd + "× " + item.nome + " (" + item.preco + ")");
    });
    if (!tem) return SITE && SITE.mensagem ? SITE.mensagem : "Olá, Mestre Forno! Quero fazer um pedido.";
    linhas.push("");
    linhas.push("Subtotal estimado: " + formatarReais(subtotal));
    linhas.push("Taxa de entrega via 99 Entrega a combinar.");
    return linhas.join("\n");
  }

  function iniciarPedido() {
    var itens = mapaItens();
    var pedido = lerPedido();
    var bar = document.querySelector("[data-pedido-bar]");
    var rotulo = document.querySelector("[data-pedido-rotulo]");
    var lista = document.querySelector("[data-carrinho-lista]");
    var totalEl = document.querySelector("[data-carrinho-total]");
    var drawer = document.getElementById("carrinho");

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
      var mensagem = montarMensagem(pedido, itens);
      var url = urlWhatsApp(mensagem);
      document.querySelectorAll("[data-whatsapp-pedido]").forEach(function (el) {
        aplicarLink(el, url);
      });
      if (rotulo) {
        rotulo.textContent = n
          ? n + (n === 1 ? " item" : " itens") + " · Enviar pedido"
          : "Pedir pelo WhatsApp";
      }
      if (bar) bar.classList.toggle("tem-itens", n > 0);

      if (lista) {
        if (!n) {
          lista.innerHTML = "<p>Nenhum item ainda. Escolha no cardápio.</p>";
          if (totalEl) totalEl.hidden = true;
        } else {
          var subtotal = 0;
          var html = "<ul>";
          Object.keys(pedido).forEach(function (id) {
            var q = Number(pedido[id]) || 0;
            var item = itens[id];
            if (!q || !item) return;
            subtotal += q * (Number(item.centavos) || 0);
            html +=
              "<li><strong>" +
              escapar(item.nome) +
              "</strong> — " +
              q +
              "× " +
              escapar(item.preco) +
              "</li>";
          });
          html += "</ul>";
          lista.innerHTML = html;
          if (totalEl) {
            totalEl.hidden = false;
            totalEl.textContent = "Subtotal estimado: " + formatarReais(subtotal);
          }
        }
      }
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

    if (bar) {
      bar.addEventListener("click", function (evento) {
        if (!totalItens(pedido)) return;
        if (evento.target.closest("[data-whatsapp-pedido]") && drawer && evento.shiftKey) {
          /* atalho: shift mantém o envio direto */
          return;
        }
      });
    }

    document.querySelectorAll("[data-fecha-carrinho]").forEach(function (botao) {
      botao.addEventListener("click", function () {
        if (drawer) drawer.hidden = true;
      });
    });

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
