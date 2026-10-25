"use client";
import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { ChevronDown, Layers, LoaderCircle, X } from "lucide-react";
type Connection = "connecting" | "ready" | "failed";
const providerNames: Record<string, string> = {
  antigravity: "Antigravity",
  codex: "Codex",
  claude: "Claude Code",
  gemini: "Gemini CLI",
};
const labelModel = (id: string) =>
  id === "gemini-3.8-flash-low" ? "Gemini 3.8 Flash" : id || "CLI default (not reported)";
type Catalog = { models: { id: string; label: string; isDefault?: boolean }[]; note: string };
type Details = {
  selected: { provider: string; model: string };
  effectiveModel: string;
  options: { id: string; installed: boolean }[];
};
async function requestConnection(body: object): Promise<Details> {
  const response = await fetch("/api/local/connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Could not read local connections.");
  return data;
}
export function ConnectionSettings({
  connection,
  preparing,
}: {
  connection: Connection;
  preparing: string;
}) {
  const [open, setOpen] = useState(false),
    [provider, setProvider] = useState("antigravity"),
    [model, setModel] = useState(""),
    [custom, setCustom] = useState(false),
    [details, setDetails] = useState<Details | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [catalogs, setCatalogs] = useState<Record<string, Catalog>>({}),
    [modelsLoading, setModelsLoading] = useState(false);
  function apply(data: Details) {
    setDetails(data);
    setProvider(data.selected.provider);
    setModel(data.selected.model);
    setCustom(false);
  }
  useEffect(() => {
    let mounted = true;
    requestConnection({})
      .then((d) => {
        if (mounted) apply(d);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (!open || loading) return;
    const abort = new AbortController();
    fetch("/api/local/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
      signal: abort.signal,
    }).then(async response => {
      if (!response.ok) throw new Error("Model lookup unavailable");
      const catalog: Catalog = await response.json();
      if (!abort.signal.aborted) setCatalogs(old => ({ ...old, [provider]: catalog }));
    }).catch(() => {
      if (!abort.signal.aborted) setCatalogs(old => ({ ...old, [provider]: { models: [], note: "Could not fetch models. Reopen this dialog to retry, or enter a model ID." } }));
    }).finally(() => {
      if (!abort.signal.aborted) setModelsLoading(false);
    });
    return () => abort.abort();
  }, [open, provider, loading]);
  const catalog = catalogs[provider];
  const defaultModel = provider === "antigravity"
    ? (details?.selected.provider === provider && !details.selected.model ? details.effectiveModel : "gemini-3.8-flash-low")
    : catalog?.models.find(item => item.isDefault)?.id || "";
  async function load() {
    setModelsLoading(true);
    setError("");
    setLoading(true);
    try {
      apply(await requestConnection({}));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not read local connections.",
      );
    } finally {
      setLoading(false);
    }
  }
  const active = details?.selected.provider;
  const pillModel = details
    ? catalogs[details.selected.provider]?.models.find(item => item.id === details.effectiveModel)?.label || labelModel(details.effectiveModel)
    : "AI connection";
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (busy) return;
        setOpen(value);
        if (value) void load();
      }}
    >
      <Dialog.Trigger
        className={`studio-ai-pill is-${connection}`}
        title={
          connection === "connecting"
            ? preparing
            : "Choose AI provider and model"
        }
        aria-label={`AI connection: ${pillModel}${active ? `, ${providerNames[active]}` : ""}`}
      >
        {connection === "connecting" ? (
          <LoaderCircle size={10} className="studio-spin" />
        ) : (
          <span className="studio-ai-dot" />
        )}
        <span className="studio-ai-model">{pillModel}</span>
        {active && (
          <span className="studio-ai-provider">{providerNames[active]}</span>
        )}
        <ChevronDown size={11} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="connection-overlay" />
        <Dialog.Content
          className="connection-dialog"
          
        >
          <header className="connection-heading">
            <Dialog.Title>AI connection</Dialog.Title>
            <Dialog.Close
              className="connection-close"
              aria-label="Close AI connection"
              disabled={busy}
            >
              <X size={14} />
            </Dialog.Close>
          </header>
          <div className="connection-body">
            <Dialog.Description>
              Use an installed CLI signed in on your Mac.
              <br />
              Models and usage follow your provider&apos;s plan.
            </Dialog.Description>
            <label className="connection-field">
              Provider
              <div className="connection-select-wrap is-provider">
                <Layers size={16} />
                <select
                  aria-label="Provider"
                  disabled={busy || loading}
                  value={provider}
                  onChange={(event) => {
                    setModelsLoading(true);
                    setProvider(event.target.value);
                    setModel("");
                    setCustom(false);
                  }}
                >
                  {(
                    details?.options ?? [{ id: "antigravity", installed: true }]
                  ).map((option) => (
                    <option
                      key={option.id}
                      value={option.id}
                      disabled={!option.installed}
                    >
                      {providerNames[option.id]}
                      {!option.installed ? " — not found" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
            <label className="connection-field">
              AI Model
              <div className="connection-select-wrap">
                <select
                  aria-label="AI Model"
                  disabled={busy || loading || modelsLoading}
                  value={custom || (model && !catalog?.models.some(item => item.id === model)) ? "__custom__" : model}
                  onChange={(event) => {
                    const next = event.target.value === "__custom__";
                    setCustom(next);
                    setModel(next ? model : event.target.value);
                  }}
                >
                  <option value="">
                    {defaultModel ? `${catalog?.models.find(item => item.id === defaultModel)?.label || labelModel(defaultModel)} · default` : "CLI default (model not reported)"}
                  </option>
                  {catalog?.models.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                  <option value="__custom__">
                    {(custom || (!!model && !catalog?.models.some(item => item.id === model))) && model ? labelModel(model) : "Custom model…"}
                  </option>
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
            <p className="connection-model-note" role="status">
              {modelsLoading ? "Fetching models from your CLI…" : catalog?.note}
            </p>
            {(custom || (!!model && !!catalog && !catalog.models.some(item => item.id === model))) && (
              <label className="connection-field connection-custom">
                Model ID
                <input
                  aria-label="Custom model ID"
                  value={model}
                  onChange={(event) => { setCustom(true); setModel(event.target.value); }}
                  maxLength={100}
                  placeholder="Enter a model available in your CLI"
                />
              </label>
            )}
            {error && (
              <p className="connection-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <footer className="connection-footer">
            <Dialog.Close className="connection-secondary" disabled={busy}>
              Close
            </Dialog.Close>
            <button
              className="connection-primary"
              disabled={busy || loading || modelsLoading}
              onClick={async () => {
                if (custom && !model.trim()) {
                  setError("Enter a model ID or choose the provider default.");
                  return;
                }
                const selectedModel = model.trim() || (provider === "codex" ? defaultModel : "");
                if (provider === "codex" && !selectedModel) {
                  setError("Select a model or enter its ID so II studio can show exactly which model it uses.");
                  return;
                }
                setBusy(true);
                setError("");
                try {
                  const next = await requestConnection({
                    provider,
                    model: selectedModel,
                  });
                  apply(next);
                  window.dispatchEvent(new Event("ii-model-change"));
                  setOpen(false);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Could not change connection.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Connecting…" : "Use connection"}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
