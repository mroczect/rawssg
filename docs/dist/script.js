(function () {
  "use strict";

  /* =========================================================
     CONSTANTS & GLOBAL REFERENCES
     (cached on load, always checked for null)
  ========================================================= */
  var doc = document;
  var body = doc.body;
  var html = doc.documentElement;

  // Cache semua elemen kunci (null-safe)
  var sidebar = doc.getElementById("sidebar");
  var sidebarToggle = doc.getElementById("sidebar-toggle");
  var tocList = doc.getElementById("toc-list");
  var tocToggle = doc.getElementById("toc-toggle");
  var manToc = doc.getElementById("man-toc");
  var contentArea = doc.getElementById("content");
  var searchInput = doc.getElementById("search-input");
  var searchClear = doc.getElementById("search-clear");
  var searchResults = doc.getElementById("search-results");
  var progressBar = doc.getElementById("progress-bar");
  var backToTopBtn = doc.getElementById("back-to-top");
  var helpModal = doc.getElementById("help-modal");
  var helpClose = doc.getElementById("help-close");
  var dateEl = doc.getElementById("date_modified");
  var yearSpan = doc.getElementById("current-year");

  /* =========================================================
     SANITASI & UTILITAS KEAMANAN
  ========================================================= */
  /**
   * Escape HTML entities strictly to prevent XSS.
   * Used on any user-controlled text before inserting into DOM.
   */
  function escapeHtml(text) {
    if (typeof text !== "string") return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Safely set text content (no HTML interpretation).
   */
  function safeText(el, text) {
    if (el) el.textContent = text;
  }

  /**
   * Debounce with maximum wait protection (optional).
   */
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

  /* =========================================================
     PREFERENCES & LOCAL STORAGE SAFETY
  ========================================================= */
  function getPref(key, fallback) {
    try {
      var val = localStorage.getItem(key);
      return val !== null ? val : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function setPref(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* quota exceeded or disabled */
    }
  }

  function getPrefBool(key, fallback) {
    return getPref(key, fallback ? "1" : "0") === "1";
  }

  function setPrefBool(key, value) {
    setPref(key, value ? "1" : "0");
  }

  /* =========================================================
     THEME (improved persistence & no flash)
  ========================================================= */
  function applyTheme(theme) {
    html.classList.toggle("light", theme === "light");
    html.setAttribute("data-theme", theme);
    setPref("manpage-theme", theme);
  }

  function initTheme() {
    var saved = getPref("manpage-theme", "dark");
    applyTheme(saved);
    // Remove no-transition after first paint to allow smooth switches later
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        body.classList.remove("no-transition");
      });
    });
  }

  function toggleTheme() {
    var next = html.classList.contains("light") ? "dark" : "light";
    applyTheme(next);
  }

  // Initial call
  body.classList.add("no-transition");
  initTheme();

  /* =========================================================
     DATE / CURRENT YEAR
  ========================================================= */
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
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  /* =========================================================
     SIDEBAR (with persistence & better a11y)
  ========================================================= */
  var sidebarOpen = getPrefBool("sidebar-open", false);
  function setSidebarState(open) {
    if (sidebar) sidebar.classList.toggle("open", open);
    if (sidebarToggle)
      sidebarToggle.setAttribute("aria-expanded", open ? "true" : "false");
    setPrefBool("sidebar-open", open);
    sidebarOpen = open;
  }

  if (sidebar && sidebarToggle) {
    // initial state
    setSidebarState(sidebarOpen);

    sidebarToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      setSidebarState(!sidebarOpen);
    });

    // Close on outside click (safe)
    doc.addEventListener("click", function (e) {
      if (
        sidebarOpen &&
        !sidebar.contains(e.target) &&
        e.target !== sidebarToggle &&
        !sidebarToggle.contains(e.target)
      ) {
        setSidebarState(false);
      }
    });

    // Close with Escape when sidebar has focus (or global)
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && sidebarOpen && !helpModal.hidden) return; // help modal handles own Esc
      if (e.key === "Escape" && sidebarOpen) {
        setSidebarState(false);
        sidebarToggle.focus();
      }
    });
  }

  /* =========================================================
     TABLE OF CONTENTS (dynamic, nested, safe, a11y enhanced)
  ========================================================= */
  function buildSafeTOC() {
    if (!tocList || !contentArea) return;

    var headings = contentArea.querySelectorAll("h2, h3, h4");
    if (headings.length === 0) {
      if (tocToggle) tocToggle.style.display = "none";
      return;
    }

    // Generate IDs and collect
    var items = [];
    for (var i = 0; i < headings.length; i++) {
      var h = headings[i];
      if (!h.id) {
        h.id = "section-" + i + "-" + Math.random().toString(36).substr(2, 8);
      }
      var level = parseInt(h.tagName.charAt(1)) || 2; // h2 -> 2, h3 -> 3, etc.
      items.push({ level: level, text: h.textContent.trim(), id: h.id });
    }

    // Build nested list (max depth 3: h2,h3,h4)
    var html = buildNestedList(items, 2);
    tocList.innerHTML = html; // all HTML is generated from escaped text, safe

    // Add anchor links to headings (clickable anchor icon)
    addHeadingAnchors(headings);

    // Click events for smooth scroll & active
    var links = tocList.querySelectorAll("a");
    links.forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        var id = link.getAttribute("href").substring(1);
        var target = doc.getElementById(id);
        if (target) {
          target.scrollIntoView({ behavior: "smooth" });
          // Update active class (visual)
          links.forEach(function (l) {
            l.classList.remove("active");
          });
          link.classList.add("active");
          // Update URL hash without jump
          if (history.pushState) {
            history.pushState(null, "", "#" + id);
          }
          // Close TOC on mobile?
          if (window.innerWidth < 768 && manToc) {
            manToc.classList.remove("visible");
            tocToggle.setAttribute("aria-expanded", "false");
          }
        }
      });
    });

    // Toggle TOC visibility (persist state)
    var tocVisible = getPrefBool("toc-visible", false);
    if (manToc && tocToggle) {
      function updateTOCVisibility(visible) {
        manToc.classList.toggle("visible", visible);
        tocToggle.setAttribute("aria-expanded", visible ? "true" : "false");
        setPrefBool("toc-visible", visible);
      }
      updateTOCVisibility(tocVisible);

      tocToggle.addEventListener("click", function () {
        var current = manToc.classList.contains("visible");
        updateTOCVisibility(!current);
      });
    }

    // Scroll spy: highlight active TOC item
    var tocAnchors = [];
    links.forEach(function (link) {
      var id = link.getAttribute("href").substring(1);
      var el = doc.getElementById(id);
      if (el) tocAnchors.push({ link: link, el: el });
    });

    function updateActiveTOC() {
      var scrollPos = window.scrollY + 100;
      var activeLink = null;
      // Walk backwards to find the last heading above scroll position
      for (var i = tocAnchors.length - 1; i >= 0; i--) {
        if (tocAnchors[i].el.offsetTop <= scrollPos) {
          activeLink = tocAnchors[i].link;
          break;
        }
      }
      links.forEach(function (l) {
        l.classList.remove("active");
      });
      if (activeLink) activeLink.classList.add("active");
    }

    window.addEventListener("scroll", debounce(updateActiveTOC, 100), {
      passive: true,
    });
    updateActiveTOC();
  }

  /**
   * Recursively build nested <ul> from items array.
   * Safe: all text passed through escapeHtml.
   */
  function buildNestedList(items, currentLevel) {
    var html = "";
    var i = 0;
    while (i < items.length) {
      var item = items[i];
      if (item.level < currentLevel) break; // back to parent
      if (item.level > currentLevel) {
        // Start sublist
        var subItems = [];
        while (i < items.length && items[i].level > currentLevel) {
          subItems.push(items[i]);
          i++;
        }
        html += "<ul>" + buildNestedList(subItems, currentLevel + 1) + "</ul>";
        continue;
      }
      // Same level
      html +=
        '<li><a href="#' + item.id + '">' + escapeHtml(item.text) + "</a></li>";
      i++;
      // If next item is deeper, it will be handled in the while loop above on next iteration
    }
    return html;
  }

  /**
   * Add anchor links (🔗) to headings, copy URL on click.
   */
  function addHeadingAnchors(headings) {
    headings.forEach(function (h) {
      // Avoid duplicate anchor
      if (h.querySelector(".heading-anchor")) return;

      var anchor = doc.createElement("a");
      anchor.href = "#" + h.id;
      anchor.className = "heading-anchor";
      anchor.setAttribute("aria-label", "Copy link to this heading");
      anchor.innerHTML = '<span aria-hidden="true">🔗</span>'; // safe static HTML
      anchor.addEventListener("click", function (e) {
        e.preventDefault();
        // Copy URL with hash
        var url = window.location.href.split("#")[0] + "#" + h.id;
        copyToClipboardSafe(url, function (success) {
          if (success) {
            anchor.classList.add("copied");
            setTimeout(function () {
              anchor.classList.remove("copied");
            }, 2000);
          }
        });
      });
      h.appendChild(anchor);
    });
  }

  /* =========================================================
     CLIENT-SIDE SEARCH (safe, no ReDoS, accessible)
  ========================================================= */
  var currentHighlightIndex = -1;
  var allHighlights = [];

  function clearHighlights() {
    if (!contentArea) return;
    var highlights = contentArea.querySelectorAll(".search-highlight");
    highlights.forEach(function (span) {
      var parent = span.parentNode;
      parent.replaceChild(doc.createTextNode(span.textContent), span);
      parent.normalize();
    });
    allHighlights = [];
    currentHighlightIndex = -1;
  }

  /**
   * Escape regex special characters safely.
   */
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function performSearch() {
    if (!searchInput || !contentArea) return;
    clearHighlights();
    var query = searchInput.value.trim();
    if (!query) {
      safeText(searchResults, "");
      return;
    }

    // Limit query length to prevent performance issues
    if (query.length > 100) {
      safeText(searchResults, "Query too long");
      return;
    }

    try {
      var escapedQuery = escapeRegExp(query);
      var regex = new RegExp("(" + escapedQuery + ")", "gi");
    } catch (e) {
      safeText(searchResults, "Invalid search pattern");
      return;
    }

    highlightTextNodes(contentArea, regex);
    allHighlights = Array.from(
      contentArea.querySelectorAll(".search-highlight"),
    );

    if (allHighlights.length > 0) {
      safeText(
        searchResults,
        allHighlights.length +
          " match" +
          (allHighlights.length > 1 ? "es" : ""),
      );
      currentHighlightIndex = 0;
      setCurrentHighlight(0);
    } else {
      safeText(searchResults, "No matches");
    }
  }

  function highlightTextNodes(node, regex) {
    if (node.nodeType === Node.TEXT_NODE) {
      var text = node.textContent;
      if (!text) return;
      var match;
      var lastIndex = 0;
      var fragment = doc.createDocumentFragment();
      regex.lastIndex = 0;
      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          fragment.appendChild(
            doc.createTextNode(text.substring(lastIndex, match.index)),
          );
        }
        var span = doc.createElement("span");
        span.className = "search-highlight";
        span.textContent = match[0]; // safe, uses textContent
        fragment.appendChild(span);
        lastIndex = regex.lastIndex;
        if (match[0].length === 0) {
          regex.lastIndex++; // avoid infinite loop on zero-length match
        }
      }
      if (lastIndex < text.length) {
        fragment.appendChild(doc.createTextNode(text.substring(lastIndex)));
      }
      if (fragment.childNodes.length > 0 && node.parentNode) {
        node.parentNode.replaceChild(fragment, node);
      }
    } else if (
      node.nodeType === Node.ELEMENT_NODE &&
      !/^(script|style|textarea|select|button|code|noscript)$/i.test(
        node.tagName,
      )
    ) {
      // Skip highlight inside these tags and our own highlights
      if (node.classList.contains("search-highlight")) return;
      // Use static NodeList to avoid live modification issues
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
    if (allHighlights.length > 0 && allHighlights[index]) {
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
        navigateHighlights(e.shiftKey ? -1 : 1);
      } else if (e.key === "Escape") {
        clearHighlights();
        searchInput.value = "";
        safeText(searchResults, "");
      }
    });
    if (searchClear) {
      searchClear.addEventListener("click", function () {
        searchInput.value = "";
        clearHighlights();
        safeText(searchResults, "");
        searchInput.focus();
      });
    }
  }

  /* =========================================================
     COPY HELPER (safe clipboard & fallback)
  ========================================================= */
  function copyToClipboardSafe(text, callback) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      fallbackCopyText(text, callback);
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(function () {
        if (callback) callback(true);
      })
      .catch(function () {
        fallbackCopyText(text, callback);
      });
  }

  function fallbackCopyText(text, callback) {
    var textarea = doc.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, 999999); // mobile
    var success = false;
    try {
      success = doc.execCommand("copy");
    } catch (e) {}
    body.removeChild(textarea);
    if (callback) callback(!!success);
  }

  /* =========================================================
     ENHANCE COPY BUTTONS for code blocks
  ========================================================= */
  function enhanceCopyButtons() {
    if (!contentArea) return;
    var pres = contentArea.querySelectorAll("pre");
    for (var i = 0; i < pres.length; i++) {
      var pre = pres[i];
      if (pre.closest(".code-block")) continue;

      var wrapper = doc.createElement("div");
      wrapper.className = "code-block";
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      var btn = doc.createElement("button");
      btn.className = "copy-btn";
      btn.type = "button";
      btn.setAttribute("aria-label", "Copy code to clipboard");

      var label = doc.createElement("span");
      label.className = "copy-label";
      label.textContent = "Copy";
      btn.appendChild(label);

      var check = doc.createElement("span");
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
            copyToClipboardSafe(code, function (success) {
              if (success) {
                btnEl.classList.add("copied");
                btnEl.setAttribute("aria-label", "Copied to clipboard");
                labelEl.textContent = "Copied";
                setTimeout(function () {
                  btnEl.classList.remove("copied");
                  btnEl.setAttribute("aria-label", "Copy code to clipboard");
                  labelEl.textContent = "Copy";
                }, 2000);
              } else {
                labelEl.textContent = "Select & copy";
                setTimeout(function () {
                  labelEl.textContent = "Copy";
                }, 3000);
              }
            });
          };
        })(pre, btn, label),
      );

      wrapper.appendChild(btn);

      // Show button permanently on touch devices
      if ("ontouchstart" in window) {
        btn.classList.add("visible");
      }
    }
  }

  /* =========================================================
     PROGRESS BAR & BACK-TO-TOP
  ========================================================= */
  var scrollTicking = false;
  function updateScrollUI() {
    var scrollTop = window.scrollY;
    if (progressBar) {
      var docHeight = Math.max(
        doc.documentElement.scrollHeight - window.innerHeight,
        1,
      );
      var scrolled = Math.min((scrollTop / docHeight) * 100, 100);
      progressBar.style.width = scrolled + "%";
      progressBar.setAttribute("aria-valuenow", Math.floor(scrolled));
    }
    if (backToTopBtn) {
      backToTopBtn.classList.toggle("visible", scrollTop > 300);
    }
    scrollTicking = false;
  }

  function onScroll() {
    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(updateScrollUI);
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
     READING TIME ESTIMATOR
  ========================================================= */
  function showReadingTime() {
    if (!contentArea) return;
    var text = contentArea.textContent || "";
    var wordCount = text.trim().split(/\s+/).length;
    var minutes = Math.max(1, Math.ceil(wordCount / 200)); // avg 200 wpm
    var metaDiv = doc.querySelector(".meta");
    if (metaDiv) {
      var p = doc.createElement("p");
      p.innerHTML = "<strong>Reading time</strong> ~" + minutes + " min";
      metaDiv.appendChild(p);
    }
  }

  /* =========================================================
     TYPEWRITER EFFECT (with reduced motion respect)
  ========================================================= */
  var synopsis = doc.querySelector(".synopsis[data-typewriter]");
  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  var typewriterActive = false;
  var typeIndex = 0;
  var typeInterval = null;

  function startTypewriter(text) {
    if (!synopsis) return;
    typeIndex = 0;
    synopsis.textContent = "";
    typewriterActive = true;
    typeInterval = setInterval(function () {
      typeIndex++;
      synopsis.textContent = text.substring(0, typeIndex);
      if (typeIndex >= text.length) {
        clearInterval(typeInterval);
        typewriterActive = false;
      }
    }, 30);
  }

  function stopTypewriter() {
    clearInterval(typeInterval);
    typewriterActive = false;
  }

  if (synopsis) {
    var originalText = synopsis.getAttribute("data-typewriter") || "";
    if (prefersReducedMotion) {
      synopsis.textContent = originalText;
    } else {
      startTypewriter(originalText);
    }

    window.toggleTypewriterEffect = function () {
      if (typewriterActive) {
        stopTypewriter();
      } else if (typeIndex >= originalText.length) {
        startTypewriter(originalText);
      } else {
        // Resume
        startTypewriter(originalText);
      }
    };
  }

  /* =========================================================
     HELP MODAL (focus trap, a11y)
  ========================================================= */
  var lastFocusedBeforeModal = null;

  function getFocusableIn(el) {
    var selector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    return Array.from(el.querySelectorAll(selector));
  }

  function trapTabKey(e) {
    if (e.key !== "Tab" || !helpModal) return;
    var focusable = getFocusableIn(helpModal);
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && doc.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && doc.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function showHelp() {
    if (!helpModal || !helpModal.hidden) return;
    lastFocusedBeforeModal = doc.activeElement;
    helpModal.hidden = false;
    helpModal.addEventListener("keydown", trapTabKey);
    var focusable = getFocusableIn(helpModal);
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

  if (helpModal) {
    helpModal.addEventListener("click", function (e) {
      if (e.target === helpModal) hideHelp();
    });
  }
  if (helpClose) {
    helpClose.addEventListener("click", hideHelp);
  }

  /* =========================================================
     READING POSITION MEMORY (session)
  ========================================================= */
  (function () {
    var scrollKey = "scroll-pos-" + window.location.pathname;
    var savedScroll = sessionStorage.getItem(scrollKey);
    if (savedScroll) {
      // Restore after TOC built
      window.addEventListener("load", function () {
        var top = parseInt(savedScroll, 10);
        if (!isNaN(top) && top > 0) {
          window.scrollTo({ top: top });
        }
      });
    }
    window.addEventListener("beforeunload", function () {
      sessionStorage.setItem(scrollKey, window.scrollY);
    });
  })();

  /* =========================================================
     KEYBOARD SHORTCUTS (extended, safe)
  ========================================================= */
  doc.addEventListener("keydown", function (e) {
    var target = e.target;
    var tag = target.tagName;
    var isEditable =
      tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;

    // Always allow Escape and ? even in inputs
    if (isEditable && e.key !== "Escape" && e.key !== "?" && e.key !== "m") {
      return;
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
          top: doc.documentElement.scrollHeight,
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
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
        break;
      case "?":
        e.preventDefault();
        showHelp();
        break;
      case "Escape":
        if (helpModal && !helpModal.hidden) {
          hideHelp();
        } else {
          // Clear search
          if (searchInput) {
            searchInput.value = "";
            clearHighlights();
            safeText(searchResults, "");
          }
          if (sidebarOpen) setSidebarState(false);
        }
        break;
      case "m":
        // Toggle sidebar
        if (sidebar) {
          setSidebarState(!sidebarOpen);
        }
        break;
      case "y":
        // Yank URL to clipboard
        e.preventDefault();
        copyToClipboardSafe(window.location.href, function (success) {
          // Optional brief feedback
          if (success) console.log("URL copied: " + window.location.href);
        });
        break;
      case "[":
        // Previous heading
        e.preventDefault();
        navigateHeadings(-1);
        break;
      case "]":
        // Next heading
        e.preventDefault();
        navigateHeadings(1);
        break;
      default:
        break;
    }
  });

  function navigateHeadings(direction) {
    if (!contentArea) return;
    var headings = Array.from(contentArea.querySelectorAll("h2, h3, h4"));
    if (headings.length === 0) return;
    var scrollY = window.scrollY + (direction > 0 ? 10 : -10);
    var currentIndex = -1;
    // Find the heading closest to current position
    for (var i = 0; i < headings.length; i++) {
      if (direction > 0 && headings[i].offsetTop > scrollY) {
        currentIndex = i;
        break;
      } else if (direction < 0 && headings[i].offsetTop >= scrollY) {
        currentIndex = i - 1;
        break;
      }
    }
    if (direction > 0 && currentIndex === -1)
      currentIndex = headings.length - 1;
    if (direction < 0 && currentIndex < 0) currentIndex = 0;
    if (headings[currentIndex]) {
      headings[currentIndex].scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  /* =========================================================
     INITIALISE EVERYTHING
  ========================================================= */
  buildSafeTOC();
  enhanceCopyButtons();
  showReadingTime();

  // Prevent accidental zoom on double-tap (optional)
  doc.addEventListener(
    "dblclick",
    function (e) {
      if (e.target.closest && e.target.closest("button, a, input")) return;
      e.preventDefault();
    },
    { passive: false },
  );
})();
