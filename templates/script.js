(function () {
  "use strict";

  var body = document.body;

  // Hindari flash transisi tema
  body.classList.add("no-transition");

  /* -------------------------------------------------------
     Utilities
  ------------------------------------------------------- */
  function debounce(fn, delay) {
    var timer;
    return function () {
      var context = this,
        args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  }

  /* -------------------------------------------------------
     Date modified / current year
  ------------------------------------------------------- */
  var dateEl = document.getElementById("date_modified");
  if (dateEl) {
    var months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    var now = new Date();
    dateEl.textContent =
      ("0" + now.getDate()).slice(-2) +
      " " +
      months[now.getMonth()] +
      " " +
      now.getFullYear();
  }
  var yearSpan = document.getElementById("current-year");
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  /* =========================================================
     THEME
  ========================================================= */
  function initTheme() {
    var saved = localStorage.getItem("manpage-theme");
    if (saved === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
    // Aktifkan transisi setelah tema diterapkan
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        body.classList.remove("no-transition");
      });
    });
  }

  function toggleTheme() {
    var html = document.documentElement;
    if (html.classList.contains("light")) {
      html.classList.remove("light");
      html.setAttribute("data-theme", "dark");
      localStorage.setItem("manpage-theme", "dark");
    } else {
      html.classList.add("light");
      html.setAttribute("data-theme", "light");
      localStorage.setItem("manpage-theme", "light");
    }
  }

  initTheme();

  /* =========================================================
     SIDEBAR TOGGLE
  ========================================================= */
  var sidebar = document.getElementById("sidebar");
  var sidebarToggle = document.getElementById("sidebar-toggle");
  if (sidebar && sidebarToggle) {
    sidebarToggle.addEventListener("click", function () {
      sidebar.classList.toggle("open");
    });
    // Tutup sidebar jika klik di luar (opsional)
    document.addEventListener("click", function (e) {
      if (
        !sidebar.contains(e.target) &&
        e.target !== sidebarToggle &&
        !sidebarToggle.contains(e.target)
      ) {
        sidebar.classList.remove("open");
      }
    });
  }

  /* =========================================================
     TABLE OF CONTENTS (Auto‑generate dari h2,h3)
  ========================================================= */
  function buildTOC() {
    var tocList = document.getElementById("toc-list");
    var content = document.getElementById("content");
    if (!tocList || !content) return;

    var headings = content.querySelectorAll("h2, h3");
    if (headings.length === 0) {
      document.getElementById("toc-toggle").style.display = "none";
      return;
    }

    var items = [];
    headings.forEach(function (h, i) {
      // Buat id jika belum ada
      if (!h.id) {
        h.id = "section-" + i;
      }
      var level = h.tagName === "H2" ? 0 : 1; // 0 = top, 1 = sub
      items.push({ level: level, text: h.textContent, id: h.id });
    });

    // Buat nested list sederhana (indentasi dengan margin)
    var html = "";
    var stack = [];
    items.forEach(function (item) {
      if (item.level === 0) {
        html +=
          '<li><a href="#' +
          item.id +
          '">' +
          escapeHtml(item.text) +
          "</a></li>";
      } else {
        // Masukkan dalam <ul> jika belum ada sublist
        if (!html.endsWith("</ul>")) {
          html += "<ul>";
        }
        html +=
          '<li style="padding-left:1.5em;"><a href="#' +
          item.id +
          '">' +
          escapeHtml(item.text) +
          "</a></li>";
      }
    });
    // Tutup sublist terakhir
    if (html.indexOf("<ul>") !== -1 && !html.endsWith("</ul>")) {
      html += "</ul>";
    }
    tocList.innerHTML = html;

    // Event listener untuk smooth scroll & active class
    var links = tocList.querySelectorAll("a");
    links.forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        var target = document.getElementById(
          link.getAttribute("href").substring(1),
        );
        if (target) {
          target.scrollIntoView({ behavior: "smooth" });
          // Update active
          links.forEach((l) => l.classList.remove("active"));
          link.classList.add("active");
        }
        // Tutup TOC jika mobile? opsional
      });
    });

    // Toggle TOC
    var tocToggle = document.getElementById("toc-toggle");
    var manToc = document.getElementById("man-toc");
    if (tocToggle && manToc) {
      tocToggle.addEventListener("click", function () {
        var visible = manToc.classList.toggle("visible");
        tocToggle.setAttribute("aria-expanded", visible);
      });
    }

    // Highligt active TOC on scroll
    var tocAnchors = Array.from(links).map((l) =>
      document.getElementById(l.getAttribute("href").substring(1)),
    );
    window.addEventListener(
      "scroll",
      debounce(function () {
        var scrollPos = window.scrollY + 100;
        var current = null;
        for (var i = tocAnchors.length - 1; i >= 0; i--) {
          if (tocAnchors[i] && tocAnchors[i].offsetTop <= scrollPos) {
            current = tocAnchors[i].id;
            break;
          }
        }
        links.forEach(function (link) {
          link.classList.toggle(
            "active",
            link.getAttribute("href") === "#" + current,
          );
        });
      }, 100),
    );
  }

  function escapeHtml(text) {
    var map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, function (m) {
      return map[m];
    });
  }

  buildTOC();

  /* =========================================================
     CLIENT‑SIDE SEARCH (dengan highlight & navigasi)
  ========================================================= */
  var searchInput = document.getElementById("search-input");
  var searchClear = document.getElementById("search-clear");
  var searchResults = document.getElementById("search-results");
  var contentArea = document.getElementById("content");

  var currentHighlightIndex = -1;
  var allHighlights = [];

  function clearHighlights() {
    // Hapus semua highlight span, kembalikan teks asli
    var highlights = contentArea.querySelectorAll(".search-highlight");
    highlights.forEach(function (span) {
      var parent = span.parentNode;
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize(); // gabungkan teks terpisah
    });
    allHighlights = [];
    currentHighlightIndex = -1;
  }

  function performSearch() {
    clearHighlights();
    var query = searchInput.value.trim();
    if (!query) {
      searchResults.textContent = "";
      return;
    }

    // Regex case‑insensitive
    var regex = new RegExp(
      "(" + query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")",
      "gi",
    );
    highlightTextNodes(contentArea, regex);

    // Kumpulkan semua highlight yang dihasilkan
    allHighlights = Array.from(
      contentArea.querySelectorAll(".search-highlight"),
    );
    if (allHighlights.length > 0) {
      searchResults.textContent = allHighlights.length + " matches";
      currentHighlightIndex = 0;
      setCurrentHighlight(0);
    } else {
      searchResults.textContent = "No matches";
    }
  }

  // Rekursif cari teks dalam node, ganti dengan span highlight
  function highlightTextNodes(node, regex) {
    if (node.nodeType === 3) {
      // text node
      var text = node.textContent;
      var match;
      var lastIndex = 0;
      var fragment = document.createDocumentFragment();
      regex.lastIndex = 0;
      while ((match = regex.exec(text)) !== null) {
        // Teks sebelum match
        if (match.index > lastIndex) {
          fragment.appendChild(
            document.createTextNode(text.substring(lastIndex, match.index)),
          );
        }
        var span = document.createElement("span");
        span.className = "search-highlight";
        span.textContent = match[0];
        fragment.appendChild(span);
        lastIndex = regex.lastIndex;
        if (match[0].length === 0) regex.lastIndex++; // hindari infinite loop
      }
      // Sisa teks
      if (lastIndex < text.length) {
        fragment.appendChild(
          document.createTextNode(text.substring(lastIndex)),
        );
      }
      if (fragment.childNodes.length > 0) {
        node.parentNode.replaceChild(fragment, node);
      }
    } else if (
      node.nodeType === 1 &&
      !/(script|style|textarea|select|button|code)/i.test(node.tagName)
    ) {
      // Hindari modifikasi di dalam script/style/textarea dll.
      // Juga hindari highlight ulang span yang sudah ada
      if (node.classList.contains("search-highlight")) return;
      // Rekursi ke anak-anak (harus static NodeList agar tidak berubah saat modifikasi)
      var children = Array.from(node.childNodes);
      children.forEach(function (child) {
        highlightTextNodes(child, regex);
      });
    }
  }

  function setCurrentHighlight(index) {
    allHighlights.forEach(function (span, i) {
      span.classList.toggle("current", i === index);
    });
    if (allHighlights.length > 0) {
      allHighlights[index].scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }

  function navigateHighlights(direction) {
    if (allHighlights.length === 0) return;
    currentHighlightIndex += direction;
    if (currentHighlightIndex >= allHighlights.length)
      currentHighlightIndex = 0;
    if (currentHighlightIndex < 0)
      currentHighlightIndex = allHighlights.length - 1;
    setCurrentHighlight(currentHighlightIndex);
  }

  if (searchInput) {
    searchInput.addEventListener("input", debounce(performSearch, 300));
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          navigateHighlights(-1);
        } else {
          navigateHighlights(1);
        }
      } else if (e.key === "Escape") {
        clearHighlights();
        searchInput.value = "";
        searchResults.textContent = "";
      }
    });
    searchClear.addEventListener("click", function () {
      searchInput.value = "";
      clearHighlights();
      searchResults.textContent = "";
      searchInput.focus();
    });
  }

  /* =========================================================
     COPY BUTTONS
  ========================================================= */
  function enhanceCopyButtons() {
    var pres = document.querySelectorAll(".content pre");
    for (var i = 0; i < pres.length; i++) {
      var pre = pres[i];
      if (pre.closest(".code-block")) continue;

      var wrapper = document.createElement("div");
      wrapper.className = "code-block";
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      var btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.type = "button";
      btn.setAttribute("aria-label", "Copy code to clipboard");

      var label = document.createElement("span");
      label.className = "copy-label";
      label.textContent = "Copy";
      btn.appendChild(label);

      var check = document.createElement("span");
      check.className = "copy-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "✓";
      btn.appendChild(check);

      btn.addEventListener(
        "click",
        (function (preEl, btnEl, labelEl) {
          return function () {
            var codeEl = preEl.querySelector("code");
            var code = codeEl ? codeEl.textContent : preEl.textContent;
            copyToClipboard(code, btnEl, labelEl);
          };
        })(pre, btn, label),
      );

      wrapper.appendChild(btn);

      if ("ontouchstart" in window) {
        btn.classList.add("visible");
      }
    }
  }

  function copyToClipboard(text, btn, labelEl) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(function () {
          indicateCopySuccess(btn, labelEl);
        })
        .catch(function () {
          fallbackCopy(text, btn, labelEl);
        });
    } else {
      fallbackCopy(text, btn, labelEl);
    }
  }

  function fallbackCopy(text, btn, labelEl) {
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    var succeeded = false;
    try {
      succeeded = document.execCommand("copy");
    } catch (e) {}
    document.body.removeChild(textarea);
    if (succeeded) {
      indicateCopySuccess(btn, labelEl);
    } else {
      labelEl.textContent = "Select & copy manually";
      btn.setAttribute(
        "aria-label",
        "Copy failed, please select and copy the code manually",
      );
      setTimeout(function () {
        labelEl.textContent = "Copy";
        btn.setAttribute("aria-label", "Copy code to clipboard");
      }, 3000);
    }
  }

  function indicateCopySuccess(btn, labelEl) {
    btn.classList.add("copied");
    btn.setAttribute("aria-label", "Copied to clipboard");
    labelEl.textContent = "Copied";
    setTimeout(function () {
      btn.classList.remove("copied");
      btn.setAttribute("aria-label", "Copy code to clipboard");
      labelEl.textContent = "Copy";
    }, 2000);
  }

  enhanceCopyButtons();

  /* =========================================================
     SCROLL UI: progress bar + back‑to‑top
  ========================================================= */
  var backToTopBtn = document.getElementById("back-to-top");
  var progressBar = document.getElementById("progress-bar");
  var scrollTicking = false;

  function updateScrollUI() {
    var scrollTop = window.scrollY;
    if (progressBar) {
      var docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      var scrolled = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      progressBar.style.width = scrolled + "%";
    }
    if (backToTopBtn) {
      backToTopBtn.classList.toggle("visible", scrollTop > 300);
    }
    scrollTicking = false;
  }

  function onScroll() {
    if (!scrollTicking) {
      scrollTicking = true;
      window.requestAnimationFrame(updateScrollUI);
    }
  }

  if (progressBar || backToTopBtn) {
    window.addEventListener("scroll", onScroll, { passive: true });
    updateScrollUI();
  }

  if (backToTopBtn) {
    backToTopBtn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
      backToTopBtn.blur();
    });
  }

  /* =========================================================
     TYPEWRITER EFFECT
  ========================================================= */
  var synopsis = document.querySelector(".synopsis[data-typewriter]");
  var prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (synopsis) {
    var originalText = synopsis.getAttribute("data-typewriter") || "";
    var typeIndex = 0;
    var isTyping = false;
    var typeInterval = null;

    function typeStep() {
      typeIndex++;
      synopsis.textContent = originalText.substring(0, typeIndex);
      if (typeIndex >= originalText.length) {
        clearInterval(typeInterval);
        isTyping = false;
      }
    }

    function playTyping() {
      isTyping = true;
      typeInterval = setInterval(typeStep, 30);
    }

    function pauseTyping() {
      clearInterval(typeInterval);
      isTyping = false;
    }

    if (prefersReducedMotion) {
      synopsis.textContent = originalText;
      typeIndex = originalText.length;
    } else {
      synopsis.textContent = "";
      playTyping();
    }

    window.toggleTypewriterEffect = function () {
      if (isTyping) {
        pauseTyping();
      } else if (typeIndex >= originalText.length) {
        typeIndex = 0;
        synopsis.textContent = "";
        playTyping();
      } else {
        playTyping();
      }
    };
  }

  /* =========================================================
     HELP MODAL (focus trap)
  ========================================================= */
  var helpModal = document.getElementById("help-modal");
  var helpClose = document.getElementById("help-close");
  var lastFocusedBeforeModal = null;

  function getFocusableInModal() {
    if (!helpModal) return [];
    var selector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    return Array.prototype.slice.call(helpModal.querySelectorAll(selector));
  }

  function trapTabKey(e) {
    if (e.key !== "Tab") return;
    var focusable = getFocusableInModal();
    if (focusable.length === 0) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function showHelp() {
    if (!helpModal) return;
    lastFocusedBeforeModal = document.activeElement;
    helpModal.hidden = false;
    helpModal.addEventListener("keydown", trapTabKey);
    var focusable = getFocusableInModal();
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      helpModal.setAttribute("tabindex", "-1");
      helpModal.focus();
    }
  }

  function hideHelp() {
    if (!helpModal || helpModal.hidden) return;
    helpModal.hidden = true;
    helpModal.removeEventListener("keydown", trapTabKey);
    if (
      lastFocusedBeforeModal &&
      typeof lastFocusedBeforeModal.focus === "function"
    ) {
      lastFocusedBeforeModal.focus();
    }
    lastFocusedBeforeModal = null;
  }

  function toggleHelp() {
    if (!helpModal) return;
    if (helpModal.hidden) showHelp();
    else hideHelp();
  }

  if (helpModal) {
    helpModal.addEventListener("click", function (e) {
      if (e.target === e.currentTarget) hideHelp();
    });
  }
  if (helpClose) {
    helpClose.addEventListener("click", hideHelp);
  }

  /* =========================================================
     KEYBOARD SHORTCUTS
  ========================================================= */
  document.addEventListener("keydown", function (e) {
    var targetTag = e.target.tagName;
    if (
      targetTag === "INPUT" ||
      targetTag === "TEXTAREA" ||
      e.target.isContentEditable
    ) {
      // Izinkan Escape dan ? untuk input search (kita tangani di search)
      if (e.key === "Escape" || e.key === "?") {
        // tidak return, biarkan switch handle
      } else {
        return;
      }
    }
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    switch (e.key) {
      case "j":
      case "ArrowDown":
        e.preventDefault();
        window.scrollBy({ top: 100, behavior: "smooth" });
        break;
      case "k":
      case "ArrowUp":
        e.preventDefault();
        window.scrollBy({ top: -100, behavior: "smooth" });
        break;
      case "g":
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "G":
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "smooth",
        });
        break;
      case "p":
        window.print();
        break;
      case "l":
        toggleTheme();
        break;
      case "c":
        if (typeof window.toggleTypewriterEffect === "function") {
          window.toggleTypewriterEffect();
        }
        break;
      case "s":
        // Fokus search
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
        break;
      case "?":
        toggleHelp();
        break;
      case "Escape":
        if (helpModal && !helpModal.hidden) {
          hideHelp();
        } else {
          // Clear search
          if (searchInput) {
            searchInput.value = "";
            clearHighlights();
            searchResults.textContent = "";
          }
        }
        break;
      default:
        break;
    }
  });
})();
