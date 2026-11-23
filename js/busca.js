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

    function setHidden(el, hidden) {
      if (!el) return;
      el.hidden = hidden;
    }

    function aplicar(valor) {
      var q = valor == null ? campo.value : valor;
      var tem = Boolean(String(q).trim());
      setHidden(limpar, !tem);

      if (!tem) {
        itens.forEach(function (it) { setHidden(it.el, false); });
        grupos.forEach(function (g) { setHidden(g, false); });
        setHidden(jump, false);
        setHidden(sugestaoEl, true);
        setHidden(vazioEl, true);
        if (sugestaoEl) sugestaoEl.textContent = "";
        if (statusEl) statusEl.textContent = "";
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

      var mostrar = exatos.length ? exatos : fuzzys;
      var visiveis = {};
      itens.forEach(function (it) { setHidden(it.el, true); });
      mostrar.forEach(function (a) {
        setHidden(a.item.el, false);
        visiveis[a.item.el.getAttribute("data-item")] = true;
      });

      grupos.forEach(function (g) {
        var algum = g.querySelector("[data-item]:not([hidden])");
        setHidden(g, !algum);
      });
      setHidden(jump, true);

      if (!exatos.length && fuzzys.length) {
        var nome = fuzzys[0].item.nome;
        if (sugestaoEl) {
          sugestaoEl.hidden = false;
          sugestaoEl.innerHTML = "";
          sugestaoEl.appendChild(document.createTextNode("Você quis dizer: "));
          var btn = document.createElement("button");
          btn.type = "button";
          btn.setAttribute("data-sugestao", nome);
          btn.textContent = nome + "?";
          sugestaoEl.appendChild(btn);
        }
        setHidden(vazioEl, true);
        if (statusEl) statusEl.textContent = "Sugestão: " + nome + ". " + fuzzys.length + (fuzzys.length === 1 ? " item encontrado." : " itens encontrados.");
      } else if (mostrar.length) {
        setHidden(sugestaoEl, true);
        if (sugestaoEl) sugestaoEl.textContent = "";
        setHidden(vazioEl, true);
        if (statusEl) statusEl.textContent = mostrar.length + (mostrar.length === 1 ? " item encontrado." : " itens encontrados.");
      } else {
        setHidden(sugestaoEl, true);
        if (sugestaoEl) sugestaoEl.textContent = "";
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
        campo.value = btn.getAttribute("data-sugestao") || "";
        aplicar(campo.value);
        campo.focus();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
