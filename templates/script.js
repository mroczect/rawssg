(function () {
  "use strict";

  var body = document.body;

  // Tanggal modifikasi & tahun
  var dateEl = document.getElementById("date_modified");
  if (dateEl) {
    var months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
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

  // === COPY BUTTONS ===
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
      btn.setAttribute("aria-label", "Copy code to clipboard");
      btn.textContent = "Copy";
      btn.addEventListener("click", (function (pre, btn) {
        return function () {
          var code = pre.querySelector("code")
            ? pre.querySelector("code").innerText
            : pre.innerText;
          copyToClipboard(code, btn);
        };
      })(pre, btn));
      wrapper.appendChild(btn);

      if ("ontouchstart" in window) {
        btn.classList.add("visible");
      }
    }
  }

  function copyToClipboard(text, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function () { indicateCopySuccess(btn); })
        .catch(function () { fallbackCopy(text, btn); });
    } else {
      fallbackCopy(text, btn);
    }
  }

  function fallbackCopy(text, btn) {
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      indicateCopySuccess(btn);
    } catch (e) {
      btn.textContent = "Failed";
    }
    document.body.removeChild(textarea);
  }

  function indicateCopySuccess(btn) {
    btn.classList.add("copied");
    btn.setAttribute("aria-label", "Copied!");
    btn.textContent = "Copied";
    setTimeout(function () {
      btn.classList.remove("copied");
      btn.setAttribute("aria-label", "Copy code to clipboard");
      btn.textContent = "Copy";
    }, 2000);
  }

  enhanceCopyButtons();

  // === BACK TO TOP ===
  var backToTopBtn = document.getElementById("back-to-top");
  if (backToTopBtn) {
    window.addEventListener("scroll", function () {
      backToTopBtn.classList.toggle("visible", window.scrollY > 300);
    });
    backToTopBtn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // === PROGRESS BAR ===
  var progressBar = document.getElementById("progress-bar");
  window.addEventListener("scroll", function () {
    var scrollTop = window.scrollY;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var scrolled = (scrollTop / docHeight) * 100;
    progressBar.style.width = scrolled + "%";
  });

  // === TYPEWRITER ===
  var synopsis = document.querySelector(".synopsis[data-typewriter]");
  if (synopsis) {
    var originalText = synopsis.getAttribute("data-typewriter");
    var index = 0;
    var typing = true;
    var interval;

    function type() {
      synopsis.textContent = originalText.substring(0, index);
      index++;
      if (index > originalText.length) {
        clearInterval(interval);
        typing = false;
      }
    }

    function startTyping() {
      index = 0;
      typing = true;
      synopsis.textContent = "";
      interval = setInterval(type, 30);
    }

    startTyping();

    window.toggleTypewriterEffect = function () {
      if (typing) {
        clearInterval(interval);
        synopsis.textContent = originalText;
        typing = false;
      } else {
        startTyping();
      }
    };
  }

  // === THEME ===
  function initTheme() {
    var saved = localStorage.getItem("manpage-theme");
    if (saved === "light") {
      document.documentElement.classList.add("light");
    }
  }

  function toggleTheme() {
    document.documentElement.classList.toggle("light");
    var isLight = document.documentElement.classList.contains("light");
    localStorage.setItem("manpage-theme", isLight ? "light" : "dark");
  }

  initTheme();

  // === HELP MODAL ===
  var helpModal = document.getElementById("help-modal");
  var helpClose = document.getElementById("help-close");

  function toggleHelp() {
    if (helpModal) helpModal.hidden = !helpModal.hidden;
  }

  function hideHelp() {
    if (helpModal) helpModal.hidden = true;
  }

  if (helpModal) {
    helpModal.addEventListener("click", function (e) {
      if (e.target === e.currentTarget) hideHelp();
    });
  }

  if (helpClose) {
    helpClose.addEventListener("click", hideHelp);
  }

  // === KEYBOARD SHORTCUTS ===
  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
      return;
    }

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
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
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
      case "?":
        toggleHelp();
        break;
      case "Escape":
        hideHelp();
        break;
      default:
        break;
    }
  });
})();
