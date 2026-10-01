import { createFileRoute } from "@tanstack/react-router";
import { TerminalApp } from "@/components/terminal/terminal-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <TerminalApp />;
}
