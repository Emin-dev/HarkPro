(function () {
  "use strict";

  var root = document.documentElement;
  var STORAGE_KEY = "emin-theme";

  function systemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function currentTheme() {
    var set = root.getAttribute("data-theme");
    return set === "light" || set === "dark" ? set : systemTheme();
  }

  function paintThemeButton() {
    var button = document.querySelector("[data-theme-toggle]");
    if (!button) return;
    button.setAttribute("aria-label", currentTheme() === "dark" ? "Switch to light theme" : "Switch to dark theme");
    button.setAttribute("title", currentTheme() === "dark" ? "Light theme" : "Dark theme");
  }

  function initTheme() {
    var button = document.querySelector("[data-theme-toggle]");
    if (!button) return;
    paintThemeButton();
    button.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch (error) { /* private mode: theme lasts this visit */ }
      paintThemeButton();
    });
  }

  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (var i = 0; i < items.length; i += 1) items[i].classList.add("is-in");
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach(function (item) { observer.observe(item); });
  }

  function initYear() {
    var nodes = document.querySelectorAll("[data-year]");
    for (var i = 0; i < nodes.length; i += 1) nodes[i].textContent = String(new Date().getFullYear());
  }

  function start() {
    initTheme();
    initReveal();
    initYear();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
