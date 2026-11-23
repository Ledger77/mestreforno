/*
  Busca do cardápio — local, sem backend.
  Normaliza acentos/minúsculas, aceita prefixo e erros
  próximos (Damerau-Levenshtein) em nome e descrição.
*/
(function () {
  "use strict";

  function normalizar(texto) {
    return String(texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function palavras(texto) {
    var n = normalizar(texto);
    return n ? n.split(" ") : [];
  }

  function damerau(a, b) {
    var i, j, al = a.length, bl = b.length, custo;
    if (a === b) return 0;
    if (!al) return bl;
    if (!bl) return al;
    var prev2, prev = [], cur = [];
    for (j = 0; j <= bl; j++) prev[j] = j;
    for (i = 1; i <= al; i++) {
      cur = [i];
      for (j = 1; j <= bl; j++) {
        custo = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + custo);
        if (i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1)) {
          cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
        }
      }
      prev2 = prev;
      prev = cur;
    }
    return prev[bl];
  }

  function limiteDistancia(tam) {
    if (tam <= 3) return 1;
    if (tam <= 6) return 2;
    return 3;
  }

  function melhorDistancia(consulta, alvos) {
    var i, d, melhor = Infinity;
    for (i = 0; i < alvos.length; i++) {
      d = damerau(consulta, alvos[i]);
      if (d < melhor) melhor = d;
    }
    return melhor;
  }

  function avaliar(consulta, nome, descricao) {
    var q = normalizar(consulta);
    if (!q) return { tipo: "todos", pontos: 0 };
    var nomeN = normalizar(nome);
    var descN = normalizar(descricao);
    var nomePal = palavras(nome);
    var qPal = palavras(consulta);
    var i, p, pref, dist, limite, melhor;

    if (nomeN.indexOf(q) !== -1) return { tipo: "exato", pontos: q === nomeN ? 0 : 1 };
    if (descN.indexOf(q) !== -1) return { tipo: "exato", pontos: 8 };

    pref = false;
    for (i = 0; i < nomePal.length; i++) {
      p = nomePal[i];
      if (p.indexOf(q) === 0 || (q.indexOf(p) === 0 && p.length >= 3)) pref = true;
    }
    if (pref) return { tipo: "exato", pontos: 3 };

    if (qPal.length > 1) {
      var todas = qPal.every(function (qp) {
        return nomeN.indexOf(qp) !== -1 || descN.indexOf(qp) !== -1 ||
          nomePal.some(function (np) { return np.indexOf(qp) === 0 || damerau(qp, np) <= limiteDistancia(qp.length); });
      });
      if (todas) return { tipo: "exato", pontos: 4 };
    }

    limite = limiteDistancia(q.length);
    dist = damerau(q, nomeN);
    melhor = dist;
    for (i = 0; i < nomePal.length; i++) {
      melhor = Math.min(melhor, damerau(q, nomePal[i]));
    }
    if (melhor <= limite) return { tipo: "fuzzy", pontos: 20 + melhor };

    var descPal = palavras(descricao);
    melhor = melhorDistancia(q, descPal);
    if (melhor <= Math.min(limite, 2) && q.length >= 4) return { tipo: "fuzzy", pontos: 30 + melhor };

    return null;
  }

  function dadosDoItem(el) {
    var h = el.querySelector("h4");
    var p = el.querySelector(".item__body > p");
    return {
      el: el,
      nome: h ? h.textContent.trim() : "",
      descricao: p ? p.textContent.trim() : "",
    };
  }

  function iniciar() {
    var form = document.querySelector("[data-busca]");
    var campo = document.querySelector("[data-busca-campo]");
    var limpar = document.querySelector("[data-busca-limpar]");
    var sugestaoEl = document.querySelector("[data-busca-sugestao]");
    var vazioEl = document.querySelector("[data-busca-vazio]");
    var statusEl = document.querySelector("[data-busca-status]");
    var raiz = document.querySelector("[data-cardapio]");
    if (!form || !campo || !raiz) return;

    var itens = Array.prototype.slice.call(raiz.querySelectorAll("[data-item]")).map(dadosDoItem);
    var grupos = Array.prototype.slice.call(raiz.querySelectorAll(".menu-group"));
    var jump = document.querySelector("[data-menu-jump]");
    var filtro = "";

    function setHidden(el, hidden) {
      if (!el) return;
      el.hidden = hidden;
    }

    function grupoDoItem(it) {
      var g = it.el.closest && it.el.closest(".menu-group");
      return g ? g.id : "";
    }

    function tituloGrupo(id) {
      var mapa = { salgados: "Salgados", pizzas: "Pizzas" };
      return mapa[id] || id;
    }

    function atualizarBotoes() {
      if (!jump) return;
      Array.prototype.slice.call(jump.querySelectorAll("[data-filtro]")).forEach(function (btn) {
        var ativo = Boolean(filtro) && btn.getAttribute("data-filtro") === filtro;
        btn.classList.toggle("is-ativo", ativo);
        btn.setAttribute("aria-pressed", ativo ? "true" : "false");
      });
    }

    function mostrarSugestao(nome, extra, grupoId) {
      if (!sugestaoEl) return;
      sugestaoEl.hidden = false;
      sugestaoEl.innerHTML = "";
      sugestaoEl.appendChild(document.createTextNode("Você quis dizer: "));
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-sugestao", nome);
      if (grupoId) btn.setAttribute("data-sugestao-filtro", grupoId);
      btn.textContent = nome + "?";
      sugestaoEl.appendChild(btn);
      if (extra) sugestaoEl.appendChild(document.createTextNode(" " + extra));
    }

    function limparSugestao() {
      setHidden(sugestaoEl, true);
      if (sugestaoEl) sugestaoEl.textContent = "";
    }

    function aplicar(valor) {
      var q = valor == null ? campo.value : valor;
      var tem = Boolean(String(q).trim());
      setHidden(limpar, !tem);
      setHidden(jump, false);
      atualizarBotoes();

      function noFiltro(a) {
        return !filtro || grupoDoItem(a.item) === filtro;
      }

      if (!tem) {
        itens.forEach(function (it) {
          setHidden(it.el, Boolean(filtro) && grupoDoItem(it) !== filtro);
        });
        grupos.forEach(function (g) {
          setHidden(g, Boolean(filtro) && g.id !== filtro);
        });
        limparSugestao();
        setHidden(vazioEl, true);
        if (statusEl) statusEl.textContent = filtro ? "Mostrando " + tituloGrupo(filtro) + "." : "";
        return;
      }

      var avaliados = itens.map(function (it) {
        var ev = avaliar(q, it.nome, it.descricao);
        return { item: it, ev: ev };
      });
      var exatos = avaliados.filter(function (a) { return a.ev && a.ev.tipo === "exato"; });
      var fuzzys = avaliados.filter(function (a) { return a.ev && a.ev.tipo === "fuzzy"; });
      exatos.sort(function (a, b) { return a.ev.pontos - b.ev.pontos; });
      fuzzys.sort(function (a, b) { return a.ev.pontos - b.ev.pontos; });

      var exatosAqui = exatos.filter(noFiltro);
      var fuzzysAqui = fuzzys.filter(noFiltro);
      var mostrar = exatosAqui.length ? exatosAqui : fuzzysAqui;
      var outros = (exatos.length ? exatos : fuzzys).filter(function (a) { return !noFiltro(a); });

      itens.forEach(function (it) { setHidden(it.el, true); });
      mostrar.forEach(function (a) { setHidden(a.item.el, false); });

      grupos.forEach(function (g) {
        var algum = g.querySelector("[data-item]:not([hidden])");
        setHidden(g, !algum);
      });

      if (mostrar.length && !exatosAqui.length && fuzzysAqui.length) {
        mostrarSugestao(fuzzysAqui[0].item.nome);
        setHidden(vazioEl, true);
        if (statusEl) statusEl.textContent = "Sugestão: " + fuzzysAqui[0].item.nome + ".";
      } else if (mostrar.length) {
        limparSugestao();
        setHidden(vazioEl, true);
        if (statusEl) statusEl.textContent = mostrar.length + (mostrar.length === 1 ? " item encontrado." : " itens encontrados.");
      } else if (outros.length) {
        var outro = outros[0];
        var gid = grupoDoItem(outro.item);
        mostrarSugestao(outro.item.nome, "(em " + tituloGrupo(gid) + ")", gid);
        setHidden(vazioEl, true);
        if (statusEl) statusEl.textContent = "Nenhum resultado em " + tituloGrupo(filtro) + ". Sugestão em " + tituloGrupo(gid) + ": " + outro.item.nome + ".";
      } else {
        limparSugestao();
        setHidden(vazioEl, false);
        if (statusEl) statusEl.textContent = "Nenhum item encontrado.";
      }
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      aplicar(campo.value);
    });
    campo.addEventListener("input", function () {
      aplicar(campo.value);
    });
    if (limpar) {
      limpar.addEventListener("click", function () {
        campo.value = "";
        aplicar("");
        campo.focus();
      });
    }
    if (sugestaoEl) {
      sugestaoEl.addEventListener("click", function (ev) {
        var btn = ev.target.closest && ev.target.closest("[data-sugestao]");
        if (!btn) return;
        var grupoSug = btn.getAttribute("data-sugestao-filtro");
        if (grupoSug) filtro = grupoSug;
        campo.value = btn.getAttribute("data-sugestao") || "";
        aplicar(campo.value);
        campo.focus();
      });
    }

    function rolarGrupoVisivel() {
      var g = grupos.filter(function (gr) { return !gr.hidden; })[0];
      if (!g) return;
      var header = document.querySelector("header.site-header");
      var sticky = document.querySelector(".cardapio-busca-wrap");
      var offset = 6;
      if (header) offset += header.getBoundingClientRect().height;
      if (sticky) offset += sticky.getBoundingClientRect().height;
      g.style.scrollMarginTop = offset + "px";
      var reduzir = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      try {
        g.scrollIntoView({ block: "start", behavior: reduzir ? "auto" : "smooth" });
      } catch (e) {
        g.scrollIntoView(true);
      }
    }

    if (jump) {
      jump.addEventListener("click", function (ev) {
        var btn = ev.target.closest && ev.target.closest("[data-filtro]");
        if (!btn) return;
        ev.preventDefault();
        var id = btn.getAttribute("data-filtro") || "";
        filtro = filtro === id ? "" : id;
        aplicar(campo.value);
        rolarGrupoVisivel();
        var hoverFino = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
        if (!hoverFino && ev.detail !== 0) {
          try { btn.blur(); } catch (e) {}
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
