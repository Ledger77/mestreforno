/*
  Status de horário da loja. Usa sempre America/Manaus
  (HORARIOS.fuso), mesmo que o relógio do navegador esteja
  em outro fuso. Fora do horário o pedido continua liberado.
*/
(function () {
  "use strict";

  var FUSO = "America/Manaus";
  var instanteTeste = null;
  var timerMinuto = null;
  var timerMudanca = null;
  var ultimoTexto = "";

  var DIAS_CURTO = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  var DIAS_NOME = ["no domingo", "na segunda", "na terça", "na quarta", "na quinta", "na sexta", "no sábado"];
  var DIAS_TITULO = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  function cfgHorarios() {
    return typeof HORARIOS !== "undefined" && HORARIOS ? HORARIOS : { fuso: FUSO, semana: {}, fechandoMinutos: 60, exemplo: true };
  }

  function parseMinutos(hhmm) {
    var p = String(hhmm || "").split(":");
    var h = Number(p[0]);
    var m = Number(p[1] || 0);
    if (!isFinite(h) || !isFinite(m)) return null;
    return h * 60 + m;
  }

  function formatarHora(hhmm) {
    var p = String(hhmm || "").split(":");
    var h = Number(p[0]);
    var m = Number(p[1] || 0);
    if (!isFinite(h)) return "";
    return m ? h + "h" + String(m).padStart(2, "0") : h + "h";
  }

  function instanteBase() {
    if (instanteTeste == null) return Date.now();
    if (instanteTeste instanceof Date) return instanteTeste.getTime();
    var n = new Date(instanteTeste);
    return isNaN(n.getTime()) ? Date.now() : n.getTime();
  }

  function agoraManaus(instante) {
    var ms = instante == null ? instanteBase() : (instante instanceof Date ? instante.getTime() : new Date(instante).getTime());
    var fuso = cfgHorarios().fuso || FUSO;
    var map = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone: fuso,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(ms)).forEach(function (p) {
      if (p.type !== "literal") map[p.type] = p.value;
    });
    var weekday = DIAS_CURTO[map.weekday];
    if (weekday == null) weekday = 0;
    var hour = Number(map.hour);
    var minute = Number(map.minute);
    var second = Number(map.second);
    return {
      weekday: weekday,
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      hour: hour,
      minute: minute,
      second: second,
      minutos: hour * 60 + minute,
    };
  }

  function proximaAbertura(agora) {
    var semana = cfgHorarios().semana || {};
    var hoje = semana[agora.weekday];
    if (hoje && hoje.abre && agora.minutos < parseMinutos(hoje.abre)) {
      return { quando: "hoje", hora: formatarHora(hoje.abre) };
    }
    var i, d, cfg;
    for (i = 1; i <= 7; i++) {
      d = (agora.weekday + i) % 7;
      cfg = semana[d];
      if (!cfg || !cfg.abre) continue;
      return { quando: i === 1 ? "amanhã" : DIAS_NOME[d], hora: formatarHora(cfg.abre) };
    }
    return { quando: "amanhã", hora: "8h" };
  }

  function statusDaLoja(instante) {
    var agora = agoraManaus(instante);
    var semana = cfgHorarios().semana || {};
    var hoje = semana[agora.weekday];
    var limite = Number(cfgHorarios().fechandoMinutos) || 60;
    var abre = hoje ? parseMinutos(hoje.abre) : null;
    var fecha = hoje ? parseMinutos(hoje.fecha) : null;
    var estado = "fechado";
    var texto;
    var fechaHora = hoje ? formatarHora(hoje.fecha) : "";

    if (abre != null && fecha != null && agora.minutos >= abre && agora.minutos < fecha) {
      if (fecha - agora.minutos <= limite) {
        estado = "fechando";
        texto = "Fechando em breve · peça até às " + fechaHora;
      } else {
        estado = "aberto";
        texto = "Aberto agora · pedidos até às " + fechaHora;
      }
    } else {
      var prox = proximaAbertura(agora);
      texto =
        "Fechado agora · abre " +
        prox.quando +
        " às " +
        prox.hora +
        " · você ainda pode montar o pedido e enviar como encomenda no WhatsApp";
    }

    return {
      estado: estado,
      texto: texto,
      agora: agora,
      fechaHora: fechaHora,
    };
  }

  function linhasGrade() {
    var semana = cfgHorarios().semana || {};
    var ordem = [1, 2, 3, 4, 5, 6, 0];
    var grupos = [];
    ordem.forEach(function (d, idx) {
      var cfg = semana[d];
      if (!cfg) return;
      var chave = cfg.abre + "-" + cfg.fecha;
      var last = grupos[grupos.length - 1];
      if (last && last.chave === chave && last.ultimoIdx === idx - 1) {
        last.dias.push(d);
        last.ultimoIdx = idx;
      } else {
        grupos.push({ chave: chave, dias: [d], abre: cfg.abre, fecha: cfg.fecha, ultimoIdx: idx });
      }
    });
    return grupos.map(function (g) {
      var rotulo;
      if (g.dias.length === 1) rotulo = DIAS_TITULO[g.dias[0]];
      else if (g.dias[0] === 1 && g.dias[g.dias.length - 1] === 5 && g.dias.length === 5) rotulo = "Segunda a sexta";
      else if (g.dias[0] === 6 && g.dias[g.dias.length - 1] === 0 && g.dias.length === 2) rotulo = "Sábado e domingo";
      else rotulo = DIAS_TITULO[g.dias[0]] + " a " + DIAS_TITULO[g.dias[g.dias.length - 1]].toLowerCase();
      return rotulo + ", das " + formatarHora(g.abre) + " às " + formatarHora(g.fecha);
    });
  }

  function textoGrade() {
    var linhas = linhasGrade();
    return linhas.length ? linhas.join(". ") + "." : "";
  }

  function preencherGrade() {
    var texto = textoGrade();
    if (!texto) return;
    document.querySelectorAll("[data-horario-grade]").forEach(function (el) {
      el.textContent = texto;
    });
    var lista = document.querySelector("[data-horario-lista]");
    if (lista) {
      lista.innerHTML = "";
      linhasGrade().forEach(function (linha) {
        var li = document.createElement("li");
        li.textContent = linha;
        lista.appendChild(li);
      });
    }
    var ex = cfgHorarios().exemplo;
    document.querySelectorAll("[data-horario-exemplo]").forEach(function (el) {
      el.hidden = !ex;
    });
  }

  function preencherPagamento() {
    if (typeof PAGAMENTO === "undefined" || !PAGAMENTO || !PAGAMENTO.texto) return;
    document.querySelectorAll("[data-pagamento-texto]").forEach(function (el) {
      el.textContent = PAGAMENTO.texto;
    });
  }

  function atualizarStatus() {
    var caixa = document.querySelector("[data-loja-status]");
    var dest = document.querySelector("[data-loja-status-texto]");
    if (!caixa && !dest) return;
    var st = statusDaLoja();
    if (caixa) caixa.setAttribute("data-estado", st.estado);
    if (dest && st.texto !== ultimoTexto) {
      dest.textContent = st.texto;
      ultimoTexto = st.texto;
    }
  }

  function msAteProximoMinuto(agora) {
    return Math.max(200, (60 - (agora.second || 0)) * 1000);
  }

  function msAteProximaMudanca(agora) {
    var semana = cfgHorarios().semana || {};
    var hoje = semana[agora.weekday];
    if (!hoje) return 60 * 1000;
    var abre = parseMinutos(hoje.abre);
    var fecha = parseMinutos(hoje.fecha);
    var limite = Number(cfgHorarios().fechandoMinutos) || 60;
    var alvos = [];
    if (abre != null) alvos.push(abre);
    if (fecha != null) {
      alvos.push(fecha);
      alvos.push(fecha - limite);
    }
    var i, d, melhor = Infinity;
    for (i = 0; i < alvos.length; i++) {
      d = alvos[i] - agora.minutos;
      if (d <= 0) continue;
      var ms = d * 60 * 1000 - (agora.second || 0) * 1000;
      if (ms < melhor) melhor = ms;
    }
    if (!isFinite(melhor)) {
      var ateMeiaNoite = (24 * 60 - agora.minutos) * 60 * 1000 - (agora.second || 0) * 1000;
      melhor = Math.max(200, ateMeiaNoite);
    }
    return Math.max(200, melhor);
  }

  function agendar() {
    if (timerMinuto) clearTimeout(timerMinuto);
    if (timerMudanca) clearTimeout(timerMudanca);
    var agora = agoraManaus();
    timerMinuto = setTimeout(function () {
      atualizarStatus();
      agendar();
    }, Math.min(msAteProximoMinuto(agora), 60 * 1000));
    timerMudanca = setTimeout(function () {
      atualizarStatus();
      agendar();
    }, msAteProximaMudanca(agora));
  }

  function iniciar() {
    preencherGrade();
    preencherPagamento();
    atualizarStatus();
    agendar();
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") atualizarStatus();
    });
    window.addEventListener("pageshow", function () {
      atualizarStatus();
    });
  }

  window.MF = window.MF || {};
  MF.agoraManaus = agoraManaus;
  MF.statusDaLoja = statusDaLoja;
  MF.textoGradeHorarios = textoGrade;
  MF.definirAgoraTeste = function (valor) {
    instanteTeste = valor == null || valor === "" ? null : valor;
    atualizarStatus();
    if (instanteTeste == null) agendar();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
