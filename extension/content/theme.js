(() => {
  "use strict";

  /*
   * Gmail Canvas Dark 1.0.4
   *
   * Gmail and HTML emails frequently use inline `!important` colours. A normal
   * extension stylesheet cannot reliably beat those rules. This version applies
   * the final neutral background/text overrides as inline `!important` styles
   * after inspecting the rendered colours.
   *
   * We never style <html>, <body>, or an element that owns a background image,
   * which is what keeps the user's Gmail theme/background image intact.
   */

  const DARK_0 = "#15171a";
  const DARK_1 = "#1b1d21";
  const DARK_2 = "#202328";
  const BORDER = "#3c4047";
  const TEXT = "#e7e9ec";
  const MUTED = "#bdc1c7";

  const MESSAGE_BODY_SELECTOR = ".a3s";
  const MAIL_GRID_SELECTOR = 'table[role="grid"],[role="grid"]';
  const MAIL_ROW_SELECTOR = "tr.zA";
  const POPUP_ROOT_SELECTOR = '[role="menu"],[role="listbox"]';
  const SEMANTIC_ROOT_SELECTOR = [
    '[role="main"]',
    '[role="dialog"]',
    '[aria-modal="true"]',
    '[role="menu"]',
    '[role="listbox"]',
    '[aria-label*="chat" i][role]',
    '[aria-label*="settings" i][role]'
  ].join(",");

  const PROTECTED_SELECTOR = [
    '[role="banner"]',
    '[role="navigation"]',
    'nav'
  ].join(",");

  const BACKGROUND_SCAN_SELECTOR = [
    "div", "section", "article", "main", "aside", "header", "footer", "nav",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th",
    "form", "fieldset", "label", "button", "input", "textarea", "select",
    "p", "span", "a", "h1", "h2", "h3", "h4", "h5", "h6",
    "pre", "blockquote", "code", "ul", "ol", "li", "center", "font",
    "details", "summary", "figure", "figcaption", "dl", "dt", "dd",
    '[role="navigation"]', '[role="tablist"]', '[role="tab"]'
  ].join(",");

  const MEDIA_SELECTOR = "img,video,canvas,picture,source,svg";
  const scheduledRoots = new Set();
  const MAX_PENDING_ROOTS = 24;
  const originalInlineStyles = new WeakMap();
  const ownedStyleAttributes = new WeakMap();
  let scheduled = false;

  function parseRgb(value) {
    if (!value || value === "transparent") return null;
    const m = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
    if (!m) return null;
    return {
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
      a: m[4] === undefined ? 1 : Number(m[4])
    };
  }

  function lum(c) {
    return (0.2126 * c.r) + (0.7152 * c.g) + (0.0722 * c.b);
  }

  function spread(c) {
    return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
  }

  function isNeutralLight(c) {
    return Boolean(c && c.a >= 0.16 && lum(c) >= 205 && spread(c) <= 58);
  }

  function isNeutralDark(c) {
    return Boolean(c && c.a >= 0.25 && lum(c) <= 128 && spread(c) <= 58);
  }

  function isNeutralMuted(c) {
    if (!c || c.a < 0.25 || spread(c) > 52) return false;
    const l = lum(c);
    return l > 128 && l < 188;
  }

  function ownsBackgroundImage(element) {
    const value = getComputedStyle(element).backgroundImage;
    return Boolean(value && value !== "none");
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 &&
      rect.top < window.innerHeight && rect.left < window.innerWidth;
  }

  function isCentralNavigation(element) {
    if (!(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect();
    const minLeft = Math.max(120, window.innerWidth * 0.08);

    // Gmail's left navigation owns the theme-side column and must stay untouched.
    // Settings tabs, however, are a wide horizontal navigation surface inside
    // the central canvas. Geometry is more stable here than Gmail's generated
    // class names.
    return rect.left >= minLeft &&
      rect.width >= Math.min(520, window.innerWidth * 0.34) &&
      rect.height > 0;
  }

  function isComposeButton(element) {
    if (!(element instanceof Element)) return false;
    if (element.matches('[data-gcd-compose="1"]')) return true;
    if (element.matches('[gh="cm"]')) return true;
    if (!element.matches('button,[role="button"]')) return false;

    const label = [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.textContent
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().toLowerCase();

    return label === "compose" || label.startsWith("compose ");
  }

  function visibleMailGridInside(element) {
    if (!(element instanceof Element)) return null;

    // Gmail's long-lived thread-row class (.zA) is a stronger inbox-list
    // signal than the generated wrapper classes. The surrounding table may or
    // may not expose role=grid depending on the Gmail build.
    let row = null;
    if (element.matches(MAIL_ROW_SELECTOR)) row = element;
    else row = element.querySelector(MAIL_ROW_SELECTOR);

    if (!row || !isVisible(row)) return null;
    const grid = row.closest('table,[role="grid"]');
    return grid || row.parentElement || row;
  }

  function isProtected(element) {
    if (!(element instanceof Element)) return true;
    if (element === document.documentElement || element === document.body) return true;
    if (element.matches(MEDIA_SELECTOR)) return true;

    // Popups and Compose are intentional exceptions even if Gmail mounts them
    // under a normally protected navigation/list container.
    if (element.closest(POPUP_ROOT_SELECTOR)) return false;
    if (isComposeButton(element) || element.closest('[data-gcd-compose="1"]')) return false;

    // Preserve Gmail's own themed/translucent inbox list instead of replacing
    // it with an opaque dark rectangle.
    if (element.closest('[data-gcd-preserve-theme="1"]')) return true;

    // Dialogs may be mounted under otherwise protected Gmail containers.
    if (element.closest('[role="dialog"],[aria-modal="true"]')) return false;

    const banner = element.closest('[role="banner"]');
    if (banner) return true;

    const navigation = element.closest('[role="navigation"],nav');
    if (navigation) return !isCentralNavigation(navigation);

    return false;
  }

  function rememberInlineStyle(element, property) {
    let properties = originalInlineStyles.get(element);
    if (!properties) {
      properties = new Map();
      originalInlineStyles.set(element, properties);
    }
    if (properties.has(property)) return;
    properties.set(property, {
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property)
    });
  }

  function setImportant(element, property, value) {
    const previous = originalInlineStyles.get(element)?.get(property);
    if (previous && previous.desiredValue === value &&
        element.style.getPropertyValue(property) === previous.appliedValue &&
        element.style.getPropertyPriority(property) === "important") return;
    if (element.style.getPropertyValue(property) === value &&
        element.style.getPropertyPriority(property) === "important") return;
    if (previous && (element.style.getPropertyValue(property) !== previous.appliedValue ||
        element.style.getPropertyPriority(property) !== "important")) {
      originalInlineStyles.get(element).delete(property);
    }
    rememberInlineStyle(element, property);
    element.style.setProperty(property, value, "important");
    originalInlineStyles.get(element).get(property).appliedValue = element.style.getPropertyValue(property);
    originalInlineStyles.get(element).get(property).desiredValue = value;
    ownedStyleAttributes.set(element, element.getAttribute("style"));
  }

  function restoreInlineStyles(element) {
    const properties = originalInlineStyles.get(element);
    if (!properties) return;

    for (const [property, original] of properties) {
      // Gmail may have replaced this property since our last write.
      if (element.style.getPropertyValue(property) !== original.appliedValue ||
          element.style.getPropertyPriority(property) !== "important") continue;
      if (original.value) {
        element.style.setProperty(property, original.value, original.priority || "");
      } else {
        element.style.removeProperty(property);
      }
    }
    originalInlineStyles.delete(element);
    ownedStyleAttributes.set(element, element.getAttribute("style"));
    delete element.dataset.gcdForcedSurface;
    delete element.dataset.gcdCanvasRoot;
  }

  function restoreSubtree(root) {
    if (!(root instanceof Element)) return;
    restoreInlineStyles(root);
    root.querySelectorAll("*").forEach(restoreInlineStyles);
  }

  function preserveMailListTheme(start = document) {
    const scope = start instanceof Element || start instanceof Document ? start : document;
    // Recompute, rather than treating protection as permanent across SPA views.
    if (scope instanceof Element) delete scope.dataset.gcdPreserveTheme;
    scope.querySelectorAll('[data-gcd-preserve-theme="1"]').forEach((element) => {
      delete element.dataset.gcdPreserveTheme;
    });
    const grids = new Set();
    const rows = [];

    if (scope instanceof Element && scope.matches(MAIL_ROW_SELECTOR)) rows.push(scope);
    scope.querySelectorAll?.(MAIL_ROW_SELECTOR).forEach((row) => rows.push(row));

    for (const row of rows) {
      if (!isVisible(row)) continue;
      grids.add(row.closest('table,[role="grid"]') || row.parentElement || row);
    }

    for (const grid of grids) {
      let current = grid;
      let highest = grid;
      let mainRoot = null;

      while (current instanceof Element && current !== document.body) {
        // Restore any extension-owned inline style on the ancestor chain. This
        // matters when Gmail reuses the same role=main container after moving
        // from an opened message back to the inbox without a full page reload.
        restoreInlineStyles(current);

        if (current.getAttribute("role") === "main") {
          mainRoot = current;
          break;
        }

        current.dataset.gcdPreserveTheme = "1";
        highest = current;
        current = current.parentElement;
      }

      // Restore descendants inside the list wrapper that were darkened before
      // the inbox/list view became active. Gmail then regains control of its
      // native themed transparency and row colours.
      restoreSubtree(highest);
      highest.querySelectorAll('[data-gcd-preserve-theme="1"]').forEach((element) => {
        delete element.dataset.gcdForcedSurface;
        delete element.dataset.gcdCanvasRoot;
      });

      if (mainRoot) {
        delete mainRoot.dataset.gcdForcedSurface;
        delete mainRoot.dataset.gcdCanvasRoot;
      }
    }
  }

  function processComposeButtons(start = document) {
    const scope = start instanceof Element || start instanceof Document ? start : document;
    const candidates = [];
    if (scope instanceof Element && (scope.matches('[gh="cm"],button,[role="button"]'))) candidates.push(scope);
    scope.querySelectorAll?.('[gh="cm"],button,[role="button"]').forEach((element) => candidates.push(element));

    for (const element of candidates) {
      if (!isComposeButton(element)) continue;
      element.dataset.gcdCompose = "1";
      setImportant(element, "background-color", DARK_2);
      setImportant(element, "background-image", "none");
      setImportant(element, "color", TEXT);
      setImportant(element, "border-color", BORDER);
      setImportant(element, "box-shadow", "none");

      element.querySelectorAll("span,div,svg,path").forEach((child) => {
        setImportant(child, "color", TEXT);
        if (child.matches("svg,path")) setImportant(child, "fill", TEXT);
      });
    }
  }

  function processPopupRoot(element) {
    if (!(element instanceof Element) || !element.matches(POPUP_ROOT_SELECTOR)) return;
    element.dataset.gcdPopupRoot = "1";
    scanRoot(element, { forceRoot: true, aggressive: true });
  }

  function darkenSurface(element, level = 1) {
    if (isProtected(element) || ownsBackgroundImage(element)) return false;
    const bg = parseRgb(getComputedStyle(element).backgroundColor);
    if (!isNeutralLight(bg)) return false;

    setImportant(element, "background-color", level === 0 ? DARK_0 : level === 2 ? DARK_2 : DARK_1);
    element.dataset.gcdForcedSurface = "1";
    return true;
  }

  function darkenLightBorder(element) {
    if (isProtected(element)) return;
    const s = getComputedStyle(element);
    const colors = [s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor]
      .map(parseRgb);
    if (colors.some(isNeutralLight)) {
      setImportant(element, "border-color", BORDER);
    }
  }

  function effectiveBackground(element, stopRoot) {
    let current = element;
    while (current instanceof Element) {
      const s = getComputedStyle(current);
      if (s.backgroundImage && s.backgroundImage !== "none") return null;
      const bg = parseRgb(s.backgroundColor);
      if (bg && bg.a >= 0.15) return bg;
      if (current === stopRoot) break;
      current = current.parentElement;
    }
    return null;
  }

  function fixText(element, stopRoot) {
    if (isProtected(element) || element.matches(MEDIA_SELECTOR)) return;
    const s = getComputedStyle(element);
    const fg = parseRgb(s.color);
    if (!fg) return;

    const bg = effectiveBackground(element, stopRoot);
    if (!bg || lum(bg) > 155) return;

    if (isNeutralDark(fg)) {
      setImportant(element, "color", TEXT);
    } else if (isNeutralMuted(fg)) {
      setImportant(element, "color", MUTED);
    }
  }

  function scanRoot(root, { forceRoot = false, aggressive = false } = {}) {
    if (!(root instanceof Element) || isProtected(root)) return;
    if (visibleMailGridInside(root) && !root.matches(POPUP_ROOT_SELECTOR)) return;

    if (forceRoot && !ownsBackgroundImage(root)) {
      setImportant(root, "background-color", DARK_0);
      root.dataset.gcdCanvasRoot = "1";
    } else {
      darkenSurface(root, 0);
    }

    const elements = [root, ...root.querySelectorAll(BACKGROUND_SCAN_SELECTOR)];

    // Pass 1: backgrounds/borders. For an HTML email we convert every neutral
    // white wrapper, including tiny table cells. For Gmail UI roots the same
    // conversion is still safe because coloured surfaces are preserved.
    for (const element of elements) {
      if (isProtected(element)) continue;
      if (!aggressive && !isVisible(element)) continue;
      darkenSurface(element, element.matches("button,[role=button],input,textarea,select") ? 2 : 1);
      darkenLightBorder(element);
    }

    // Pass 2: now that the real rendered surfaces are dark, calculate text
    // contrast from those final backgrounds rather than predicting it.
    for (const element of elements) {
      if (isProtected(element)) continue;
      if (!aggressive && !isVisible(element)) continue;
      fixText(element, root);
    }
  }

  function findConversationCanvas(messageBody) {
    const semantic = messageBody.closest('[role="main"]');
    if (semantic) return semantic;

    const minLeft = Math.max(120, window.innerWidth * 0.08);
    let current = messageBody;
    let best = messageBody;

    while (current && current.parentElement && current.parentElement !== document.body) {
      const parent = current.parentElement;
      const r = parent.getBoundingClientRect();

      // The Gmail theme/sidebar wrapper eventually expands almost to the full
      // viewport. Stop before that wrapper so the user's background is untouched.
      if (r.width >= window.innerWidth * 0.94 || r.left < minLeft * 0.55) break;

      if (r.left >= minLeft && r.width >= 320 && r.height >= 120) best = parent;
      current = parent;
    }

    return best;
  }

  function processMessageBody(messageBody) {
    if (!(messageBody instanceof Element)) return;

    // First fix the sender's HTML itself. This directly beats inline !important
    // backgrounds used by many transactional/newsletter templates.
    scanRoot(messageBody, { forceRoot: true, aggressive: true });

    // Then fix Gmail's surrounding subject/sender/conversation canvas.
    const canvas = findConversationCanvas(messageBody);
    if (canvas) scanRoot(canvas, { forceRoot: true, aggressive: false });
  }

  function isSettingsRoute() {
    return /^#settings(?:\/|$)/i.test(location.hash);
  }

  function isCentralSettingsBar(element) {
    if (!isSettingsRoute() || !(element instanceof Element)) return false;
    if (isProtected(element) || ownsBackgroundImage(element) || !isVisible(element)) return false;

    const rect = element.getBoundingClientRect();
    const minLeft = Math.max(120, window.innerWidth * 0.08);
    const maxTop = Math.min(360, window.innerHeight * 0.42);

    // The settings tab strip is wide but shallow, so it deliberately falls
    // below the generic canvas fallback's 56px minimum height. Detect that
    // horizontal surface explicitly without relying on Gmail's generated classes.
    if (rect.left < minLeft) return false;
    if (rect.width < Math.min(620, window.innerWidth * 0.40)) return false;
    if (rect.height < 24 || rect.height > 96) return false;
    if (rect.top < 70 || rect.top > maxTop) return false;

    return isNeutralLight(parseRgb(getComputedStyle(element).backgroundColor));
  }

  function processSettingsBars(start = document) {
    if (!isSettingsRoute()) return;
    const root = start instanceof Element || start instanceof Document ? start : document;
    const candidates = root.querySelectorAll?.(
      'nav,[role="navigation"],[role="tablist"],header,div,section'
    ) || [];

    for (const element of candidates) {
      if (isCentralSettingsBar(element)) {
        scanRoot(element, { forceRoot: true, aggressive: false });
      }
    }
  }

  function isLargeCentralLightSurface(element) {
    if (!(element instanceof Element) || isProtected(element) || ownsBackgroundImage(element)) return false;
    if (!isVisible(element)) return false;
    if (visibleMailGridInside(element)) return false;

    const rect = element.getBoundingClientRect();
    const minLeft = Math.max(120, window.innerWidth * 0.08);
    if (rect.left < minLeft) return false;
    if (rect.width < Math.min(380, window.innerWidth * 0.24)) return false;
    if (rect.height < 56) return false;

    return isNeutralLight(parseRgb(getComputedStyle(element).backgroundColor));
  }

  function discoverAndProcess(start = document) {
    const root = start instanceof Element || start instanceof Document ? start : document;

    // Preserve Gmail's theme/transparency in thread-list views before generic
    // surface discovery has a chance to convert their containers.
    preserveMailListTheme(root);

    // Compose is inside the protected left navigation, so handle it explicitly.
    processComposeButtons(root);

    // Opened message bodies are the highest-confidence anchor.
    if (root instanceof Element && root.matches(MESSAGE_BODY_SELECTOR)) processMessageBody(root);
    root.querySelectorAll?.(MESSAGE_BODY_SELECTOR).forEach(processMessageBody);

    // Semantic Gmail surfaces: settings, chat, dialogs, and main content where
    // Gmail exposes stable accessibility roles.
    if (root instanceof Element && root.matches(SEMANTIC_ROOT_SELECTOR)) {
      if (root.matches(POPUP_ROOT_SELECTOR)) processPopupRoot(root);
      else scanRoot(root, { forceRoot: true, aggressive: false });
    }
    root.querySelectorAll?.(SEMANTIC_ROOT_SELECTOR).forEach((element) => {
      if (element.matches(POPUP_ROOT_SELECTOR)) processPopupRoot(element);
      else scanRoot(element, { forceRoot: true, aggressive: false });
    });

    // Gmail Settings uses a wide, shallow top tab/navigation strip that was
    // intentionally excluded by the generic large-surface fallback in 1.0.2.
    // Handle it explicitly while still protecting the left-side navigation.
    processSettingsBars(root);

    // Fallback for current Gmail builds where the opened/settings canvas is a
    // generated class rather than role=main. Only large central neutral-white
    // surfaces qualify, so the left-side theme and small controls are untouched.
    const candidates = root.querySelectorAll?.("div,section,main,article,table,form") || [];
    for (const element of candidates) {
      if (isLargeCentralLightSurface(element)) {
        scanRoot(element, { forceRoot: false, aggressive: false });
      }
    }
  }

  function queue(root) {
    if (!(root instanceof Element) && !(root instanceof Document)) return;
    if (root instanceof Element && !root.isConnected) return;
    if (root === document) {
      scheduledRoots.clear();
      scheduledRoots.add(document);
    } else if (!scheduledRoots.has(document)) {
      for (const pending of scheduledRoots) if (pending.contains(root)) return;
      for (const pending of scheduledRoots) if (root.contains(pending)) scheduledRoots.delete(pending);
      scheduledRoots.add(root);
      if (scheduledRoots.size > MAX_PENDING_ROOTS) {
        scheduledRoots.clear();
        scheduledRoots.add(document);
      }
    }
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const roots = [...scheduledRoots];
      scheduledRoots.clear();
      for (const pending of roots) {
        if (pending === document || pending.isConnected) discoverAndProcess(pending);
      }
    });
  }

  function queueContext(element) {
    if (!(element instanceof Element)) return;
    // Recompute from outside every enclosing preservation marker. A semantic
    // root inside a preserved wrapper cannot clear that wrapper on SPA reuse.
    let outermostPreserved = null;
    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.dataset.gcdPreserveTheme === "1") outermostPreserved = ancestor;
    }
    const start = outermostPreserved ? outermostPreserved.parentElement : element;
    // A nested insertion must revisit the existing message with aggressive
    // scanning, even when a nearer semantic root occurs inside the message.
    const context = start && (start.closest(MESSAGE_BODY_SELECTOR) || start.closest(SEMANTIC_ROOT_SELECTOR));
    queue(context || document);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        if (mutation.attributeName === "style" && ownedStyleAttributes.has(mutation.target) &&
            ownedStyleAttributes.get(mutation.target) === mutation.target.getAttribute("style")) continue;
        queueContext(mutation.target);
      } else if (mutation.type === "childList") {
        queueContext(mutation.target);
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ["class", "style", "hidden", "role", "aria-modal", "aria-label", "gh"]
  });

  // Retain the reference's interaction fallback: pseudo-class and stylesheet
  // changes need not produce observable DOM attribute mutations.
  document.addEventListener("click", () => {
    setTimeout(() => queue(document), 0);
    setTimeout(() => queue(document), 80);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
      setTimeout(() => queue(document), 0);
      setTimeout(() => queue(document), 80);
    }
  }, true);

  function fullRescan() {
    queue(document);
    // Preserve reference coverage for late stylesheet/visibility changes that
    // are not observable DOM insertions. No repeating interval/polling.
    setTimeout(() => queue(document), 120);
    setTimeout(() => queue(document), 500);
    setTimeout(() => queue(document), 1300);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fullRescan, { once: true });
  } else {
    fullRescan();
  }

  window.addEventListener("hashchange", fullRescan);
  window.addEventListener("popstate", fullRescan);
})();
