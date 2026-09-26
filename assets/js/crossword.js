/**
 * Grow on the Vine — reusable crossword engine
 * Each clip page supplies its own crossword.json (same folder as the clip).
 * Pattern: clips/<slug>/crossword.json + mountCrossword(container, jsonUrl)
 */
(function (global) {
  "use strict";

  function buildSolution(data) {
    var rows = data.rows;
    var cols = data.cols;
    var grid = [];
    var i, j;
    for (i = 0; i < rows; i++) {
      grid[i] = [];
      for (j = 0; j < cols; j++) grid[i][j] = null;
    }
    data.words.forEach(function (w) {
      var answer = String(w.answer).toUpperCase();
      for (var k = 0; k < answer.length; k++) {
        var r = w.dir === "across" ? w.row : w.row + k;
        var c = w.dir === "across" ? w.col + k : w.col;
        if (grid[r][c] && grid[r][c] !== answer[k]) {
          throw new Error("Letter conflict at " + r + "," + c + " for " + w.answer);
        }
        grid[r][c] = answer[k];
      }
    });
    return grid;
  }

  function numberClues(data, solution) {
    var starts = {};
    data.words.forEach(function (w) {
      var key = w.row + "," + w.col;
      if (!starts[key]) starts[key] = [];
      starts[key].push(w);
    });
    var numbers = {};
    var n = 1;
    var r, c, key;
    for (r = 0; r < data.rows; r++) {
      for (c = 0; c < data.cols; c++) {
        key = r + "," + c;
        if (starts[key]) {
          numbers[key] = n++;
          starts[key].forEach(function (w) {
            w.number = numbers[key];
          });
        }
      }
    }
    return numbers;
  }

  function cellKey(r, c) {
    return r + "-" + c;
  }

  function mountCrossword(root, data) {
    if (!root || !data) return;

    var solution = buildSolution(data);
    var numbers = numberClues(data, solution);
    var inputs = {};
    var activeDir = "across";
    var activeWord = data.words[0];

    root.innerHTML = "";
    root.classList.add("crossword-root");

    var wrap = document.createElement("div");
    wrap.className = "crossword-wrap";
    var gridEl = document.createElement("div");
    gridEl.className = "crossword-grid";
    gridEl.style.gridTemplateColumns = "repeat(" + data.cols + ", minmax(2.35rem, 2.65rem))";
    gridEl.setAttribute("role", "grid");
    gridEl.setAttribute("aria-label", data.title || "Crossword");

    var r, c;
    for (r = 0; r < data.rows; r++) {
      for (c = 0; c < data.cols; c++) {
        (function (r, c) {
          var cell = document.createElement("div");
          cell.className = "crossword-cell";
          cell.setAttribute("role", "gridcell");
          if (!solution[r][c]) {
            cell.classList.add("block");
            gridEl.appendChild(cell);
            return;
          }
          var num = numbers[r + "," + c];
          if (num) {
            var numEl = document.createElement("span");
            numEl.className = "num";
            numEl.textContent = String(num);
            cell.appendChild(numEl);
          }
          var input = document.createElement("input");
          input.type = "text";
          input.maxLength = 1;
          input.autocomplete = "off";
          input.autocapitalize = "characters";
          input.spellcheck = false;
          input.setAttribute("aria-label", "Row " + (r + 1) + " column " + (c + 1));
          input.dataset.row = String(r);
          input.dataset.col = String(c);
          input.addEventListener("input", onInput);
          input.addEventListener("keydown", onKey);
          input.addEventListener("focus", onFocus);
          cell.appendChild(input);
          inputs[cellKey(r, c)] = input;
          gridEl.appendChild(cell);
        })(r, c);
      }
    }
    wrap.appendChild(gridEl);
    root.appendChild(wrap);

    var controls = document.createElement("div");
    controls.className = "crossword-controls";
    controls.innerHTML =
      '<button type="button" class="btn" data-action="check">Check</button>' +
      '<button type="button" class="btn btn-ghost" data-action="reveal">Reveal</button>' +
      '<button type="button" class="btn btn-ghost" data-action="reset">Reset</button>';
    root.appendChild(controls);

    var status = document.createElement("p");
    status.className = "crossword-status";
    status.setAttribute("aria-live", "polite");
    root.appendChild(status);

    var clues = document.createElement("div");
    clues.className = "crossword-clues";
    var across = data.words.filter(function (w) { return w.dir === "across"; })
      .sort(function (a, b) { return a.number - b.number; });
    var down = data.words.filter(function (w) { return w.dir === "down"; })
      .sort(function (a, b) { return a.number - b.number; });

    function renderClueList(title, list, dir) {
      var box = document.createElement("div");
      box.className = "clue-list";
      var h = document.createElement("h3");
      h.textContent = title;
      box.appendChild(h);
      var ol = document.createElement("ol");
      list.forEach(function (w) {
        var li = document.createElement("li");
        li.value = w.number;
        li.dataset.wordId = w.id;
        li.innerHTML = "<strong>" + w.number + ".</strong> " + escapeHtml(w.clue);
        li.addEventListener("click", function () {
          activeWord = w;
          activeDir = w.dir;
          var inp = inputs[cellKey(w.row, w.col)];
          if (inp) inp.focus();
          highlightClues();
        });
        ol.appendChild(li);
      });
      box.appendChild(ol);
      return box;
    }
    clues.appendChild(renderClueList("Across", across, "across"));
    clues.appendChild(renderClueList("Down", down, "down"));
    root.appendChild(clues);

    controls.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action]");
      if (!btn) return;
      var action = btn.getAttribute("data-action");
      if (action === "check") check();
      if (action === "reveal") reveal();
      if (action === "reset") reset();
    });

    function escapeHtml(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function wordAt(r, c, dir) {
      var found = null;
      data.words.forEach(function (w) {
        if (w.dir !== dir) return;
        for (var k = 0; k < w.answer.length; k++) {
          var rr = w.dir === "across" ? w.row : w.row + k;
          var cc = w.dir === "across" ? w.col + k : w.col;
          if (rr === r && cc === c) found = w;
        }
      });
      return found;
    }

    function highlightClues() {
      root.querySelectorAll(".clue-list li").forEach(function (li) {
        li.classList.toggle("active", activeWord && li.dataset.wordId === activeWord.id);
      });
    }

    function onFocus(e) {
      var r = +e.target.dataset.row;
      var c = +e.target.dataset.col;
      var w = wordAt(r, c, activeDir) || wordAt(r, c, activeDir === "across" ? "down" : "across");
      if (w) {
        activeWord = w;
        activeDir = w.dir;
      }
      highlightClues();
    }

    function advance(r, c, dir, delta) {
      var nr = r;
      var nc = c;
      var steps = 0;
      while (steps < 30) {
        if (dir === "across") nc += delta;
        else nr += delta;
        steps++;
        if (nr < 0 || nc < 0 || nr >= data.rows || nc >= data.cols) return null;
        if (solution[nr][nc]) return inputs[cellKey(nr, nc)] || null;
      }
      return null;
    }

    function onInput(e) {
      var v = e.target.value.replace(/[^a-zA-Z]/g, "").slice(-1).toUpperCase();
      e.target.value = v;
      e.target.classList.remove("correct", "wrong", "revealed");
      status.textContent = "";
      status.classList.remove("success");
      if (v) {
        var r = +e.target.dataset.row;
        var c = +e.target.dataset.col;
        var next = advance(r, c, activeDir, 1);
        if (next) next.focus();
      }
    }

    function onKey(e) {
      var r = +e.target.dataset.row;
      var c = +e.target.dataset.col;
      if (e.key === "Backspace" && !e.target.value) {
        var prev = advance(r, c, activeDir, -1);
        if (prev) {
          prev.focus();
          prev.value = "";
          prev.classList.remove("correct", "wrong", "revealed");
        }
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        activeDir = "across";
        var right = advance(r, c, "across", 1);
        if (right) right.focus();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        activeDir = "across";
        var left = advance(r, c, "across", -1);
        if (left) left.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        activeDir = "down";
        var down = advance(r, c, "down", 1);
        if (down) down.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeDir = "down";
        var up = advance(r, c, "down", -1);
        if (up) up.focus();
      } else if (e.key === " ") {
        e.preventDefault();
        activeDir = activeDir === "across" ? "down" : "across";
        var w = wordAt(r, c, activeDir);
        if (w) activeWord = w;
        highlightClues();
      }
    }

    function check() {
      var allFilled = true;
      var allCorrect = true;
      Object.keys(inputs).forEach(function (key) {
        var input = inputs[key];
        var r = +input.dataset.row;
        var c = +input.dataset.col;
        var expected = solution[r][c];
        var val = (input.value || "").toUpperCase();
        input.classList.remove("correct", "wrong", "revealed");
        if (!val) {
          allFilled = false;
          allCorrect = false;
          return;
        }
        if (val === expected) {
          input.classList.add("correct");
        } else {
          input.classList.add("wrong");
          allCorrect = false;
        }
      });
      if (allCorrect && allFilled) {
        status.textContent = "Well done — love is the more excellent way.";
        status.classList.add("success");
      } else if (!allFilled) {
        status.textContent = "Keep going — some squares are still empty.";
        status.classList.remove("success");
      } else {
        status.textContent = "Some letters need another look.";
        status.classList.remove("success");
      }
    }

    function reveal() {
      Object.keys(inputs).forEach(function (key) {
        var input = inputs[key];
        var r = +input.dataset.row;
        var c = +input.dataset.col;
        input.value = solution[r][c];
        input.classList.remove("wrong", "correct");
        input.classList.add("revealed");
      });
      status.textContent = "Revealed. Try again anytime with Reset.";
      status.classList.remove("success");
    }

    function reset() {
      Object.keys(inputs).forEach(function (key) {
        var input = inputs[key];
        input.value = "";
        input.classList.remove("correct", "wrong", "revealed");
      });
      status.textContent = "";
      status.classList.remove("success");
    }
  }

  function initFromScript() {
    var nodes = document.querySelectorAll("[data-crossword]");
    nodes.forEach(function (node) {
      var url = node.getAttribute("data-crossword");
      if (!url) return;
      fetch(url)
        .then(function (res) {
          if (!res.ok) throw new Error("Could not load crossword");
          return res.json();
        })
        .then(function (data) {
          mountCrossword(node, data);
        })
        .catch(function (err) {
          node.innerHTML = "<p class=\"note\">Crossword could not be loaded.</p>";
          console.error(err);
        });
    });
  }

  global.mountCrossword = mountCrossword;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFromScript);
  } else {
    initFromScript();
  }
})(window);
