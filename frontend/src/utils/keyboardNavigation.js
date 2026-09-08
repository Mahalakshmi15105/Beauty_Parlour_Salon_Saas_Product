import { useEffect, useRef } from "react";

/**
 * Checks if a DOM element is navigable and focusable via keyboard navigation.
 * Skips disabled, read-only, hidden, or non-editable elements.
 */
if (typeof window !== "undefined" && typeof document !== "undefined") {
  document.addEventListener(
    "focusin",
    (e) => {
      if (e.target) {
        if (e.target.tagName === "SELECT") {
          if (typeof e.target.showPicker === "function") {
            try {
              e.target.showPicker();
            } catch (err) {
              // ignore if already open or restricted by browser
            }
          }
        } else if (e.target.getAttribute("data-image-upload-trigger") === "true") {
          const targetInputId = e.target.getAttribute("data-target-input");
          if (targetInputId) {
            const inputEl = document.getElementById(targetInputId);
            if (inputEl) {
              try {
                inputEl.click();
              } catch (err) {
                // ignore
              }
            }
          }
        }
      }
    },
    true
  );
}

export function isElementNavigable(el) {
  if (!el || typeof el.getBoundingClientRect !== "function") return false;
  if (el.disabled || el.readOnly) return false;
  if (el.type === "hidden") return false;
  if (el.getAttribute("tabindex") === "-1") return false;

  // Visibility check
  try {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
  } catch (e) {
    return false;
  }
  return el.offsetWidth > 0 || el.offsetHeight > 0 || (el.getClientRects && el.getClientRects().length > 0);
}

/**
 * Validates the current input control before allowing focus movement.
 * Returns true if valid or false if validation fails.
 */
export function validateCurrentInput(el) {
  if (!el) return true;
  
  // Custom or native HTML5 validation
  if (typeof el.checkValidity === "function") {
    if (!el.checkValidity()) {
      if (typeof el.reportValidity === "function") {
        try {
          el.reportValidity();
        } catch (e) {
          // ignore
        }
      }
      return false;
    }
  }
  return true;
}

/**
 * Custom React Hook: Form Keyboard Navigation Engine
 * Automatically moves focus to the next editable control on Enter key or Right Arrow press.
 * Validates current field before moving, auto-opens selects, auto-triggers image file upload,
 * and executes onSubmit when advancing past the last form field.
 */
export function useFormKeyboardNavigation(containerRef, onSubmit) {
  useEffect(() => {
    const container = containerRef?.current || document;
    if (!container) return;

    const handleKeyDown = (e) => {
      // Preserve native system/browser key combinations (Ctrl, Alt, Meta)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const activeEl = document.activeElement;
      if (!activeEl) return;

      // Handle Enter and ArrowRight key for form input advancement
      if (e.key === "Enter" || e.key === "ArrowRight") {
        // Allow multiline text entering inside textareas
        if (activeEl.tagName === "TEXTAREA" && e.key === "Enter" && !e.ctrlKey) {
          return;
        }

        // For ArrowRight, only advance if caret is at the end of input text or on non-text element
        if (e.key === "ArrowRight") {
          if (activeEl.tagName === "INPUT") {
            const t = activeEl.type;
            if (t === "text" || t === "search" || !t) {
              const isAtEnd = activeEl.selectionStart === undefined || activeEl.selectionStart === activeEl.value.length;
              if (!isAtEnd) return;
            }
          } else if (activeEl.tagName === "SELECT") {
            // Allow native select option navigation
            return;
          }
        }

        // Validate active input field before advancing
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "SELECT")) {
          if (!validateCurrentInput(activeEl)) {
            e.preventDefault();
            return;
          }
        }

        // Query all navigable focusable elements inside container
        const focusables = Array.from(
          container.querySelectorAll(
            'input:not([type="hidden"]), select, textarea, button, [tabindex="0"]'
          )
        ).filter((el) => {
          if (!isElementNavigable(el)) return false;
          if (el.getAttribute("data-skip-nav") === "true") return false;
          if (el.getAttribute("type") === "button" && el.classList.contains("cancel-btn")) return false;
          return true;
        });

        if (focusables.length === 0) return;

        const currentIndex = focusables.indexOf(activeEl);

        // If active element is an image upload trigger and Enter is pressed, trigger file picker
        if (activeEl.getAttribute("data-image-upload-trigger") === "true" && e.key === "Enter") {
          const targetInputId = activeEl.getAttribute("data-target-input");
          if (targetInputId) {
            const inputEl = document.getElementById(targetInputId);
            if (inputEl) {
              e.preventDefault();
              try { inputEl.click(); } catch (err) {}
              return;
            }
          }
        }

        if (currentIndex !== -1 && currentIndex < focusables.length - 1) {
          e.preventDefault();
          const nextEl = focusables[currentIndex + 1];
          try {
            nextEl.focus();
            if (typeof nextEl.select === "function" && nextEl.tagName === "INPUT") {
              nextEl.select();
            }
          } catch (err) {
            // ignore
          }
        } else if (currentIndex === focusables.length - 1 || (activeEl && activeEl.type === "submit")) {
          if (onSubmit && typeof onSubmit === "function") {
            e.preventDefault();
            onSubmit(e);
          }
        }
      } else if (e.key === "ArrowLeft") {
        if (activeEl.tagName === "INPUT") {
          const t = activeEl.type;
          if (t === "text" || t === "search" || !t) {
            const isAtStart = activeEl.selectionStart === 0;
            if (!isAtStart) return;
          }
        } else if (activeEl.tagName === "SELECT") {
          return;
        }

        const focusables = Array.from(
          container.querySelectorAll(
            'input:not([type="hidden"]), select, textarea, button, [tabindex="0"]'
          )
        ).filter((el) => {
          if (!isElementNavigable(el)) return false;
          if (el.getAttribute("data-skip-nav") === "true") return false;
          return true;
        });

        const currentIndex = focusables.indexOf(activeEl);
        if (currentIndex > 0) {
          e.preventDefault();
          const prevEl = focusables[currentIndex - 1];
          try {
            prevEl.focus();
            if (typeof prevEl.select === "function" && prevEl.tagName === "INPUT") {
              prevEl.select();
            }
          } catch (err) {}
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, onSubmit]);
}

/**
 * Custom React Hook: Modal Focus Trap & Escape Handler
 * Traps Tab focus inside the active modal, auto-focuses the first input,
 * handles Escape key to close, and restores focus to the triggering element.
 */
export function useModalFocusTrap(isOpen, modalRef, onClose) {
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;

      // Auto-focus the first navigable input/control inside the modal
      const timer = setTimeout(() => {
        const targetContainer = modalRef?.current;
        if (targetContainer) {
          const focusables = Array.from(
            targetContainer.querySelectorAll(
              'input:not([type="hidden"]), select, textarea, button, [tabindex="0"]'
            )
          ).filter(isElementNavigable);

          if (focusables.length > 0) {
            try {
              focusables[0].focus();
              if (typeof focusables[0].select === "function" && focusables[0].tagName === "INPUT") {
                focusables[0].select();
              }
            } catch (err) {
              // ignore
            }
          }
        }
      }, 50);

      const handleModalKeyDown = (e) => {
        // Escape key closes modal
        if (e.key === "Escape") {
          e.preventDefault();
          if (onCloseRef.current) onCloseRef.current();
          return;
        }

        // Tab key focus trap inside modal
        const targetContainer = modalRef?.current;
        if (e.key === "Tab" && targetContainer) {
          const focusables = Array.from(
            targetContainer.querySelectorAll(
              'input:not([type="hidden"]), select, textarea, button, [tabindex="0"]'
            )
          ).filter(isElementNavigable);

          if (focusables.length === 0) return;

          const firstEl = focusables[0];
          const lastEl = focusables[focusables.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === firstEl) {
              e.preventDefault();
              try {
                lastEl.focus();
              } catch (err) {}
            }
          } else {
            if (document.activeElement === lastEl) {
              e.preventDefault();
              try {
                firstEl.focus();
              } catch (err) {}
            }
          }
        }
      };

      document.addEventListener("keydown", handleModalKeyDown);

      return () => {
        clearTimeout(timer);
        document.removeEventListener("keydown", handleModalKeyDown);
        if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
          try {
            previousFocusRef.current.focus();
          } catch (err) {
            // ignore
          }
        }
      };
    }
  }, [isOpen, modalRef]);
}

/**
 * Custom React Hook: Sidebar Keyboard Navigation
 * Enables ArrowUp/ArrowDown to move between sidebar navigation items when a
 * sidebar item is focused, and ArrowLeft/ArrowRight to expand/collapse the
 * sidebar (since this sidebar has no nested submenus, ←/→ toggle collapse).
 *
 * Only acts when the currently focused element is a sidebar navigation button
 * (identified by the `data-sidebar-nav` attribute). Never interferes with
 * forms, inputs, dropdowns, or other controls.
 */
export function useSidebarKeyboardNavigation(sidebarRef, onToggleCollapse) {
  const onToggleCollapseRef = useRef(onToggleCollapse);
  onToggleCollapseRef.current = onToggleCollapse;

  useEffect(() => {
    const sidebar = sidebarRef?.current;
    if (!sidebar) return;

    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      if (!activeEl) return;

      // Only act when a sidebar navigation item is focused
      if (activeEl.getAttribute("data-sidebar-nav") !== "true") return;

      // Preserve native system/browser key combinations
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // ArrowUp / ArrowDown → move between sidebar items
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const navButtons = Array.from(
          sidebar.querySelectorAll('button[data-sidebar-nav="true"]')
        ).filter(isElementNavigable);

        if (navButtons.length === 0) return;
        const idx = navButtons.indexOf(activeEl);
        if (idx === -1) return;

        const nextIdx = e.key === "ArrowDown" ? idx + 1 : idx - 1;
        if (nextIdx >= 0 && nextIdx < navButtons.length) {
          try {
            navButtons[nextIdx].focus();
          } catch (err) {
            // ignore
          }
        }
        return;
      }

      // ArrowLeft / ArrowRight → expand/collapse the sidebar
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        if (onToggleCollapseRef.current && typeof onToggleCollapseRef.current === "function") {
          onToggleCollapseRef.current();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sidebarRef]);
}

/**
 * Utility: Focuses an element directly. If the element is a <select> dropdown,
 * automatically opens its dropdown options immediately.
 */
export function focusAndOpenSelect(element) {
  if (!element) return false;
  try {
    element.focus();
    if (typeof element.select === "function" && element.tagName === "INPUT") {
      element.select();
    }
    if (element.tagName === "SELECT") {
      if (typeof element.showPicker === "function") {
        try {
          element.showPicker();
          return true;
        } catch (e) {
          // fallback
        }
      }
      const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window });
      element.dispatchEvent(event);
    }
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Utility: Advances focus directly to a target ref if current element is valid.
 */
export function advanceToNextRef(currentEl, nextRef, onSubmit) {
  if (currentEl && !validateCurrentInput(currentEl)) {
    return false;
  }
  if (nextRef && nextRef.current && isElementNavigable(nextRef.current)) {
    return focusAndOpenSelect(nextRef.current);
  } else if (onSubmit && typeof onSubmit === "function") {
    onSubmit();
    return true;
  }
  return false;
}