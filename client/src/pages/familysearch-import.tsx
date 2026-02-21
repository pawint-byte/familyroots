import { useEffect } from "react";
import { useLocation } from "wouter";

export default function FamilySearchImportRedirect() {
  const [, navigate] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const treeId = urlParams.get("treeId") || undefined;
  
  useEffect(() => {
    const target = treeId ? `/familysearch?tab=import&treeId=${treeId}` : "/familysearch?tab=import";
    navigate(target, { replace: true });
  }, [navigate, treeId]);

  return null;
}
