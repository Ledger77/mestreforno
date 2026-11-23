/*
  Distância e faixas de entrega — Mestre Forno
  Geocodificação: Nominatim/OSM, restrita ao recorte urbano de Manaus.
  Rota: OSRM público. Se a rota falhar, linha reta × fatorLinhaReta.
  Sem chave secreta. Respeita 1 pedido por segundo no Nominatim.
  Resultados de geocodificação são só para o cliente confirmar.
*/
(function (global) {
  "use strict";

  var filaNominatim = Promise.resolve();
  var cacheGeo = {};
  var ULTIMO_NOMINATIM = 0;
  var INTERVALO_MS = 1100;

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

  function pareceManaus(item) {
    var end = item && item.address ? item.address : {};
    var cidade = String(end.city || end.town || end.municipality || "");
    var display = String(item && item.display_name ? item.display_name : "");
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

  function chaveCache(texto) {
    return String(texto || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function esperarNominatim() {
    var espera = INTERVALO_MS - (Date.now() - ULTIMO_NOMINATIM);
    if (espera <= 0) return Promise.resolve();
    return new Promise(function (ok) {
      setTimeout(ok, espera);
    });
  }

  function normalizarResultado(item) {
    var lat = Number(item.lat);
    var lon = Number(item.lon);
    return {
      label: item.display_name,
      lat: lat,
      lon: lon,
      osmId: item.osm_type && item.osm_id ? item.osm_type + "/" + item.osm_id : "",
    };
  }

  function buscarNominatim(query, limitado) {
    var e = cfg();
    if (!e) return Promise.reject(new Error("config"));
    var url = new URL(e.nominatim);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "5");
    url.searchParams.set("countrycodes", "br");
    url.searchParams.set("accept-language", "pt-BR");
    url.searchParams.set("q", query);
    if (limitado) {
      url.searchParams.set(
        "viewbox",
        e.manaus.oeste + "," + e.manaus.norte + "," + e.manaus.leste + "," + e.manaus.sul
      );
      url.searchParams.set("bounded", "1");
    }

    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, 8000);

    ULTIMO_NOMINATIM = Date.now();
    return fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (res) {
        if (!res.ok) throw new Error("nominatim " + res.status);
        return res.json();
      })
      .then(function (lista) {
        return (Array.isArray(lista) ? lista : [])
          .filter(pareceManaus)
          .map(normalizarResultado);
      })
      .finally(function () {
        clearTimeout(timer);
      });
  }

  function geocodificar(query) {
    var chave = chaveCache(query);
    if (!chave) return Promise.resolve([]);
    if (cacheGeo[chave]) return Promise.resolve(cacheGeo[chave]);

    filaNominatim = filaNominatim
      .catch(function () {})
      .then(esperarNominatim)
      .then(function () {
        return buscarNominatim(query, true);
      })
      .then(function (lista) {
        cacheGeo[chave] = lista;
        return lista;
      });

    return filaNominatim;
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

    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, 8000);

    return fetch(path, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (res) {
        if (!res.ok) throw new Error("osrm " + res.status);
        return res.json();
      })
      .then(function (dados) {
        var rota = dados && dados.routes && dados.routes[0];
        if (!rota || typeof rota.distance !== "number") throw new Error("sem rota");
        return rota.distance / 1000;
      })
      .finally(function () {
        clearTimeout(timer);
      });
  }

  function estimarDistancia(dest) {
    var e = cfg();
    var reta = haversineKm(e.origem, dest);
    var fallback = reta * (e.fatorLinhaReta || 1.3);
    return rotaOsrm(dest)
      .then(function (km) {
        return { km: km, kmExibido: kmArredondado(km), fonte: "rota", reta: reta };
      })
      .catch(function () {
        return {
          km: fallback,
          kmExibido: kmArredondado(fallback),
          fonte: "aproximada",
          reta: reta,
        };
      });
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
    textoOrigem: textoOrigem,
  };
})(window);
