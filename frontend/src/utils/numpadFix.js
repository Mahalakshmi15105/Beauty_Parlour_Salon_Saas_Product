/**
 * Universal Right-Side Numeric Keypad (Numpad) Input Fix
 * 
 * Guarantees that numeric keypad keys (Numpad 0-9, Decimal) ALWAYS insert their numbers
 * into any active input/textarea, even when the user's physical NumLock key is toggled OFF.
 */
const NUMPAD_MAP = {
  Numpad0: "0",
  Numpad1: "1",
  Numpad2: "2",
  Numpad3: "3",
  Numpad4: "4",
  Numpad5: "5",
  Numpad6: "6",
  Numpad7: "7",
  Numpad8: "8",
  Numpad9: "9",
  NumpadDecimal: ".",
  NumpadDivide: "/",
  NumpadMultiply: "*",
  NumpadSubtract: "-",
  NumpadAdd: "+",
};

export function initNumpadFix() {
  if (typeof window === "undefined") return;

  window.addEventListener(
    "keydown",
    (e) => {
      // Don't interfere if modifier keys like Ctrl/Alt/Meta are pressed
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const target = document.activeElement;
      if (!target || (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA")) return;
      if (target.readOnly || target.disabled) return;

      const char = NUMPAD_MAP[e.code];
      if (char !== undefined) {
        // If NumLock is OFF on the user's keyboard, e.key will be 'Insert', 'End', 'ArrowDown', etc., instead of the char
        if (e.key !== char) {
          e.preventDefault();
          e.stopPropagation();

          const isNumberType = target.type === "number";

          if (isNumberType) {
            const currentVal = target.value || "";
            const newVal = currentVal + char;
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
            if (nativeSetter) {
              nativeSetter.call(target, newVal);
            } else {
              target.value = newVal;
            }
            target.dispatchEvent(new Event("input", { bubbles: true }));
            target.dispatchEvent(new Event("change", { bubbles: true }));
          } else {
            const start = target.selectionStart !== null && target.selectionStart !== undefined ? target.selectionStart : target.value.length;
            const end = target.selectionEnd !== null && target.selectionEnd !== undefined ? target.selectionEnd : target.value.length;
            const currentVal = target.value || "";
            const newVal = currentVal.substring(0, start) + char + currentVal.substring(end);

            const proto = target.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
            const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

            if (nativeSetter) {
              nativeSetter.call(target, newVal);
            } else {
              target.value = newVal;
            }

            target.dispatchEvent(new Event("input", { bubbles: true }));
            target.dispatchEvent(new Event("change", { bubbles: true }));

            try {
              target.setSelectionRange(start + 1, start + 1);
            } catch (err) {}
          }
        }
      }
    },
    true
  );
}
