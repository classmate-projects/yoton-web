"use client";

import { useEffect } from "react";

// Applies autocomplete="off" to every input/select/textarea in the DOM and watches
// for new ones added later via MutationObserver. This prevents browsers from
// pre-filling form fields with saved values across the whole app.
// Password fields are intentionally excluded — they use explicit autoComplete values
// ("new-password", "current-password") managed by PasswordInput and each call site.
function disableAutocomplete(root: Element | Document = document) {
  const fields = (root instanceof Element ? root : document).querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >("input:not([type='password']), select, textarea");
  fields.forEach((el) => {
    if (!el.hasAttribute("autocomplete")) {
      el.setAttribute("autocomplete", "off");
    }
  });
}

export default function DisableAutocomplete() {
  useEffect(() => {
    disableAutocomplete();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            disableAutocomplete(node);
            node
              .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
                "input:not([type='password']), select, textarea"
              )
              .forEach((el) => {
                if (!el.hasAttribute("autocomplete")) {
                  el.setAttribute("autocomplete", "off");
                }
              });
          }
        });
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
