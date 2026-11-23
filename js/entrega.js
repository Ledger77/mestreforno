/*
  Distância e faixas de entrega — Mestre Forno
  Geocodificação em cascata: Nominatim/OSM (1 pedido/s, sequencial)
  e Photon (Komoot) como reserva, só no recorte urbano de Manaus.
  Rota: OSRM público. Se a rota falhar, linha reta × fatorLinhaReta.
  Sem chave secreta. Resultados são só para o cliente confirmar.
*/
(function (global) {
  "use strict";

  var filaBusca = Promise.resolve();
  var cacheGeo = {};
  var ULTIMO_NOMINATIM = 0;
  var ULTIMO_PHOTON = 0;
  var INTERVALO_NOMINATIM = 1100;
  var INTERVALO_PHOTON = 300;

  function cfg() {
    return typeof ENTREGA !== "undefined" ? ENTREGA : null;
  }

  function kmArredondado(km) {
    return Math.round((Number(km) || 0) * 10) / 10;
  }

  function haversineKm(a, b) {
    var r = 6371;
    var dLat = ((b.lat - a.lat) * Math.PI) / 180;
    var dLon = ((b.lon - a.lon) * Math.PI) / 180;
    var la1 = (a.lat * Math.PI) / 180;
    var la2 = (b.lat * Math.PI) / 180;
    var h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function dentroDeManaus(lat, lon) {
    var m = cfg() && cfg().manaus;
    if (!m) return false;
    return lat <= m.norte && lat >= m.sul && lon >= m.oeste && lon <= m.leste;
  }

  function semAcento(s) {
    var t = String(s == null ? "" : s);
    try {
      return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch (e) {
      return t;
    }
  }

  function normalizarNome(s) {
    return semAcento(s)
      .trim()
      .toLowerCase()
      .replace(/[.,;:]/g, " ")
      .replace(/\s+/g, " ");
  }

  function nomesIguais(a, b) {
    if (!a || !b) return false;
    return normalizarNome(a) === normalizarNome(b);
  }

  function pareceManaus(item) {
    var end = item && item.address ? item.address : {};
    var cidade = String(end.city || end.town || end.municipality || item.city || "");
    var display = String(item && (item.display_name || item.label) ? item.display_name || item.label : "");
    var lat = Number(item && item.lat);
    var lon = Number(item && item.lon);
    if (!dentroDeManaus(lat, lon)) return false;
    if (cidade) return /manaus/i.test(cidade);
    return /(^|,\s*)Manaus(,|$)/i.test(display);
  }

  function faixaPorKm(km) {
    var lista = (cfg() && cfg().faixas) || [];
    var k = Number(km) || 0;
    var i;
    for (i = 0; i < lista.length; i++) {
      if (k <= lista[i].ateKm + 1e-9) return lista[i];
    }
    return lista[lista.length - 1] || null;
  }

  function faixaPorId(id) {
    var lista = (cfg() && cfg().faixas) || [];
    var i;
    for (i = 0; i < lista.length; i++) {
      if (lista[i].id === id) return lista[i];
    }
    return null;
  }

  function volumeDoItem(item) {
    var mapa = (cfg() && cfg().volumePorUnidade) || {};
    var unidade = item && item.unidade ? item.unidade : "un";
    if (Object.prototype.hasOwnProperty.call(mapa, unidade)) return mapa[unidade];
    return 1;
  }

  function volumeDoPedido(pedido, itens) {
    var total = 0;
    Object.keys(pedido || {}).forEach(function (id) {
      var q = Number(pedido[id]) || 0;
      var item = itens && itens[id];
      if (!q || !item) return;
      total += q * volumeDoItem(item);
    });
    return total;
  }

  function motoPermitida(volume) {
    var limite = cfg() && typeof cfg().LIMITE_VOLUME_MOTO === "number" ? cfg().LIMITE_VOLUME_MOTO : 16;
    return volume <= limite;
  }

  function chaveCache(partes) {
    return [partes.rua, partes.numero, partes.bairro, partes.referencia, partes.livre]
      .map(function (s) {
        return normalizarNome(s || "");
      })
      .join("|");
  }

  function esperar(ms, ultimoRef) {
    var espera = ms - (Date.now() - ultimoRef.t);
    if (espera <= 0) return Promise.resolve();
    return new Promise(function (ok) {
      setTimeout(ok, espera);
    });
  }

  var clockNominatim = { t: 0 };
  var clockPhoton = { t: 0 };

  function fetchJson(url, timeoutMs) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, timeoutMs || 8000);
    return fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (res) {
        if (!res.ok) throw new Error("http " + res.status);
        return res.json();
      })
      .finally(function () {
        clearTimeout(timer);
      });
  }

  function ehTipoRua(addresstype, type, category) {
    var a = String(addresstype || "").toLowerCase();
    var c = String(category || "").toLowerCase();
    if (c === "highway") return true;
    return /^(house|building|address|road|yes)$/.test(a);
  }

  function ehTipoBairro(addresstype, type, category) {
    var a = String(addresstype || "").toLowerCase();
    var t = String(type || "").toLowerCase();
    var c = String(category || "").toLowerCase();
    if (/^(suburb|neighbourhood|neighborhood|quarter|city_district|district|city_block)$/.test(a)) return true;
    return c === "place" && /^(suburb|neighbourhood|neighborhood|quarter|district|city_block)$/.test(t);
  }

  function tipoPrecisao(addresstype, type, category) {
    if (ehTipoRua(addresstype, type, category)) return "rua";
    if (ehTipoBairro(addresstype, type, category)) return "bairro";
    return "outro";
  }

  function bboxDeNominatim(item) {
    var b = item && item.boundingbox;
    if (!b || b.length < 4) return null;
    return {
      sul: Number(b[0]),
      norte: Number(b[1]),
      oeste: Number(b[2]),
      leste: Number(b[3]),
    };
  }

  function nomesAlternativos(item) {
    var nd = item && item.namedetails ? item.namedetails : {};
    var lista = [];
    Object.keys(nd).forEach(function (k) {
      if (!/^(alt_name|old_name|loc_name|official_name|short_name)(:[a-z-]+)?$/i.test(k) || !nd[k]) return;
      String(nd[k])
        .split(";")
        .forEach(function (parte) {
          var n = parte.trim();
          if (n) lista.push(n);
        });
    });
    return lista;
  }

  function deNominatim(item) {
    var end = item.address || {};
    var lat = Number(item.lat);
    var lon = Number(item.lon);
    var precisao = tipoPrecisao(item.addresstype, item.type, item.category);
    return {
      label: item.display_name,
      lat: lat,
      lon: lon,
      osmId: item.osm_type && item.osm_id ? item.osm_type + "/" + item.osm_id : "",
      precisao: precisao,
      aproximado: precisao !== "rua",
      ruaEncontrada: end.road || "",
      bairroEncontrado: end.suburb || end.neighbourhood || end.quarter || "",
      nomesAlts: nomesAlternativos(item),
      bbox: precisao === "bairro" ? bboxDeNominatim(item) : null,
      fonteBusca: "nominatim",
    };
  }

  function dePhoton(feat) {
    var p = feat && feat.properties ? feat.properties : {};
    var c = feat && feat.geometry && feat.geometry.coordinates ? feat.geometry.coordinates : [];
    var lon = Number(c[0]);
    var lat = Number(c[1]);
    var precisao = tipoPrecisao(
      p.osm_key === "highway" || /^(house|building)$/.test(p.osm_value || "") ? "road" : p.osm_value,
      p.osm_value,
      p.osm_key
    );
    var label = [p.name || p.street, p.district, p.city, p.state, p.country].filter(Boolean).join(", ");
    return {
      label: label,
      lat: lat,
      lon: lon,
      osmId: p.osm_type && p.osm_id ? p.osm_type + "/" + p.osm_id : "",
      precisao: precisao,
      aproximado: precisao !== "rua",
      ruaEncontrada: p.name && p.osm_key === "highway" ? p.name : p.street || "",
      bairroEncontrado: p.district || p.locality || (precisao === "bairro" ? p.name || "" : ""),
      bbox: null,
      fonteBusca: "photon",
      city: p.city || "",
      display_name: label,
    };
  }

  function temRua(lista) {
    return (lista || []).some(function (i) {
      return i.precisao === "rua";
    });
  }

  function bateBairro(item, bairro) {
    if (!item || !bairro) return false;
    if (nomesIguais(item.bairroEncontrado, bairro)) return true;
    var rotulo = normalizarNome((item.label || "").split(",")[0] || "");
    return rotulo === normalizarNome(bairro);
  }

  function nomeVia(s) {
    return normalizarNome(s)
      .replace(/^(avenida|alameda|travessa|estrada|rodovia|rua|beco|praca|largo|via|av|al|tv|est|rod)\s+/, "")
      .trim();
  }

  function mesmaVia(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    var ta = a.split(" ").filter(Boolean);
    var tb = b.split(" ").filter(Boolean);
    function cobre(maior, menor) {
      if (!menor.length) return false;
      if (menor.length === 1 && menor[0].length < 5) return false;
      return menor.every(function (tok) {
        return maior.indexOf(tok) !== -1;
      });
    }
    return ta.length <= tb.length ? cobre(tb, ta) : cobre(ta, tb);
  }

  function nomePrincipal(item) {
    if (!item) return "";
    return item.ruaEncontrada || (item.label ? String(item.label).split(",")[0] : "") || "";
  }

  function bateRuaPrimaria(item, rua) {
    if (!item || !rua) return false;
    var alvo = nomeVia(rua);
    return !!alvo && mesmaVia(nomeVia(nomePrincipal(item)), alvo);
  }

  function bateRuaAlias(item, rua) {
    if (!item || !rua || !item.nomesAlts) return false;
    var alvo = nomeVia(rua);
    if (!alvo) return false;
    return item.nomesAlts.some(function (n) {
      return mesmaVia(nomeVia(n), alvo);
    });
  }

  function bateRua(item, rua) {
    return bateRuaPrimaria(item, rua) || bateRuaAlias(item, rua);
  }

  function temRuaNoBairro(lista, bairro) {
    if (!bairro) return temRua(lista);
    return (lista || []).some(function (i) {
      return i.precisao === "rua" && bateBairro(i, bairro);
    });
  }

  function temRuaPedida(lista, partes) {
    return (lista || []).some(function (i) {
      return i.precisao === "rua" && (!partes || !partes.rua || bateRua(i, partes.rua));
    });
  }

  function temRuaPedidaNoBairro(lista, partes) {
    return (lista || []).some(function (i) {
      return (
        i.precisao === "rua" &&
        (!partes || !partes.rua || bateRua(i, partes.rua)) &&
        (!partes || !partes.bairro || bateBairro(i, partes.bairro))
      );
    });
  }

  function dedup(lista) {
    var vistos = {};
    var out = [];
    (lista || []).forEach(function (item) {
      var chave = item.osmId
        ? "osm:" + item.osmId
        : "geo:" + item.lat.toFixed(5) + "," + item.lon.toFixed(5);
      if (vistos[chave]) return;
      vistos[chave] = true;
      out.push(item);
    });
    return out;
  }

  function pontuar(item, partes) {
    var p = 0;
    if (item.precisao === "rua") p += 100;
    else if (item.precisao === "bairro") p += 20;
    else if (item.precisao === "referencia") p += 10;
    if (partes && partes.bairro && bateBairro(item, partes.bairro)) p += 50;
    return p;
  }

  function ordenarResultados(lista, partes) {
    var o = cfg() && cfg().origem;
    return (lista || []).slice().sort(function (a, b) {
      var d = pontuar(b, partes) - pontuar(a, partes);
      if (d) return d;
      if (o) return haversineKm(o, a) - haversineKm(o, b);
      return 0;
    });
  }

  function umPorBairro(lista) {
    var vistos = {};
    var out = [];
    (lista || []).forEach(function (item) {
      var chave;
      if (item.precisao === "rua") {
        chave =
          "rua|" +
          normalizarNome(item.ruaEncontrada || (item.label || "").split(",")[0] || "rua") +
          "|" +
          normalizarNome(item.bairroEncontrado || "");
      } else if (item.precisao === "bairro") {
        chave = "bairro|" + normalizarNome(item.bairroEncontrado || item.label || "bairro");
      } else {
        chave = item.osmId
          ? "osm:" + item.osmId
          : "geo:" + item.lat.toFixed(5) + "," + item.lon.toFixed(5);
      }
      if (vistos[chave]) return;
      vistos[chave] = true;
      out.push(item);
    });
    return out;
  }

  function rotuloDestino(item) {
    if (!item) return "";
    if (item.ruaEncontrada && item.bairroEncontrado) {
      return item.ruaEncontrada + " — " + item.bairroEncontrado;
    }
    if (item.precisao === "bairro" && item.bairroEncontrado) {
      return "Bairro " + item.bairroEncontrado + " (aproximado)";
    }
    return item.label || "";
  }

  function bairrosDaLista(lista) {
    var out = [];
    var vistos = {};
    (lista || []).forEach(function (item) {
      if (item.precisao !== "rua" || !item.bairroEncontrado) return;
      var n = normalizarNome(item.bairroEncontrado);
      if (vistos[n]) return;
      vistos[n] = true;
      out.push(item.bairroEncontrado);
    });
    return out;
  }

  function maioriaOficial(ruas, bairro) {
    if (!ruas || ruas.length <= 1) return ruas || [];
    var grupos = [];
    ruas.forEach(function (item) {
      var g = grupos.find(function (gr) {
        return mesmaVia(nomeVia(nomePrincipal(gr[0])), nomeVia(nomePrincipal(item)));
      });
      if (g) g.push(item);
      else grupos.push([item]);
    });
    if (bairro) {
      var noBairro = grupos.filter(function (gr) {
        return gr.some(function (i) {
          return bateBairro(i, bairro);
        });
      });
      if (noBairro.length) grupos = noBairro;
    }
    grupos.sort(function (a, b) {
      return b.length - a.length;
    });
    return grupos[0] || ruas;
  }

  function preferirRua(lista, partes) {
    var base = lista || [];
    var ruaPedida = partes && partes.rua;
    if (ruaPedida) {
      var primarias = base.filter(function (i) {
        return i.precisao === "rua" && bateRuaPrimaria(i, ruaPedida);
      });
      var aliases = base.filter(function (i) {
        return i.precisao === "rua" && !bateRuaPrimaria(i, ruaPedida) && bateRuaAlias(i, ruaPedida);
      });
      if (primarias.length) {
        aliases = aliases.filter(function (i) {
          if (primarias.some(function (p) {
            return nomesIguais(p.bairroEncontrado, i.bairroEncontrado);
          })) {
            return false;
          }
          return Boolean(partes.bairro && bateBairro(i, partes.bairro));
        });
        base = primarias.concat(aliases);
      } else if (aliases.length) {
        base = aliases;
      } else {
        base = base.filter(function (i) {
          return i.precisao !== "rua";
        });
      }
    }
    var ruas = base.filter(function (i) {
      return i.precisao === "rua";
    });
    if (ruas.length) {
      ruas = maioriaOficial(ruas, partes && partes.bairro);
      base = ruas;
    }
    return umPorBairro(ordenarResultados(base, partes));
  }

  function montarAvisos(lista, partes) {
    var variosBairros = bairrosDaLista(lista).length > 1;
    return lista.map(function (item) {
      var aviso = "";
      if (item.precisao === "bairro") {
        aviso =
          "Não localizamos a rua exata. A estimativa usa o bairro " +
          (item.bairroEncontrado || partes.bairro || "informado") +
          " e é aproximada.";
      } else if (item.precisao === "referencia") {
        aviso = "Encontramos um ponto a partir da referência. Confira se está certo; a estimativa pode ser aproximada.";
      } else if (variosBairros) {
        aviso =
          "Esta rua aparece em mais de um bairro. Escolha o que confere" +
          (partes.bairro ? " (você informou " + partes.bairro + ")" : "") +
          ".";
      } else if (item.bairroEncontrado && partes.bairro && !nomesIguais(item.bairroEncontrado, partes.bairro)) {
        aviso =
          "Encontramos esta rua no bairro " +
          item.bairroEncontrado +
          ". Confere? (você informou " +
          partes.bairro +
          ".)";
      } else if (item.bairroEncontrado) {
        aviso = "Encontramos esta rua no bairro " + item.bairroEncontrado + ". Confere?";
      }
      item.aviso = aviso;
      item.rotulo = rotuloDestino(item);
      return item;
    });
  }

  function buscarNominatim(params) {
    var e = cfg();
    if (!e) return Promise.reject(new Error("config"));
    var url = new URL(e.nominatim);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("namedetails", "1");
    url.searchParams.set("limit", "5");
    url.searchParams.set("countrycodes", "br");
    url.searchParams.set("accept-language", "pt-BR");
    Object.keys(params || {}).forEach(function (k) {
      if (params[k] != null && params[k] !== "" && params[k] !== false) {
        url.searchParams.set(k, String(params[k]));
      }
    });
    return esperar(INTERVALO_NOMINATIM, clockNominatim).then(function () {
      clockNominatim.t = Date.now();
      return fetchJson(url.toString(), 8000);
    }).then(function (lista) {
      return (Array.isArray(lista) ? lista : []).filter(pareceManaus).map(deNominatim);
    });
  }

  function buscarPhoton(q) {
    var e = cfg();
    if (!e || !e.photon || !q) return Promise.resolve([]);
    var url = new URL(e.photon);
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "5");
    url.searchParams.set("lat", String(e.origem.lat));
    url.searchParams.set("lon", String(e.origem.lon));
    return esperar(INTERVALO_PHOTON, clockPhoton).then(function () {
      clockPhoton.t = Date.now();
      return fetchJson(url.toString(), 8000);
    }).then(function (dados) {
      var feats = dados && dados.features ? dados.features : [];
      return feats
        .map(dePhoton)
        .filter(function (item) {
          return pareceManaus(item);
        });
    }).catch(function () {
      return [];
    });
  }

  function paramsEstruturados(rua, numero) {
    var street = numero ? numero + " " + rua : rua;
    return {
      street: street,
      city: "Manaus",
      state: "Amazonas",
      country: "Brasil",
    };
  }

  function viewboxBias() {
    var e = cfg();
    return {
      viewbox: e.manaus.oeste + "," + e.manaus.norte + "," + e.manaus.leste + "," + e.manaus.sul,
    };
  }

  function encadear(tentativas, partes) {
    var acc = [];
    var i = 0;

    function passo() {
      if (i >= tentativas.length) return Promise.resolve(preferirRua(dedup(acc), partes));
      var tipo = tentativas[i].tipo || "";
      var pedida = temRuaPedida(acc, partes);
      var pedidaNoBairro = temRuaPedidaNoBairro(acc, partes);
      var nBairrosPedida = bairrosDaLista(
        (acc || []).filter(function (item) {
          return item.precisao === "rua" && (!partes.rua || bateRua(item, partes.rua));
        })
      ).length;
      if (pedida && (tipo === "bairro" || tipo === "referencia" || tipo === "ruaCidade")) {
        i += 1;
        return passo();
      }
      if (pedidaNoBairro && tipo === "ruaBairro") {
        i += 1;
        return passo();
      }
      if (nBairrosPedida >= 2 && tipo === "ruaLivre") {
        i += 1;
        return passo();
      }
      return tentativas[i]
        .run()
        .catch(function () {
          return [];
        })
        .then(function (lista) {
          acc = acc.concat(lista || []);
          i += 1;
          return passo();
        });
    }

    return passo().then(function (lista) {
      return montarAvisos(lista, partes);
    });
  }

  function geocodificar(entrada) {
    var partes =
      typeof entrada === "string"
        ? { livre: String(entrada).trim(), rua: "", numero: "", bairro: "", referencia: "" }
        : {
            rua: String((entrada && entrada.rua) || "").trim(),
            numero: String((entrada && entrada.numero) || "").trim(),
            bairro: String((entrada && entrada.bairro) || "").trim(),
            referencia: String((entrada && entrada.referencia) || "").trim(),
            livre: "",
          };

    var chave = chaveCache(partes);
    if (!chave.replace(/\|/g, "")) return Promise.resolve([]);
    if (cacheGeo[chave]) return Promise.resolve(montarAvisos(cacheGeo[chave].map(function (item) {
      var copia = {};
      Object.keys(item).forEach(function (k) {
        copia[k] = item[k];
      });
      return copia;
    }), partes));

    var rua = partes.rua;
    var ruaSem = semAcento(rua);
    var bairro = partes.bairro;
    var bairroSem = semAcento(bairro);
    var numero = partes.numero;
    var ref = partes.referencia;
    var tentativas = [];

    if (partes.livre) {
      tentativas.push({
        run: function () {
          return buscarNominatim(Object.assign({ q: partes.livre }, viewboxBias()));
        },
      });
      tentativas.push({
        run: function () {
          return buscarPhoton(partes.livre);
        },
        depoisDaRua: true,
      });
    }

    if (rua && numero) {
      tentativas.push({
        run: function () {
          return buscarNominatim(paramsEstruturados(rua, numero));
        },
      });
    }
    if (rua) {
      tentativas.push({
        run: function () {
          return buscarNominatim(paramsEstruturados(rua, ""));
        },
        depoisDaRua: true,
        tipo: "ruaCidade",
      });
    }
    if (rua && ruaSem !== rua) {
      tentativas.push({
        run: function () {
          return buscarNominatim(paramsEstruturados(ruaSem, numero));
        },
        depoisDaRua: true,
        tipo: "ruaCidade",
      });
    }

    if (rua && bairro) {
      tentativas.push({
        run: function () {
          return buscarNominatim(Object.assign({ q: rua + ", " + bairro + ", Manaus, Amazonas, Brasil" }, viewboxBias()));
        },
        depoisDaRua: true,
        tipo: "ruaBairro",
      });
      tentativas.push({
        run: function () {
          return buscarPhoton(rua + ", " + bairro + ", Manaus");
        },
        depoisDaRua: true,
        tipo: "ruaBairro",
      });
    }

    if (rua && (ruaSem !== rua || bairroSem !== bairro) && bairro) {
      tentativas.push({
        run: function () {
          return buscarNominatim(
            Object.assign({ q: ruaSem + ", " + bairroSem + ", Manaus, Amazonas, Brasil" }, viewboxBias())
          );
        },
        depoisDaRua: true,
        tipo: "ruaBairro",
      });
    }

    if (rua) {
      tentativas.push({
        run: function () {
          return buscarNominatim(Object.assign({ q: rua + ", Manaus, Amazonas, Brasil" }, viewboxBias()));
        },
        depoisDaRua: true,
        tipo: "ruaLivre",
      });
      tentativas.push({
        run: function () {
          return buscarPhoton(rua + ", Manaus");
        },
        depoisDaRua: true,
        tipo: "ruaLivre",
      });
    }
    if (rua && ruaSem !== rua) {
      tentativas.push({
        run: function () {
          return buscarNominatim(Object.assign({ q: ruaSem + ", Manaus, Amazonas, Brasil" }, viewboxBias()));
        },
        depoisDaRua: true,
        tipo: "ruaLivre",
      });
    }

    if (bairro) {
      tentativas.push({
        run: function () {
          return buscarNominatim(Object.assign({ q: bairro + ", Manaus, Amazonas, Brasil" }, viewboxBias())).then(
            function (lista) {
              return lista
                .filter(function (i) {
                  return bateBairro(i, bairro);
                })
                .map(function (i) {
                  i.precisao = "bairro";
                  i.aproximado = true;
                  if (!i.bairroEncontrado) i.bairroEncontrado = bairro;
                  if (!i.bbox) i.bbox = null;
                  return i;
                });
            }
          );
        },
        depoisDaRua: true,
        tipo: "bairro",
      });
      tentativas.push({
        run: function () {
          return buscarPhoton(bairro + ", Manaus").then(function (lista) {
            return lista
              .filter(function (i) {
                return bateBairro(i, bairro);
              })
              .map(function (i) {
                i.precisao = "bairro";
                i.aproximado = true;
                if (!i.bairroEncontrado) i.bairroEncontrado = bairro;
                return i;
              });
          });
        },
        depoisDaRua: true,
        tipo: "bairro",
      });
    }

    if (ref) {
      tentativas.push({
        run: function () {
          var q = bairro ? ref + ", " + bairro + ", Manaus, Amazonas, Brasil" : ref + ", Manaus, Amazonas, Brasil";
          return buscarNominatim(Object.assign({ q: q }, viewboxBias())).then(function (lista) {
            return lista.map(function (i) {
              if (i.precisao !== "rua") {
                i.precisao = "referencia";
                i.aproximado = true;
              }
              return i;
            });
          });
        },
        depoisDaRua: true,
        tipo: "referencia",
      });
      tentativas.push({
        run: function () {
          return buscarPhoton(ref + ", Manaus").then(function (lista) {
            return lista.map(function (i) {
              if (i.precisao !== "rua") {
                i.precisao = "referencia";
                i.aproximado = true;
              }
              return i;
            });
          });
        },
        depoisDaRua: true,
        tipo: "referencia",
      });
    }

    var promessa = filaBusca
      .catch(function () {})
      .then(function () {
        return encadear(tentativas, partes);
      })
      .then(function (lista) {
        if (lista && lista.length) {
          cacheGeo[chave] = lista.map(function (item) {
            var copia = {};
            Object.keys(item).forEach(function (k) {
              copia[k] = item[k];
            });
            return copia;
          });
        }
        return lista;
      });

    filaBusca = promessa.catch(function () {
      return [];
    });
    return promessa;
  }

  function rotaOsrm(dest) {
    var e = cfg();
    if (!e || !dest) return Promise.reject(new Error("destino"));
    var path =
      e.osrm +
      e.origem.lon +
      "," +
      e.origem.lat +
      ";" +
      dest.lon +
      "," +
      dest.lat +
      "?overview=false&alternatives=false";
    return fetchJson(path, 8000).then(function (dados) {
      var rota = dados && dados.routes && dados.routes[0];
      if (!rota || typeof rota.distance !== "number") throw new Error("sem rota");
      return rota.distance / 1000;
    });
  }

  function kmCantoMaisLonge(bbox) {
    var e = cfg();
    if (!bbox || !e) return 0;
    var origem = e.origem;
    var cantos = [
      { lat: bbox.sul, lon: bbox.oeste },
      { lat: bbox.sul, lon: bbox.leste },
      { lat: bbox.norte, lon: bbox.oeste },
      { lat: bbox.norte, lon: bbox.leste },
    ];
    var max = 0;
    cantos.forEach(function (c) {
      if (!isFinite(c.lat) || !isFinite(c.lon)) return;
      var d = haversineKm(origem, c);
      if (d > max) max = d;
    });
    return max * (e.fatorLinhaReta || 1.3);
  }

  function estimarDistancia(dest) {
    var e = cfg();
    var reta = haversineKm(e.origem, dest);
    var fallback = reta * (e.fatorLinhaReta || 1.3);
    var aproximado = Boolean(dest && (dest.aproximado || dest.precisao === "bairro" || dest.precisao === "referencia"));
    return rotaOsrm(dest)
      .then(function (kmRota) {
        var km = kmRota;
        var fonte = aproximado ? dest.precisao || "aproximada" : "rota";
        if (dest && dest.precisao === "bairro") {
          var longe = kmCantoMaisLonge(dest.bbox);
          if (!longe) longe = km + 2.5 * (e.fatorLinhaReta || 1.3);
          if (longe > km) km = longe;
          fonte = "bairro";
        }
        if (dest && dest.precisao === "referencia") fonte = "referencia";
        return {
          km: km,
          kmExibido: kmArredondado(km),
          fonte: fonte,
          reta: reta,
          aproximado: aproximado,
          bairroNome: dest.bairroEncontrado || "",
        };
      })
      .catch(function () {
        var km = fallback;
        var fonte = "aproximada";
        if (dest && dest.precisao === "bairro") {
          var longe = kmCantoMaisLonge(dest.bbox);
          if (!longe) longe = km + 2.5 * (e.fatorLinhaReta || 1.3);
          if (longe > km) km = longe;
          fonte = "bairro";
        }
        return {
          km: km,
          kmExibido: kmArredondado(km),
          fonte: fonte,
          reta: reta,
          aproximado: true,
          bairroNome: dest && dest.bairroEncontrado ? dest.bairroEncontrado : "",
        };
      });
  }

  function textoDistancia(dist) {
    if (!dist) return "";
    var km = String(dist.kmExibido).replace(".", ",") + " km";
    if (dist.fonte === "bairro") {
      return (
        km +
        " (estimativa aproximada pelo bairro" +
        (dist.bairroNome ? " " + dist.bairroNome : "") +
        ")"
      );
    }
    if (dist.fonte === "referencia") return km + " (estimativa aproximada a partir da referência)";
    if (dist.fonte === "rota") return km + " (rota)";
    return km + " (estimativa aproximada)";
  }

  function textoOrigem() {
    var o = cfg() && cfg().origem;
    if (!o) return "";
    return (
      o.logradouro +
      ", nº " +
      o.numero +
      ", " +
      o.bairro +
      ", " +
      o.cidade +
      "/" +
      o.uf +
      ". Referência: " +
      o.referencia +
      "."
    );
  }

  global.EntregaServico = {
    kmArredondado: kmArredondado,
    haversineKm: haversineKm,
    dentroDeManaus: dentroDeManaus,
    faixaPorKm: faixaPorKm,
    faixaPorId: faixaPorId,
    volumeDoPedido: volumeDoPedido,
    motoPermitida: motoPermitida,
    geocodificar: geocodificar,
    estimarDistancia: estimarDistancia,
    textoDistancia: textoDistancia,
    textoOrigem: textoOrigem,
    rotuloDestino: rotuloDestino,
  };
})(window);
