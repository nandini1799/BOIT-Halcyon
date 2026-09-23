/* Halcyon — shared SVG chart engine.
 *
 * Deliberately restricted to what Recharts can reproduce 1:1, because Recharts is the
 * production target: cartesian grid, banded/linear axes, grouped bars, straight-segment
 * lines with dot markers, and a legend. No gradients-under-curve, no glow, no blur, no
 * bezier smoothing — anything that would not survive the port is not offered here.
 *
 * Every function returns an SVG string. Colours arrive from the calling direction's
 * token set, so the three mocks share geometry but never share palette.
 */
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* Nice round axis ceiling, so gridlines land on readable numbers. */
  function niceMax(max) {
    if (max <= 0) return 1;
    var mag = Math.pow(10, Math.floor(Math.log10(max)));
    var norm = max / mag;
    var step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    return step * mag;
  }

  function ticks(max, count) {
    var out = [];
    for (var i = 0; i <= count; i++) out.push((max / count) * i);
    return out;
  }

  /* ---------------------------------------------------------------- grouped bars */
  /* opts: width height series labels colors grid axis text font tickFormat legend */
  function groupedBars(opts) {
    var W = opts.width, H = opts.height;
    var padL = opts.padL || 52, padR = opts.padR || 12;
    var padT = opts.padT || 14, padB = opts.padB || 30;
    var iw = W - padL - padR, ih = H - padT - padB;
    var series = opts.series, labels = opts.labels;
    var fmt = opts.tickFormat || function (v) { return Math.round(v); };
    var font = opts.font || 'ui-monospace, monospace';

    var max = 0;
    series.forEach(function (s) { s.values.forEach(function (v) { if (v > max) max = v; }); });
    max = niceMax(max);

    var band = iw / labels.length;
    var inner = band * 0.72;
    var bw = inner / series.length;
    var y = function (v) { return padT + ih - (v / max) * ih; };

    var p = [];

    ticks(max, 4).forEach(function (t) {
      var ty = y(t);
      p.push('<line x1="' + padL + '" y1="' + ty.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + ty.toFixed(1) +
             '" stroke="' + opts.grid + '" stroke-width="1"/>');
      p.push('<text x="' + (padL - 8) + '" y="' + (ty + 3.5).toFixed(1) + '" text-anchor="end" font-size="10" ' +
             'font-family="' + font + '" fill="' + opts.text + '">' + esc(fmt(t)) + '</text>');
    });

    labels.forEach(function (lab, i) {
      var x0 = padL + band * i + (band - inner) / 2;
      series.forEach(function (s, j) {
        var v = s.values[i];
        var bh = Math.max((v / max) * ih, 1);
        p.push('<rect x="' + (x0 + bw * j).toFixed(1) + '" y="' + y(v).toFixed(1) +
               '" width="' + Math.max(bw - 1.5, 1).toFixed(1) + '" height="' + bh.toFixed(1) +
               '" fill="' + opts.colors[j % opts.colors.length] + '"' +
               (opts.barRadius ? ' rx="' + opts.barRadius + '"' : '') + '>' +
               '<title>' + esc(s.label + ' \u00b7 ' + lab + ' \u00b7 ' + fmt(v)) + '</title></rect>');
      });
      p.push('<text x="' + (padL + band * i + band / 2).toFixed(1) + '" y="' + (padT + ih + 15) +
             '" text-anchor="middle" font-size="10" font-family="' + font + '" fill="' + opts.text + '">' +
             esc(lab) + '</text>');
    });

    p.push('<line x1="' + padL + '" y1="' + (padT + ih) + '" x2="' + (W - padR) + '" y2="' + (padT + ih) +
           '" stroke="' + opts.axis + '" stroke-width="1"/>');

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H +
           '" role="img" aria-label="' + esc(opts.alt || 'Bar chart') + '" xmlns="' + NS + '">' +
           p.join('') + '</svg>';
  }

  /* ---------------------------------------------------------------------- lines */
  function lineChart(opts) {
    var W = opts.width, H = opts.height;
    var padL = opts.padL || 52, padR = opts.padR || 12;
    var padT = opts.padT || 14, padB = opts.padB || 30;
    var iw = W - padL - padR, ih = H - padT - padB;
    var series = opts.series, labels = opts.labels;
    var fmt = opts.tickFormat || function (v) { return v; };
    var font = opts.font || 'ui-monospace, monospace';

    var max = 0, min = Infinity;
    series.forEach(function (s) {
      s.values.forEach(function (v) { if (v > max) max = v; if (v < min) min = v; });
    });
    max = niceMax(max);
    min = opts.zeroBased === false ? Math.max(0, min - (max - min) * 0.35) : 0;

    var x = function (i) { return padL + (iw / Math.max(labels.length - 1, 1)) * i; };
    var y = function (v) { return padT + ih - ((v - min) / (max - min)) * ih; };

    var p = [];

    ticks(max - min, 4).forEach(function (t) {
      var val = min + t, ty = y(val);
      p.push('<line x1="' + padL + '" y1="' + ty.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + ty.toFixed(1) +
             '" stroke="' + opts.grid + '" stroke-width="1"/>');
      p.push('<text x="' + (padL - 8) + '" y="' + (ty + 3.5).toFixed(1) + '" text-anchor="end" font-size="10" ' +
             'font-family="' + font + '" fill="' + opts.text + '">' + esc(fmt(val)) + '</text>');
    });

    series.forEach(function (s, j) {
      var col = opts.colors[j % opts.colors.length];
      var d = s.values.map(function (v, i) {
        return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1);
      }).join(' ');
      p.push('<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + (opts.strokeWidth || 1.75) +
             '" stroke-linejoin="round" stroke-linecap="round"/>');
      if (opts.dots !== false) {
        s.values.forEach(function (v, i) {
          p.push('<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="' + (opts.dotR || 2.4) +
                 '" fill="' + (opts.dotFill || col) + '" stroke="' + col + '" stroke-width="1.2">' +
                 '<title>' + esc(s.label + ' \u00b7 ' + labels[i] + ' \u00b7 ' + fmt(v)) + '</title></circle>');
        });
      }
    });

    labels.forEach(function (lab, i) {
      if (labels.length > 8 && i % 2) return;
      p.push('<text x="' + x(i).toFixed(1) + '" y="' + (padT + ih + 15) + '" text-anchor="middle" font-size="10" ' +
             'font-family="' + font + '" fill="' + opts.text + '">' + esc(lab) + '</text>');
    });

    p.push('<line x1="' + padL + '" y1="' + (padT + ih) + '" x2="' + (W - padR) + '" y2="' + (padT + ih) +
           '" stroke="' + opts.axis + '" stroke-width="1"/>');

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H +
           '" role="img" aria-label="' + esc(opts.alt || 'Line chart') + '" xmlns="' + NS + '">' +
           p.join('') + '</svg>';
  }

  /* ------------------------------------------------------------- horizontal bars */
  function hBars(opts) {
    var W = opts.width, H = opts.height;
    var padL = opts.padL || 118, padR = opts.padR || 46;
    var padT = opts.padT || 6, padB = opts.padB || 6;
    var iw = W - padL - padR;
    var rows = opts.rows;
    var font = opts.font || 'ui-monospace, monospace';
    var max = niceMax(Math.max.apply(null, rows.map(function (r) { return r.value; })));
    var rowH = (H - padT - padB) / rows.length;
    var bh = Math.min(rowH * 0.56, 16);
    var fmt = opts.tickFormat || function (v) { return v; };

    var p = [];
    rows.forEach(function (r, i) {
      var cy = padT + rowH * i + rowH / 2;
      var w = Math.max((r.value / max) * iw, 2);
      p.push('<text x="' + (padL - 10) + '" y="' + (cy + 3.5).toFixed(1) + '" text-anchor="end" font-size="11" ' +
             'font-family="' + font + '" fill="' + opts.text + '">' + esc(r.label) + '</text>');
      p.push('<rect x="' + padL + '" y="' + (cy - bh / 2).toFixed(1) + '" width="' + iw + '" height="' + bh.toFixed(1) +
             '" fill="' + opts.track + '"' + (opts.barRadius ? ' rx="' + opts.barRadius + '"' : '') + '/>');
      p.push('<rect x="' + padL + '" y="' + (cy - bh / 2).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + bh.toFixed(1) +
             '" fill="' + (r.color || opts.colors[0]) + '"' + (opts.barRadius ? ' rx="' + opts.barRadius + '"' : '') + '>' +
             '<title>' + esc(r.label + ' \u00b7 ' + fmt(r.value)) + '</title></rect>');
      p.push('<text x="' + (W - padR + 8) + '" y="' + (cy + 3.5).toFixed(1) + '" font-size="11" ' +
             'font-family="' + font + '" fill="' + (opts.valueText || opts.text) + '">' + esc(fmt(r.value)) + '</text>');
    });

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H +
           '" role="img" aria-label="' + esc(opts.alt || 'Horizontal bar chart') + '" xmlns="' + NS + '">' +
           p.join('') + '</svg>';
  }

  /* -------------------------------------------------------------------- sparkline */
  function sparkline(opts) {
    var W = opts.width, H = opts.height, vals = opts.values;
    var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
    var span = (max - min) || 1;
    var x = function (i) { return (W / Math.max(vals.length - 1, 1)) * i; };
    var y = function (v) { return H - 2 - ((v - min) / span) * (H - 4); };
    var d = vals.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
           '" aria-hidden="true" xmlns="' + NS + '">' +
           '<path d="' + d + '" fill="none" stroke="' + opts.color + '" stroke-width="' + (opts.strokeWidth || 1.4) +
           '" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }

  root.HChart = {
    groupedBars: groupedBars,
    lineChart: lineChart,
    hBars: hBars,
    sparkline: sparkline,
    niceMax: niceMax,
    esc: esc
  };
})(window);
