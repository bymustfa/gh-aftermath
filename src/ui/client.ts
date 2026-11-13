export const clientSource = `
(function () {
  var boot = JSON.parse(document.getElementById("boot").textContent);
  var state = { deliveries: [], runs: [], window: null, selectedDeliveries: new Set(), selectedRuns: new Set(), busy: false };

  function $(id) { return document.getElementById(id); }

  function setStatus(message, isError) {
    var node = $("status");
    node.textContent = message || "";
    node.className = isError ? "status error" : "status";
    var toast = $("toast");
    if (!toast) return;
    var show = Boolean(message) && (isError || /planned|Sent|Cleared/.test(message));
    toast.hidden = !show;
    toast.textContent = message || "";
    toast.className = isError ? "toast error" : "toast";
  }

  function clearStaleError() {
    var node = $("status");
    if (node && node.className.indexOf("error") !== -1) setStatus("");
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var toggle = $("theme-toggle");
    if (!toggle) return;
    var dark = theme === "dark";
    toggle.setAttribute("aria-pressed", dark ? "true" : "false");
    toggle.textContent = dark ? "Light" : "Dark";
  }

  function markPreset(id) {
    ["preset-1h", "preset-6h", "preset-24h", "preset-incident"].forEach(function (key) {
      var node = $(key);
      if (node) node.setAttribute("aria-pressed", key === id ? "true" : "false");
    });
  }

  function applyHours(hours, id) {
    var end = new Date();
    var start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    $("from").value = utcInput(start);
    $("to").value = utcInput(end);
    markPreset(id);
    clearStaleError();
    drawTimeline();
  }

  function confirmAction(title, detail, acceptLabel) {
    return new Promise(function (resolve) {
      var dialog = $("confirm");
      $("confirm-title").textContent = title;
      $("confirm-detail").textContent = detail;
      $("confirm-accept").textContent = acceptLabel;
      function onClose() {
        dialog.removeEventListener("close", onClose);
        resolve(dialog.returnValue === "ok");
      }
      dialog.addEventListener("close", onClose);
      dialog.showModal();
    });
  }

  function pad(value) { return String(value).padStart(2, "0"); }

  function utcInput(date) {
    return date.getUTCFullYear() + "-" + pad(date.getUTCMonth() + 1) + "-" + pad(date.getUTCDate()) + "T" + pad(date.getUTCHours()) + ":" + pad(date.getUTCMinutes());
  }

  function parseInput(value) {
    if (!value) return NaN;
    if (value.length === 16) return Date.parse(value + ":00Z");
    return Date.parse(value);
  }

  function formatTime(iso) {
    if (!iso) return "undated";
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    var formatted = new Intl.DateTimeFormat("en-GB", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC"
    }).format(date);
    return formatted + " UTC";
  }

  function formatAge(iso) {
    if (!iso) return "";
    var minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    if (minutes < 60) return minutes + "m";
    var hours = Math.round(minutes / 60);
    if (hours < 48) return hours + "h";
    return Math.round(hours / 24) + "d";
  }

  function el(tag, props, children) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (key) {
      if (key === "className") node.className = props[key];
      else if (key === "text") node.textContent = props[key];
      else if (key.slice(0, 2) === "on" && typeof props[key] === "function") node.addEventListener(key.slice(2).toLowerCase(), props[key]);
      else if (props[key] !== undefined && props[key] !== null) node.setAttribute(key, String(props[key]));
    });
    (children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  }

  function whereOf(delivery) {
    if (delivery.scope === "repo") return delivery.owner + "/" + delivery.repo;
    if (delivery.scope === "org") return delivery.org + " org hook";
    return "GitHub App";
  }

  function resultOf(delivery) {
    if (delivery.reason === "missing_response") return "no response";
    if (delivery.reason === "http_error") return String(delivery.statusCode);
    return delivery.status || delivery.reason;
  }

  function updateStamp() {
    var dry = $("dry-run").checked;
    var stamp = $("stamp");
    stamp.textContent = dry ? "Dry run" : "Live";
    stamp.className = dry ? "stamp" : "stamp live";
    var hint = $("dry-hint");
    if (hint) {
      hint.textContent = dry
        ? "Requests are listed in the report and are not sent."
        : "Actions will call GitHub. You will be asked to confirm each one.";
    }
  }

  function updateButtons() {
    var deliveries = state.selectedDeliveries.size;
    var runs = state.selectedRuns.size;
    $("redeliver").textContent = deliveries ? "Redeliver " + deliveries : "Redeliver";
    $("cancel").textContent = runs ? "Cancel " + runs : "Cancel";
    $("force-cancel").textContent = runs ? "Force-cancel " + runs : "Force-cancel";
    $("rerun").textContent = runs ? "Re-run " + runs : "Re-run";
    $("redeliver").disabled = state.busy || deliveries === 0;
    $("cancel").disabled = state.busy || runs === 0;
    $("force-cancel").disabled = state.busy || runs === 0;
    $("rerun").disabled = state.busy || runs === 0;
    $("scan-button").disabled = state.busy;
  }

  function drawTimeline() {
    var svg = $("timeline");
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var from = parseInput($("from").value);
    var to = parseInput($("to").value);
    var width = 1000;
    var height = 78;
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
      $("window-start").textContent = "";
      $("window-end").textContent = "";
      return;
    }
    $("window-start").textContent = formatTime(new Date(from).toISOString());
    $("window-end").textContent = formatTime(new Date(to).toISOString());
    var ns = "http://www.w3.org/2000/svg";
    function add(tag, attrs) {
      var node = document.createElementNS(ns, tag);
      Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
      svg.appendChild(node);
      return node;
    }
    var axisStart = 92;
    var axisEnd = width - 8;
    add("text", { x: "0", y: "16", class: "lane" }).textContent = "Webhooks";
    add("text", { x: "0", y: "48", class: "lane" }).textContent = "Actions";
    add("line", { x1: String(axisStart), y1: "12", x2: String(axisEnd), y2: "12", class: "axis" });
    add("line", { x1: String(axisStart), y1: "44", x2: String(axisEnd), y2: "44", class: "axis" });
    function xOnAxis(iso) {
      var time = Date.parse(iso);
      if (!Number.isFinite(time)) return null;
      var ratio = (time - from) / (to - from);
      if (ratio < 0 || ratio > 1) return null;
      return (axisStart + ratio * (axisEnd - axisStart)).toFixed(1);
    }
    state.deliveries.forEach(function (delivery) {
      if (!delivery.deliveredAt) return;
      var x = xOnAxis(delivery.deliveredAt);
      if (!x) return;
      var dot = add("circle", { cx: x, cy: "12", r: "4.5", class: "tick-delivery" });
      var title = document.createElementNS(ns, "title");
      title.textContent = whereOf(delivery) + " " + delivery.event + " " + resultOf(delivery);
      dot.appendChild(title);
    });
    state.runs.forEach(function (run) {
      var x = xOnAxis(run.runStartedAt || run.createdAt);
      if (!x) return;
      var dot = add("circle", { cx: x, cy: "44", r: "4.5", class: "tick-run" });
      var title = document.createElementNS(ns, "title");
      title.textContent = run.owner + "/" + run.repo + " " + run.name + " " + run.status;
      dot.appendChild(title);
    });
  }

  function renderWarnings(warnings) {
    var list = $("warnings");
    list.textContent = "";
    (warnings || []).forEach(function (warning) {
      list.appendChild(el("li", { text: warning }));
    });
  }

  function renderDeliveries() {
    var body = $("deliveries-body");
    body.textContent = "";
    $("delivery-count").textContent = state.deliveries.length ? String(state.deliveries.length) : "";
    if (!state.deliveries.length) {
      body.appendChild(el("tr", {}, [el("td", { colspan: "5", className: "empty", text: "No failed or missing deliveries in this window." })]));
      return;
    }
    state.deliveries.forEach(function (delivery) {
      var checked = state.selectedDeliveries.has(delivery.id);
      var box = el("input", { type: "checkbox", "aria-label": "Select delivery " + delivery.id });
      box.checked = checked;
      box.addEventListener("change", function () {
        if (box.checked) state.selectedDeliveries.add(delivery.id);
        else state.selectedDeliveries.delete(delivery.id);
        row.classList.toggle("selected", box.checked);
        updateButtons();
      });
      var event = el("td", {}, [
        el("span", { text: delivery.event }),
        delivery.action ? el("span", { className: "sub", text: delivery.action }) : null
      ]);
      var row = el("tr", { className: checked ? "selected" : "" }, [
        el("td", {}, [box]),
        el("td", { className: "mono", text: formatTime(delivery.deliveredAt) }),
        el("td", {}, [
          el("span", { text: whereOf(delivery) }),
          delivery.targetUrl ? el("span", { className: "sub", text: delivery.targetUrl }) : null
        ]),
        event,
        el("td", {}, [el("span", { className: "badge", text: resultOf(delivery) })])
      ]);
      body.appendChild(row);
    });
  }

  function renderRuns() {
    var body = $("runs-body");
    body.textContent = "";
    $("run-count").textContent = state.runs.length ? String(state.runs.length) : "";
    if (!state.runs.length) {
      body.appendChild(el("tr", {}, [el("td", { colspan: "6", className: "empty", text: "No stuck workflow runs in this window." })]));
      return;
    }
    state.runs.forEach(function (run) {
      var checked = state.selectedRuns.has(run.id);
      var box = el("input", { type: "checkbox", "aria-label": "Select run " + run.id });
      box.checked = checked;
      var row = el("tr", { className: checked ? "selected" : "" });
      box.addEventListener("change", function () {
        if (box.checked) state.selectedRuns.add(run.id);
        else state.selectedRuns.delete(run.id);
        row.classList.toggle("selected", box.checked);
        updateButtons();
      });
      var pillClass = run.reason === "in_progress" ? "badge run" : "badge wait";
      var started = run.runStartedAt || run.createdAt;
      var link = el("a", { href: run.htmlUrl, target: "_blank", rel: "noreferrer", text: run.owner + "/" + run.repo });
      row.appendChild(el("td", {}, [box]));
      row.appendChild(el("td", { className: "mono", text: formatTime(started) }));
      row.appendChild(el("td", {}, [link, el("span", { className: "sub", text: run.headBranch || "" })]));
      row.appendChild(el("td", {}, [el("span", { text: run.name }), run.displayTitle && run.displayTitle !== run.name ? el("span", { className: "sub", text: run.displayTitle }) : null]));
      row.appendChild(el("td", {}, [el("span", { className: pillClass, text: run.status })]));
      row.appendChild(el("td", { className: "mono", text: formatAge(started) }));
      body.appendChild(row);
    });
  }

  function showReport(markdown) {
    $("report").textContent = markdown || "";
  }

  function applyScan(body) {
    state.deliveries = body.deliveries || [];
    state.runs = body.runs || [];
    state.window = body.window;
    var ids = new Set(state.deliveries.map(function (delivery) { return delivery.id; }));
    var runIds = new Set(state.runs.map(function (run) { return run.id; }));
    state.selectedDeliveries.forEach(function (id) { if (!ids.has(id)) state.selectedDeliveries.delete(id); });
    state.selectedRuns.forEach(function (id) { if (!runIds.has(id)) state.selectedRuns.delete(id); });
    renderDeliveries();
    renderRuns();
    renderWarnings(body.warnings);
    drawTimeline();
    if (body.markdown) showReport(body.markdown);
    if (body.rateLimit) {
      $("rate-limit").textContent = body.rateLimit.remaining.toLocaleString("en-US") + " / " + body.rateLimit.limit.toLocaleString("en-US") + " requests left";
    }
    var counts = body.counts || {};
    setStatus("Found " + (counts.failedDeliveries || 0) + " failed or missing deliveries and " + (counts.stuckRuns || 0) + " stuck runs.");
    updateButtons();
  }

  async function scan(event) {
    if (event) event.preventDefault();
    clearStaleError();
    state.busy = true;
    updateButtons();
    $("scan-button").textContent = "Scanning…";
    setStatus("Scanning " + $("org").value.trim() + "…");
    try {
      var response = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          org: $("org").value.trim(),
          from: $("from").value,
          to: $("to").value,
          queuedMinutes: Number($("queued-minutes").value),
          inProgressMinutes: Number($("progress-minutes").value),
          includeApp: $("include-app").checked
        })
      });
      var body = await response.json();
      if (!response.ok) throw new Error(body.error || "Scan failed");
      applyScan(body);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Scan failed", true);
    } finally {
      state.busy = false;
      $("scan-button").textContent = "Scan organization";
      updateButtons();
    }
  }

  function operationsFor(type) {
    if (type === "redeliver") {
      return state.deliveries.filter(function (delivery) {
        return state.selectedDeliveries.has(delivery.id);
      }).map(function (delivery) {
        return {
          type: "redeliver",
          scope: delivery.scope,
          owner: delivery.owner,
          repo: delivery.repo,
          org: delivery.org,
          hookId: delivery.hookId,
          deliveryId: delivery.id
        };
      });
    }
    return state.runs.filter(function (run) {
      return state.selectedRuns.has(run.id);
    }).map(function (run) {
      return { type: type, owner: run.owner, repo: run.repo, runId: run.id };
    });
  }

  async function act(type) {
    var operations = operationsFor(type);
    if (!operations.length) {
      setStatus(type === "redeliver" ? "Select at least one delivery." : "Select at least one workflow run.", true);
      return;
    }
    var dryRun = $("dry-run").checked;
    if (!dryRun) {
      var verb = type === "redeliver" ? "Redeliver" : type === "cancel" ? "Cancel" : type === "force-cancel" ? "Force-cancel" : "Re-run";
      var accepted = await confirmAction(
        verb + " " + operations.length + (operations.length === 1 ? " item?" : " items?"),
        type === "force-cancel"
          ? "This calls GitHub now. Force-cancel stops a run even when the runner does not respond."
          : "This calls GitHub now. The report will record what was sent.",
        verb
      );
      if (!accepted) return;
    }
    state.busy = true;
    updateButtons();
    setStatus(dryRun ? "Planning " + operations.length + " action" + (operations.length === 1 ? "" : "s") + "…" : "Sending " + operations.length + " action" + (operations.length === 1 ? "" : "s") + "…");
    try {
      var response = await fetch("/api/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dryRun: dryRun, operations: operations })
      });
      var body = await response.json();
      if (!response.ok) throw new Error(body.error || "Action failed");
      if (body.markdown) showReport(body.markdown);
      var summary = body.summary || {};
      if (dryRun) {
        var plannedCount = typeof summary.planned === "number" ? summary.planned : operations.length;
        var plannedMessage = "Dry run planned " + plannedCount + " request" + (plannedCount === 1 ? "" : "s") + ". Nothing was sent to GitHub.";
        if (body.conflicts && body.conflicts.length) plannedMessage += " " + body.conflicts.join(" ");
        setStatus(plannedMessage);
      } else {
        setStatus("Sent " + (summary.succeeded || 0) + " action" + ((summary.succeeded || 0) === 1 ? "" : "s") + (summary.failed ? ", " + summary.failed + " failed" : "") + ".");
        await scan();
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Action failed", true);
    } finally {
      state.busy = false;
      updateButtons();
    }
  }

  $("controls").addEventListener("submit", scan);
  $("controls").addEventListener("input", clearStaleError);
  $("controls").addEventListener("change", clearStaleError);
  $("dry-run").addEventListener("change", async function () {
    if (!$("dry-run").checked) {
      var accepted = await confirmAction(
        "Turn dry-run off?",
        "Redeliver, cancel, force-cancel, and re-run will call GitHub. You still confirm each batch.",
        "Turn dry-run off"
      );
      if (!accepted) $("dry-run").checked = true;
    }
    updateStamp();
  });
  $("from").addEventListener("change", function () { markPreset(""); drawTimeline(); });
  $("to").addEventListener("change", function () { markPreset(""); drawTimeline(); });
  $("preset-incident").addEventListener("click", function () {
    $("from").value = boot.incidentFrom;
    $("to").value = boot.incidentTo;
    markPreset("preset-incident");
    clearStaleError();
    drawTimeline();
  });
  $("preset-1h").addEventListener("click", function () { applyHours(1, "preset-1h"); });
  $("preset-6h").addEventListener("click", function () { applyHours(6, "preset-6h"); });
  $("preset-24h").addEventListener("click", function () { applyHours(24, "preset-24h"); });
  $("theme-toggle").addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try { localStorage.setItem("gh-aftermath-theme", next); } catch (error) {}
    applyTheme(next);
  });
  $("select-deliveries").addEventListener("change", function () {
    state.selectedDeliveries = new Set($("select-deliveries").checked ? state.deliveries.map(function (delivery) { return delivery.id; }) : []);
    renderDeliveries();
    updateButtons();
  });
  $("select-runs").addEventListener("change", function () {
    state.selectedRuns = new Set($("select-runs").checked ? state.runs.map(function (run) { return run.id; }) : []);
    renderRuns();
    updateButtons();
  });
  $("redeliver").addEventListener("click", function () { act("redeliver"); });
  $("cancel").addEventListener("click", function () { act("cancel"); });
  $("force-cancel").addEventListener("click", function () { act("force-cancel"); });
  $("rerun").addEventListener("click", function () { act("rerun"); });
  $("clear-report").addEventListener("click", async function () {
    var response = await fetch("/api/report/clear", { method: "POST" });
    var body = await response.json();
    showReport(body.markdown || "");
    setStatus("Cleared the action log.");
  });

  applyTheme(document.documentElement.getAttribute("data-theme") || "light");
  updateStamp();
  updateButtons();
  drawTimeline();
  fetch("/api/meta").then(function (response) { return response.json(); }).then(function (body) {
    if (body.rateLimit) {
      $("rate-limit").textContent = body.rateLimit.remaining.toLocaleString("en-US") + " / " + body.rateLimit.limit.toLocaleString("en-US") + " requests left";
    }
  }).catch(function () {});
})();
`;
