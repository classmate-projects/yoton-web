"use client";

import { useEffect, useState } from "react";
import { FormTemplateService } from "@/services/medicalForm.service";
import { FormPlaceholderType } from "@/types/medicalForm.type";

// The medical form {{placeholder}} list - empty until loaded, and stays empty if the user has
// no access to it (tokens then simply show as typed).
export function usePlaceholderCatalog(): FormPlaceholderType[] {
  const [catalog, setCatalog] = useState<FormPlaceholderType[]>([]);

  useEffect(() => {
    let isMounted = true;
    FormTemplateService.getPlaceholderCatalog()
      .then((list) => isMounted && setCatalog(list))
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  return catalog;
}
