import { embeddedLogic } from "./embed.js";

const clientProgram = `
(function () {
/*__LOGIC__*/
  var boot = JSON.parse(document.getElementById("boot").textContent);
  var state = {
    deliveries: [],
    runs: [],
    window: null,
    selectedDeliveries: new Set(),
    selectedRuns: new Set(),
    busy: false,
    scanned: false,
    tokenReady: !boot.needsToken
  };

  function $(id) { return document.getElementById(id); }

  function setStatus(message, isError) {
    var node = $("status");
    node.textContent = message || "";
    node.className = isError ? "status error" : "status";
    var toast = $("toast");
    if (!toast) return;
    toast.hidden = true;
    toast.textContent = "";
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
    $("from").value = toUtcDateTimeLocal(start);
    $("to").value = toUtcDateTimeLocal(end);
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

  function softWrap(value) {
    return String(value == null ? "" : value).replace(/([/._~-])/g, "$1\u200b");
  }

  function whereOf(delivery) { return deliveryPlace(delivery); }
  function resultOf(delivery) { return deliveryResult(delivery); }

  function readDeliveryQuery() {
    return {
      query: $("delivery-search") ? $("delivery-search").value : "",
      repository: $("delivery-repo") ? $("delivery-repo").value : "",
      event: $("delivery-event") ? $("delivery-event").value : "",
      status: $("delivery-status") ? $("delivery-status").value : ""
    };
  }

  function readRunQuery() {
    return {
      query: $("run-search") ? $("run-search").value : "",
      repository: $("run-repo") ? $("run-repo").value : "",
      event: $("run-event") ? $("run-event").value : "",
      status: $("run-status") ? $("run-status").value : ""
    };
  }

  function visibleDeliveries() {
    return filterDeliveries(state.deliveries, readDeliveryQuery());
  }

  function visibleRuns() {
    return filterRuns(state.runs, readRunQuery());
  }

  function deliveryBulkIds() {
    return idsInFilteredSelection(state.deliveries, visibleDeliveries(), state.selectedDeliveries);
  }

  function runBulkIds() {
    return idsInFilteredSelection(state.runs, visibleRuns(), state.selectedRuns);
  }

  function pruneSelection(selected, visible) {
    var ids = new Set(visible.map(function (item) { return item.id; }));
    selected.forEach(function (id) {
      if (!ids.has(id)) selected.delete(id);
    });
  }

  function fillSelect(id, values, allLabel) {
    var select = $(id);
    if (!select) return;
    var current = select.value;
    while (select.firstChild) select.removeChild(select.firstChild);
    select.appendChild(el("option", { value: "", text: allLabel }));
    values.forEach(function (value) {
      select.appendChild(el("option", { value: value, text: value }));
    });
    select.value = values.indexOf(current) === -1 ? "" : current;
  }

  function refreshDeliveryChoices() {
    var choices = deliveryChoices(state.deliveries);
    fillSelect("delivery-repo", choices.repositories, "All repositories");
    fillSelect("delivery-event", choices.events, "All events");
    fillSelect("delivery-status", choices.statuses, "All statuses");
  }

  function refreshRunChoices() {
    var choices = runChoices(state.runs);
    fillSelect("run-repo", choices.repositories, "All repositories");
    fillSelect("run-event", choices.events, "All events");
    fillSelect("run-status", choices.statuses, "All statuses");
  }

  function emptyRow(colspan, title, detail) {
    var cell = el("td", { colspan: String(colspan), className: "empty" });
    cell.appendChild(el("strong", { text: title }));
    cell.appendChild(document.createTextNode(detail));
    return el("tr", {}, [cell]);
  }

  function syncDeliverySelectAll(visible) {
    var box = $("select-deliveries");
    var selected = 0;
    visible.forEach(function (delivery) {
      if (state.selectedDeliveries.has(delivery.id)) selected += 1;
    });
    box.checked = visible.length > 0 && selected === visible.length;
    box.indeterminate = selected > 0 && selected < visible.length;
  }

  function syncRunSelectAll(visible) {
    var box = $("select-runs");
    var selected = 0;
    visible.forEach(function (run) {
      if (state.selectedRuns.has(run.id)) selected += 1;
    });
    box.checked = visible.length > 0 && selected === visible.length;
    box.indeterminate = selected > 0 && selected < visible.length;
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
    var deliveries = deliveryBulkIds().length;
    var runs = runBulkIds().length;
    var shownDeliveries = visibleDeliveries().length;
    var shownRuns = visibleRuns().length;
    $("redeliver").textContent = deliveries ? "Redeliver " + deliveries : "Redeliver";
    $("cancel").textContent = runs ? "Cancel " + runs : "Cancel";
    $("force-cancel").textContent = runs ? "Force-cancel " + runs : "Force-cancel";
    $("rerun").textContent = runs ? "Re-run " + runs : "Re-run";
    $("redeliver").disabled = state.busy || deliveries === 0;
    $("cancel").disabled = state.busy || runs === 0;
    $("force-cancel").disabled = state.busy || runs === 0;
    $("rerun").disabled = state.busy || runs === 0;
    $("scan-button").disabled = state.busy || !state.tokenReady;
    $("redeliver").title = "Redeliver the checked rows in the filtered list. Hidden rows are not included.";
    $("cancel").title = "Cancel the checked rows in the filtered list. Hidden rows are not included.";
    $("force-cancel").title = "Stops the run even when the runner does not respond. Uses the checked rows in the filtered list. Hidden rows are not included.";
    $("rerun").title = "Re-run the checked rows in the filtered list. Hidden rows are not included.";
    var deliveryNote = $("delivery-filter-note");
    if (deliveryNote) {
      deliveryNote.textContent = "Redeliver uses the " + deliveries + " checked " + (deliveries === 1 ? "row" : "rows") + " in this filtered list"
        + (state.deliveries.length ? " (" + shownDeliveries + " of " + state.deliveries.length + " shown)" : "")
        + ". Rows hidden by the filters are not included.";
    }
    var runNote = $("run-filter-note");
    if (runNote) {
      runNote.textContent = "Cancel, force-cancel, and re-run use the " + runs + " checked " + (runs === 1 ? "row" : "rows") + " in this filtered list"
        + (state.runs.length ? " (" + shownRuns + " of " + state.runs.length + " shown)" : "")
        + ". Rows hidden by the filters are not included.";
    }
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
    var visible = visibleDeliveries();
    var total = state.deliveries.length;
    $("delivery-count").textContent = total ? (visible.length === total ? String(total) : visible.length + " of " + total) : "";
    if (!state.scanned) {
      body.appendChild(emptyRow(5, "No scan yet", "Choose a window and scan to list deliveries that failed."));
      syncDeliverySelectAll(visible);
      return;
    }
    if (!visible.length) {
      body.appendChild(emptyRow(
        5,
        total ? "No matches" : "Nothing in this window",
        total ? "No deliveries match these filters." : "No failed or missing deliveries in this window."
      ));
      syncDeliverySelectAll(visible);
      return;
    }
    visible.forEach(function (delivery) {
      var checked = state.selectedDeliveries.has(delivery.id);
      var box = el("input", { type: "checkbox", "aria-label": "Select delivery " + delivery.id });
      box.checked = checked;
      box.addEventListener("change", function () {
        if (box.checked) state.selectedDeliveries.add(delivery.id);
        else state.selectedDeliveries.delete(delivery.id);
        row.classList.toggle("selected", box.checked);
        updateButtons();
        syncDeliverySelectAll(visibleDeliveries());
      });
      var event = el("td", {}, [
        el("span", { text: softWrap(delivery.event) }),
        delivery.action ? el("span", { className: "sub", text: softWrap(delivery.action) }) : null
      ]);
      var row = el("tr", { className: checked ? "selected" : "" }, [
        el("td", {}, [box]),
        el("td", { className: "mono", text: formatTime(delivery.deliveredAt) }),
        el("td", {}, [
          el("span", { text: whereOf(delivery) }),
          delivery.targetUrl ? el("span", { className: "sub", text: softWrap(delivery.targetUrl) }) : null
        ]),
        event,
        el("td", {}, [el("span", { className: "badge", text: resultOf(delivery) })])
      ]);
      body.appendChild(row);
    });
    syncDeliverySelectAll(visible);
  }

  function renderRuns() {
    var body = $("runs-body");
    body.textContent = "";
    var visible = visibleRuns();
    var total = state.runs.length;
    $("run-count").textContent = total ? (visible.length === total ? String(total) : visible.length + " of " + total) : "";
    if (!state.scanned) {
      body.appendChild(emptyRow(6, "No scan yet", "Queued runs, and in-progress runs that have gone on too long, show up here."));
      syncRunSelectAll(visible);
      return;
    }
    if (!visible.length) {
      body.appendChild(emptyRow(
        6,
        total ? "No matches" : "Nothing in this window",
        total ? "No stuck runs match these filters." : "No stuck workflow runs in this window."
      ));
      syncRunSelectAll(visible);
      return;
    }
    visible.forEach(function (run) {
      var checked = state.selectedRuns.has(run.id);
      var box = el("input", { type: "checkbox", "aria-label": "Select run " + run.id });
      box.checked = checked;
      var row = el("tr", { className: checked ? "selected" : "" });
      box.addEventListener("change", function () {
        if (box.checked) state.selectedRuns.add(run.id);
        else state.selectedRuns.delete(run.id);
        row.classList.toggle("selected", box.checked);
        updateButtons();
        syncRunSelectAll(visibleRuns());
      });
      var pillClass = run.reason === "in_progress" ? "badge run" : "badge wait";
      var started = run.runStartedAt || run.createdAt;
      var link = el("a", { href: run.htmlUrl, target: "_blank", rel: "noreferrer", text: softWrap(run.owner + "/" + run.repo) });
      row.appendChild(el("td", {}, [box]));
      row.appendChild(el("td", { className: "mono", text: formatTime(started) }));
      row.appendChild(el("td", {}, [link, el("span", { className: "sub", text: softWrap(run.headBranch || "") })]));
      row.appendChild(el("td", {}, [el("span", { text: softWrap(run.name) }), run.displayTitle && run.displayTitle !== run.name ? el("span", { className: "sub", text: softWrap(run.displayTitle) }) : null]));
      row.appendChild(el("td", {}, [el("span", { className: pillClass, text: run.status })]));
      row.appendChild(el("td", { className: "mono", text: formatAge(started) }));
      body.appendChild(row);
    });
    syncRunSelectAll(visible);
  }

  function showReport(markdown) {
    $("report").textContent = markdown || "";
  }

  function applyScan(body) {
    state.scanned = true;
    state.deliveries = body.deliveries || [];
    state.runs = body.runs || [];
    state.window = body.window;
    var ids = new Set(state.deliveries.map(function (delivery) { return delivery.id; }));
    var runIds = new Set(state.runs.map(function (run) { return run.id; }));
    state.selectedDeliveries.forEach(function (id) { if (!ids.has(id)) state.selectedDeliveries.delete(id); });
    state.selectedRuns.forEach(function (id) { if (!runIds.has(id)) state.selectedRuns.delete(id); });
    refreshDeliveryChoices();
    refreshRunChoices();
    pruneSelection(state.selectedDeliveries, visibleDeliveries());
    pruneSelection(state.selectedRuns, visibleRuns());
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
    if (!state.tokenReady) {
      setStatus("Enter a GitHub token above. It stays in server memory for this process and is not written to disk.", true);
      return;
    }
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
      var chosen = new Set(deliveryBulkIds());
      return state.deliveries.filter(function (delivery) {
        return chosen.has(delivery.id);
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
    var chosenRuns = new Set(runBulkIds());
    return state.runs.filter(function (run) {
      return chosenRuns.has(run.id);
    }).map(function (run) {
      return { type: type, owner: run.owner, repo: run.repo, runId: run.id };
    });
  }

  async function act(type) {
    var operations = operationsFor(type);
    if (!operations.length) {
      setStatus(type === "redeliver" ? "Select at least one delivery in the filtered list." : "Select at least one workflow run in the filtered list.", true);
      return;
    }
    var dryRun = $("dry-run").checked;
    if (!dryRun) {
      var verb = type === "redeliver" ? "Redeliver" : type === "cancel" ? "Cancel" : type === "force-cancel" ? "Force-cancel" : "Re-run";
      var noun = operations.length === 1 ? "checked row" : "checked rows";
      var accepted = await confirmAction(
        verb + " " + operations.length + " " + noun + " in the filtered list?",
        type === "force-cancel"
          ? "This calls GitHub now and only includes checked rows that are still visible. Force-cancel stops a run even when the runner does not respond."
          : "This calls GitHub now and only includes checked rows that are still visible. The report will record what was sent.",
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

  function onDeliveryFilter() {
    pruneSelection(state.selectedDeliveries, visibleDeliveries());
    renderDeliveries();
    updateButtons();
  }

  function onRunFilter() {
    pruneSelection(state.selectedRuns, visibleRuns());
    renderRuns();
    updateButtons();
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
  ["delivery-search", "delivery-repo", "delivery-event", "delivery-status"].forEach(function (id) {
    var node = $(id);
    if (!node) return;
    node.addEventListener("input", onDeliveryFilter);
    node.addEventListener("change", onDeliveryFilter);
  });
  ["run-search", "run-repo", "run-event", "run-status"].forEach(function (id) {
    var node = $(id);
    if (!node) return;
    node.addEventListener("input", onRunFilter);
    node.addEventListener("change", onRunFilter);
  });
  $("select-deliveries").addEventListener("change", function () {
    var visible = visibleDeliveries();
    visible.forEach(function (delivery) {
      if ($("select-deliveries").checked) state.selectedDeliveries.add(delivery.id);
      else state.selectedDeliveries.delete(delivery.id);
    });
    renderDeliveries();
    updateButtons();
  });
  $("select-runs").addEventListener("change", function () {
    var visible = visibleRuns();
    visible.forEach(function (run) {
      if ($("select-runs").checked) state.selectedRuns.add(run.id);
      else state.selectedRuns.delete(run.id);
    });
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
  var tokenForm = $("token-form");
  if (tokenForm) {
    tokenForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      var input = $("token");
      var status = $("token-status");
      status.className = "status";
      status.textContent = "Saving the token in server memory…";
      try {
        var response = await fetch("/api/token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: input.value })
        });
        var body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not save the token.");
        input.value = "";
        state.tokenReady = true;
        tokenForm.hidden = true;
        setStatus("Token saved in server memory for this process. It was not written to disk.");
        updateButtons();
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : "Could not save the token.";
        status.className = "status error";
      }
    });
  }

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

export const clientSource = clientProgram.replace("/*__LOGIC__*/", embeddedLogic);
