/* =========================================================
   rawssg – Terminal Manpage Scripts (Refactored)
   Modern, efficient, fully accessible.
   ========================================================= */
(function () {
  "use strict";

  /* ---------- DOM References (cached, nullable) ---------- */
  const doc = document;
  const html = doc.documentElement;
  const body = doc.body;
  const get = (id) => doc.getElementById(id) || null;
  const sidebar = get("sidebar");
  const sidebarToggle = get("sidebar-toggle");
  const tocList = get("toc-list");
  const tocToggle = get("toc-toggle");
  const manToc = get("man-toc");
  const contentArea = get("content");
  const searchInput = get("search-input");
  const searchClear = get("search-clear");
  const searchResults = get("search-results");
  const progressBar = get("progress-bar");
  const backToTopBtn = get("back-to-top");
  const helpModal = get("help-modal");
  const helpClose = get("help-close");
  const dateEl = get("date_modified");
  const yearSpan = get("current-year");

  /* ---------- Utilities ---------- */
  const escapeHtml = (text) => {
    if (typeof text !== "string") return "";
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  };

  const safeText = (el, text) => {
    if (el) el.textContent = text;
  };

  const debounce = (fn, delay = 250) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  };

  /* ---------- LocalStorage Helpers ---------- */
  const storage = {
    get(key, fallback = null) {
      try {
        return localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* noop */
      }
    },
    getBool(key, fallback = false) {
      return this.get(key, fallback ? "1" : "0") === "1";
    },
    setBool(key, value) {
      this.set(key, value ? "1" : "0");
    },
  };

  /* ---------- Theme Toggle ---------- */
  const applyTheme = (theme) => {
    html.classList.toggle("light", theme === "light");
    html.setAttribute("data-theme", theme);
    storage.set("manpage-theme", theme);
  };
  const initTheme = () => {
    applyTheme(storage.get("manpage-theme", "dark"));
    requestAnimationFrame(() =>
      requestAnimationFrame(() => body.classList.remove("no-transition")),
    );
  };
  const toggleTheme = () =>
    applyTheme(html.classList.contains("light") ? "dark" : "light");
  body.classList.add("no-transition");
  initTheme();

  /* ---------- Date & Footer Year ---------- */
  if (dateEl) {
    const months = [
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
    const d = new Date();
    dateEl.textContent = `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  /* ---------- Sidebar ---------- */
  let sidebarOpen = storage.getBool("sidebar-open", false);
  const setSidebarState = (open) => {
    if (sidebar) sidebar.classList.toggle("open", open);
    if (sidebarToggle)
      sidebarToggle.setAttribute("aria-expanded", String(open));
    storage.setBool("sidebar-open", open);
    sidebarOpen = open;
  };
  if (sidebar && sidebarToggle) {
    setSidebarState(sidebarOpen);
    sidebarToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      setSidebarState(!sidebarOpen);
    });
    doc.addEventListener("click", (e) => {
      if (
        sidebarOpen &&
        !sidebar.contains(e.target) &&
        e.target !== sidebarToggle &&
        !sidebarToggle.contains(e.target)
      ) {
        setSidebarState(false);
      }
    });
    doc.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && sidebarOpen && helpModal?.hidden) {
        setSidebarState(false);
        sidebarToggle.focus();
      }
    });
  }

  /* ---------- Table of Contents Builder ---------- */
  const buildTOC = () => {
    if (!tocList || !contentArea) return;
    const headings = contentArea.querySelectorAll("h2, h3, h4");
    if (headings.length === 0) {
      if (tocToggle) tocToggle.style.display = "none";
      return;
    }

    // Ensure IDs and collect items
    const items = [];
    headings.forEach((h, i) => {
      if (!h.id)
        h.id = `section-${i}-${Math.random().toString(36).slice(2, 8)}`;
      items.push({
        level: parseInt(h.tagName[1], 10),
        text: h.textContent.trim(),
        id: h.id,
      });
    });

    // Build nested HTML
    const buildNested = (items, lvl) => {
      let out = "";
      for (let i = 0; i < items.length;) {
        const cur = items[i];
        if (cur.level < lvl) break;
        if (cur.level === lvl) {
          out += `<li><a href="#${cur.id}">${escapeHtml(cur.text)}</a></li>`;
          i++;
        } else {
          // Collect deeper children
          const sub = [];
          while (i < items.length && items[i].level > lvl) sub.push(items[i++]);
          out += `<ul>${buildNested(sub, lvl + 1)}</ul>`;
        }
      }
      return out;
    };
    tocList.innerHTML = buildNested(items, 2);

    // Add anchor links to headings
    headings.forEach((h) => {
      if (h.querySelector(".heading-anchor")) return;
      const anchor = doc.createElement("a");
      anchor.href = `#${h.id}`;
      anchor.className = "heading-anchor";
      anchor.setAttribute("aria-label", "Copy link to this heading");
      anchor.innerHTML = '<span aria-hidden="true">🔗</span>';
      anchor.addEventListener("click", (e) => {
        e.preventDefault();
        const url = `${location.href.split("#")[0]}#${h.id}`;
        copyToClipboard(url, (ok) => {
          if (ok) {
            anchor.classList.add("copied");
            setTimeout(() => anchor.classList.remove("copied"), 2000);
          }
        });
      });
      h.appendChild(anchor);
    });

    // TOC toggle & persistence
    let tocVisible = storage.getBool("toc-visible", false);
    const setTOCVis = (vis) => {
      manToc?.classList.toggle("visible", vis);
      tocToggle?.setAttribute("aria-expanded", String(vis));
      storage.setBool("toc-visible", vis);
      tocVisible = vis;
    };
    setTOCVis(tocVisible);
    tocToggle?.addEventListener("click", () => setTOCVis(!tocVisible));

    // Scroll spy
    const links = tocList.querySelectorAll("a");
    const anchors = [...links]
      .map((link) => {
        const id = link.getAttribute("href").slice(1);
        return { link, el: doc.getElementById(id) };
      })
      .filter((a) => a.el);

    const updateActiveTOC = () => {
      const scrollY = window.scrollY + 100;
      let active = null;
      for (let i = anchors.length - 1; i >= 0; i--) {
        if (anchors[i].el.offsetTop <= scrollY) {
          active = anchors[i].link;
          break;
        }
      }
      links.forEach((l) => l.classList.remove("active"));
      active?.classList.add("active");
    };
    window.addEventListener("scroll", debounce(updateActiveTOC, 100), {
      passive: true,
    });
    updateActiveTOC();

    // Smooth scroll on click
    links.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const target = doc.getElementById(link.getAttribute("href").slice(1));
        if (target) {
          target.scrollIntoView({ behavior: "smooth" });
          history.pushState?.(null, "", `#${target.id}`);
          if (window.innerWidth < 768 && manToc) setTOCVis(false);
        }
      });
    });
  };

  /* ---------- Client‑side Search ---------- */
  let highlights = [];
  let currentHighlight = -1;

  const clearHighlights = () => {
    if (!contentArea) return;
    contentArea.querySelectorAll(".search-highlight").forEach((span) => {
      span.replaceWith(doc.createTextNode(span.textContent));
    });
    contentArea.normalize();
    highlights = [];
    currentHighlight = -1;
  };

  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const performSearch = () => {
    if (!searchInput || !contentArea) return;
    clearHighlights();
    const query = searchInput.value.trim();
    if (!query) {
      safeText(searchResults, "");
      return;
    }
    if (query.length > 100) {
      safeText(searchResults, "Query too long");
      return;
    }
    let regex;
    try {
      regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
    } catch {
      safeText(searchResults, "Invalid pattern");
      return;
    }

    highlightTextNodes(contentArea, regex);
    highlights = [...contentArea.querySelectorAll(".search-highlight")];
    if (highlights.length) {
      safeText(
        searchResults,
        `${highlights.length} match${highlights.length > 1 ? "es" : ""}`,
      );
      currentHighlight = 0;
      setHighlight(0);
    } else {
      safeText(searchResults, "No matches");
    }
  };

  const highlightTextNodes = (node, regex) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (!text) return;
      const fragment = doc.createDocumentFragment();
      let lastIndex = 0;
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex)
          fragment.appendChild(
            doc.createTextNode(text.slice(lastIndex, match.index)),
          );
        const span = doc.createElement("span");
        span.className = "search-highlight";
        span.textContent = match[0];
        fragment.appendChild(span);
        lastIndex = regex.lastIndex;
        if (match[0].length === 0) regex.lastIndex++;
      }
      if (lastIndex < text.length)
        fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
      if (fragment.childNodes.length > 0)
        node.parentNode?.replaceChild(fragment, node);
    } else if (
      node.nodeType === Node.ELEMENT_NODE &&
      !/^(script|style|textarea|select|button|code|noscript)$/i.test(
        node.tagName,
      ) &&
      !node.classList.contains("search-highlight")
    ) {
      [...node.childNodes].forEach((child) => highlightTextNodes(child, regex));
    }
  };

  const setHighlight = (idx) => {
    highlights.forEach((h, i) => h.classList.toggle("current", i === idx));
    if (highlights[idx])
      highlights[idx].scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const navigateHighlights = (dir) => {
    if (!highlights.length) return;
    currentHighlight =
      (currentHighlight + dir + highlights.length) % highlights.length;
    setHighlight(currentHighlight);
  };

  if (searchInput) {
    searchInput.addEventListener("input", debounce(performSearch, 300));
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        navigateHighlights(e.shiftKey ? -1 : 1);
      } else if (e.key === "Escape") {
        clearHighlights();
        searchInput.value = "";
        safeText(searchResults, "");
      }
    });
    searchClear?.addEventListener("click", () => {
      searchInput.value = "";
      clearHighlights();
      safeText(searchResults, "");
      searchInput.focus();
    });
  }

  /* ---------- Clipboard Helper ---------- */
  const copyToClipboard = (text, callback) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => callback?.(true))
        .catch(() => fallbackCopy(text, callback));
    } else {
      fallbackCopy(text, callback);
    }
  };
  const fallbackCopy = (text, callback) => {
    const ta = doc.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    body.appendChild(ta);
    ta.select();
    try {
      doc.execCommand("copy");
      callback?.(true);
    } catch {
      callback?.(false);
    }
    body.removeChild(ta);
  };

  /* ---------- Code Block Copy Buttons ---------- */
  const enhanceCopyButtons = () => {
    contentArea?.querySelectorAll("pre").forEach((pre) => {
      if (pre.closest(".code-block")) return;
      const wrapper = doc.createElement("div");
      wrapper.className = "code-block";
      pre.replaceWith(wrapper);
      wrapper.appendChild(pre);

      const btn = doc.createElement("button");
      btn.className = "copy-btn";
      btn.setAttribute("aria-label", "Copy code to clipboard");
      const label = doc.createElement("span");
      label.className = "copy-label";
      label.textContent = "Copy";
      btn.appendChild(label);
      const check = doc.createElement("span");
      check.className = "copy-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "\u2713";
      btn.appendChild(check);

      btn.addEventListener("click", () => {
        const code = pre.querySelector("code")?.textContent ?? pre.textContent;
        copyToClipboard(code, (ok) => {
          if (ok) {
            btn.classList.add("copied");
            btn.setAttribute("aria-label", "Copied to clipboard");
            label.textContent = "Copied";
            setTimeout(() => {
              btn.classList.remove("copied");
              btn.setAttribute("aria-label", "Copy code to clipboard");
              label.textContent = "Copy";
            }, 2000);
          } else {
            label.textContent = "Select & copy";
            setTimeout(() => (label.textContent = "Copy"), 3000);
          }
        });
      });
      wrapper.appendChild(btn);
      if ("ontouchstart" in window) btn.classList.add("visible");
    });
  };

  /* ---------- Progress Bar & Back to Top ---------- */
  let scrollTicking = false;
  const updateScrollUI = () => {
    const scrollY = window.scrollY;
    if (progressBar) {
      const docH = Math.max(doc.documentElement.scrollHeight - innerHeight, 1);
      const pct = Math.min((scrollY / docH) * 100, 100);
      progressBar.style.width = `${pct}%`;
      progressBar.setAttribute("aria-valuenow", Math.floor(pct));
    }
    backToTopBtn?.classList.toggle("visible", scrollY > 300);
    scrollTicking = false;
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!scrollTicking) {
        scrollTicking = true;
        requestAnimationFrame(updateScrollUI);
      }
    },
    { passive: true },
  );
  updateScrollUI();
  backToTopBtn?.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" }),
  );

  /* ---------- Reading Time ---------- */
  if (contentArea) {
    const words = (contentArea.textContent || "").trim().split(/\s+/).length;
    const min = Math.max(1, Math.ceil(words / 200));
    const meta = doc.querySelector(".meta");
    if (meta) {
      const p = doc.createElement("p");
      p.innerHTML = `<strong>Reading time</strong> ~${min} min`;
      meta.appendChild(p);
    }
  }

  /* ---------- Typewriter Effect ---------- */
  const synopsis = doc.querySelector(".synopsis[data-typewriter]");
  let typewriterTimer = null;
  let typeIdx = 0;
  const prefersReducedMotion = matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (synopsis) {
    const fullText = synopsis.getAttribute("data-typewriter") || "";
    if (prefersReducedMotion) {
      synopsis.textContent = fullText;
    } else {
      const startTypewriter = () => {
        stopTypewriter();
        typeIdx = 0;
        typewriterTimer = setInterval(() => {
          synopsis.textContent = fullText.slice(0, ++typeIdx);
          if (typeIdx >= fullText.length) clearInterval(typewriterTimer);
        }, 30);
      };
      const stopTypewriter = () => clearInterval(typewriterTimer);
      startTypewriter();
      window.toggleTypewriterEffect = () => {
        if (typewriterTimer) {
          stopTypewriter();
          typewriterTimer = null;
        } else if (typeIdx >= fullText.length) {
          startTypewriter();
        } else {
          startTypewriter();
        } // resume
      };
    }
  }

  /* ---------- Help Modal (focus trap) ---------- */
  let lastFocused = null;
  const showHelp = () => {
    if (!helpModal || !helpModal.hidden) return;
    lastFocused = doc.activeElement;
    helpModal.hidden = false;
    helpModal.addEventListener("keydown", trapFocus);
    const focusable = helpModal.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length) focusable[0].focus();
    else {
      helpModal.setAttribute("tabindex", "-1");
      helpModal.focus();
    }
  };
  const hideHelp = () => {
    if (!helpModal || helpModal.hidden) return;
    helpModal.hidden = true;
    helpModal.removeEventListener("keydown", trapFocus);
    lastFocused?.focus();
    lastFocused = null;
  };
  const trapFocus = (e) => {
    if (e.key !== "Tab") return;
    const focusable = helpModal.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable.length) {
      e.preventDefault();
      return;
    }
    const first = focusable[0],
      last = focusable[focusable.length - 1];
    if (e.shiftKey && doc.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && doc.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  helpModal?.addEventListener("click", (e) => {
    if (e.target === helpModal) hideHelp();
  });
  helpClose?.addEventListener("click", hideHelp);

  /* ---------- Reading Position Memory ---------- */
  window.addEventListener("load", () => {
    const pos = sessionStorage.getItem(`scroll-pos-${location.pathname}`);
    if (pos) window.scrollTo({ top: +pos });
  });
  window.addEventListener("beforeunload", () => {
    sessionStorage.setItem(`scroll-pos-${location.pathname}`, window.scrollY);
  });

  /* ---------- Global Keyboard Shortcuts ---------- */
  doc.addEventListener("keydown", (e) => {
    const target = e.target;
    const isEditable =
      /^(INPUT|TEXTAREA)$/.test(target.tagName) || target.isContentEditable;
    if (isEditable && e.key !== "Escape" && e.key !== "?" && e.key !== "m")
      return;
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
        typeof window.toggleTypewriterEffect === "function" &&
          window.toggleTypewriterEffect();
        break;
      case "s":
        e.preventDefault();
        searchInput?.focus();
        searchInput?.select();
        break;
      case "?":
        e.preventDefault();
        showHelp();
        break;
      case "Escape":
        if (helpModal && !helpModal.hidden) hideHelp();
        else {
          searchInput &&
            ((searchInput.value = ""),
            clearHighlights(),
            safeText(searchResults, ""));
          sidebarOpen && setSidebarState(false);
        }
        break;
      case "m":
        sidebar && setSidebarState(!sidebarOpen);
        break;
      case "y":
        e.preventDefault();
        copyToClipboard(location.href);
        break;
      case "[":
      case "]": {
        e.preventDefault();
        const dir = e.key === "]" ? 1 : -1;
        const heads = contentArea?.querySelectorAll("h2, h3, h4");
        if (!heads?.length) return;
        const scrollY = window.scrollY + (dir > 0 ? 10 : -10);
        let idx = -1;
        for (let i = 0; i < heads.length; i++) {
          if (dir > 0 && heads[i].offsetTop > scrollY) {
            idx = i;
            break;
          } else if (dir < 0 && heads[i].offsetTop >= scrollY) {
            idx = i - 1;
            break;
          }
        }
        if (dir > 0 && idx === -1) idx = heads.length - 1;
        if (dir < 0 && idx < 0) idx = 0;
        heads[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  });

  /* ---------- Prevent Zoom on Double‑tap (optional) ---------- */
  doc.addEventListener(
    "dblclick",
    (e) => {
      if (!e.target.closest("button, a, input")) e.preventDefault();
    },
    { passive: false },
  );

  /* ---------- Initialization ---------- */
  buildTOC();
  enhanceCopyButtons();
})();

(() => {
  const copyrightElement = document.getElementById("copyright");
  copyrightElement.innerHTML =
    "&copy;  " +
    new Date().getFullYear() +
    " https://mroczect.github.io/rawssg - All Rights Reserved.";
})();
