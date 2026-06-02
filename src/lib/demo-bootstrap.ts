import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listConferences } from "@/lib/conferences.functions";
import { loadDemoState } from "@/lib/demo-data";

const BOOTSTRAP_FLAG = "grain-radar.demo-bootstrap.v1";

/**
 * On the very first visit from a fresh browser, hydrate the app with
 * "State C · After the session" so anyone opening the published link
 * sees the populated meetings / follow-ups workflow instead of an empty
 * shell. Runs once per browser; users can still switch states from
 * Settings afterwards.
 */
export function useDemoBootstrap() {
  const fetchConfs = useServerFn(listConferences);
  const { data: conferences = [] } = useQuery({
    queryKey: ["conferences"],
    queryFn: () => fetchConfs(),
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(BOOTSTRAP_FLAG)) return;
    if (conferences.length === 0) return;
    window.localStorage.setItem(BOOTSTRAP_FLAG, "1");
    void loadDemoState("C", conferences);
  }, [conferences]);
}
