// Reusable star rendering component.
// Supports both interactive (selector) and static (display) modes.
// No external libraries — pure HTML/CSS/JS.

// Render a star row.
// mode: "display" (read-only) | "interactive" (selectable)
// value: current rating 0–5 (for display) or selected value (for interactive)
// hoverValue: optional preview value during hover (interactive only)
function renderStars({ mode, value, hoverValue, idPrefix }) {
  const container = document.createElement("div");
  container.className = "star-rating";
  container.setAttribute("role", mode === "interactive" ? "radiogroup" : "presentation");
  container.setAttribute("aria-label", mode === "interactive" ? "Select a rating" : `Rating: ${value} out of 5`);

  const displayValue = mode === "interactive" ? (hoverValue || value) : value;

  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("button");
    star.type = "button";
    star.className = "star";
    star.setAttribute("data-value", String(i));

    if (mode === "interactive") {
      star.setAttribute("aria-label", `Rate ${i} star${i > 1 ? "s" : ""}`);
      star.setAttribute("tabindex", "0");
    } else {
      star.setAttribute("tabindex", "-1");
      star.setAttribute("aria-hidden", "true");
    }

    star.textContent = i <= displayValue ? "★" : "☆";
    star.classList.toggle("is-filled", i <= displayValue);

    if (mode === "interactive") {
      star.addEventListener("mouseenter", () => {
        container.querySelectorAll(".star").forEach((s) => {
          const v = Number(s.dataset.value);
          s.textContent = v <= i ? "★" : "☆";
          s.classList.toggle("is-filled", v <= i);
        });
      });

      star.addEventListener("mouseleave", () => {
        container.querySelectorAll(".star").forEach((s) => {
          const v = Number(s.dataset.value);
          s.textContent = v <= value ? "★" : "☆";
          s.classList.toggle("is-filled", v <= value);
        });
      });

      star.addEventListener("click", () => {
        container.querySelectorAll(".star").forEach((s) => {
          const v = Number(s.dataset.value);
          s.textContent = v <= i ? "★" : "☆";
          s.classList.toggle("is-filled", v <= i);
        });
        container.dispatchEvent(
          new CustomEvent("star-select", { detail: { value: i } })
        );
      });

      // Keyboard support: Enter/Space to select, arrow keys to change value.
      star.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          star.click();
        } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          const next = star.nextElementSibling || container.querySelector('.star');
          if (next) next.focus();
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          const prev = star.previousElementSibling;
          if (prev) prev.focus();
        }
      });
    }

    container.appendChild(star);
  }

  return container;
}

// Create an interactive star selector that dispatches "star-select" events.
// Returns the container element.
function createStarSelector(initialValue = 0) {
  const container = renderStars({
    mode: "interactive",
    value: initialValue,
    hoverValue: initialValue,
  });
  return container;
}

// Create a static (read-only) star display.
function createStarDisplay(value = 0) {
  return renderStars({
    mode: "display",
    value: value || 0,
  });
}

// Update the displayed value of an existing star container.
function setStarValue(container, value) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  container.querySelectorAll(".star").forEach((star) => {
    const sv = Number(star.dataset.value);
    star.textContent = sv <= v ? "★" : "☆";
    star.classList.toggle("is-filled", sv <= v);
  });
}

export { renderStars, createStarSelector, createStarDisplay, setStarValue };