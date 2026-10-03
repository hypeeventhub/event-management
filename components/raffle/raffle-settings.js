"use client";

import { ArrowLeft, FileUp, LoaderCircle, Save, Trash2, Upload, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { parseRaffleNamesFromCsv, parseRaffleNamesFromWorkbook } from "@/lib/raffle-name-import.mjs";
import { RAFFLE_THEMES } from "@/lib/raffle-themes.mjs";
import api from "@/lib/api";

export function RaffleSettings({ endpoint, initialEntries, initialSettings, winners, winnerPagination, saving, error, onBack, onSave, onUploadLogo, onRemoveLogo }) {
  const [names, setNames] = useState(initialEntries.map((entry) => entry.name).join("\n"));
  const [settings, setSettings] = useState(initialSettings);
  const [importError, setImportError] = useState("");
  const [history, setHistory] = useState(winners);
  const [pagination, setPagination] = useState(winnerPagination);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [logoUrl, setLogoUrl] = useState(initialSettings.logo_url || "");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(initialSettings.logo_url || "");
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState("");
  const inputRef = useRef(null);
  const logoInputRef = useRef(null);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(logoUrl);
      return undefined;
    }

    const previewUrl = URL.createObjectURL(logoFile);
    setLogoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [logoFile, logoUrl]);

  async function importFile(event) {
    const file = event.target.files?.[0]; if (!file) return;
    setImportError("");
    try {
      const imported = file.name.toLowerCase().endsWith(".csv")
        ? parseRaffleNamesFromCsv(await file.text())
        : await parseRaffleNamesFromWorkbook(await file.arrayBuffer());
      setNames((current) => [current.trim(), ...imported].filter(Boolean).join("\n"));
    } catch (error) { setImportError(error.message || "The file could not be imported."); }
    finally { event.target.value = ""; }
  }

  async function loadMoreWinners() {
    if (!pagination || pagination.current_page >= pagination.last_page || loadingHistory) return;
    setLoadingHistory(true);
    try {
      const payload = (await api.get(`${endpoint}?winners_page=${pagination.current_page + 1}`)).data.data;
      setHistory((current) => [...current, ...payload.winners]);
      setPagination(payload.winner_pagination);
    } catch { setImportError("More winner history could not be loaded."); }
    finally { setLoadingHistory(false); }
  }

  function selectLogo(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setLogoFile(null);
      setLogoError("Choose a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoFile(null);
      setLogoError("The logo must be 2 MB or smaller.");
      return;
    }

    setLogoError("");
    setLogoFile(file);
  }

  async function uploadLogo() {
    if (!logoFile || logoBusy) return;
    setLogoBusy(true);
    setLogoError("");
    try {
      const savedUrl = await onUploadLogo(logoFile);
      setLogoUrl(savedUrl || "");
      setLogoFile(null);
    } catch (requestError) {
      setLogoError(requestError.response?.data?.message || "The logo could not be uploaded.");
    } finally {
      setLogoBusy(false);
    }
  }

  async function removeLogo() {
    if (logoBusy) return;
    if (logoFile) {
      setLogoFile(null);
      setLogoError("");
      return;
    }

    setLogoBusy(true);
    setLogoError("");
    try {
      await onRemoveLogo();
      setLogoUrl("");
    } catch (requestError) {
      setLogoError(requestError.response?.data?.message || "The logo could not be removed.");
    } finally {
      setLogoBusy(false);
    }
  }

  return (
    <main className="min-h-screen overflow-y-auto bg-[#6f3faa] px-5 py-7 text-white sm:px-10">
      <div className="mx-auto max-w-3xl space-y-7">
        <div className="flex items-center justify-between"><button type="button" onClick={onBack} className="rounded-full p-2 hover:bg-white/10" aria-label="Back to raffle"><ArrowLeft /></button><h1 className="text-4xl font-light">Settings</h1><span className="w-10" /></div>
        {error && <p role="alert" className="rounded bg-red-950/40 px-4 py-3 text-sm">{error}</p>}
        <section>
          <div className="mb-3 flex items-center justify-between"><label htmlFor="raffle-names" className="text-lg">Names</label><button type="button" onClick={() => inputRef.current?.click()} className="flex items-center gap-2 text-lg hover:underline"><FileUp className="size-5" />Import CSV</button></div>
          <textarea id="raffle-names" value={names} onChange={(event) => setNames(event.target.value)} className="min-h-64 w-full resize-y rounded-lg bg-white p-4 text-lg leading-7 text-[#27163c] outline-none ring-white/40 focus:ring-4" placeholder={'Pedro\nJuan\nJose'} />
          <input ref={inputRef} hidden type="file" accept=".csv,.xlsx" onChange={importFile} />
          {importError && <p role="alert" className="mt-2 rounded bg-red-950/40 px-3 py-2 text-sm">{importError}</p>}
        </section>
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg">Logo <span className="text-sm text-white/65">(optional)</span></h2>
              <p className="text-sm text-white/70">Shown centered below the name picker.</p>
            </div>
            <button type="button" onClick={() => logoInputRef.current?.click()} className="flex items-center gap-2 text-base hover:underline"><FileUp className="size-5" />Choose image</button>
          </div>
          <input ref={logoInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={selectLogo} />
          <div className="flex min-h-36 items-center justify-center rounded-lg bg-white/95 p-4 sm:min-h-44">
            {logoPreview ? <Image src={logoPreview} alt="Raffle logo preview" width={640} height={320} unoptimized className="h-auto w-auto max-h-32 max-w-full object-contain sm:max-h-40" /> : <p className="text-center text-sm text-[#6f5285]">No logo uploaded</p>}
          </div>
          {logoFile && <p className="break-all text-xs text-white/75">Selected: {logoFile.name}</p>}
          {logoError && <p role="alert" className="rounded bg-red-950/40 px-3 py-2 text-sm">{logoError}</p>}
          <div className="flex flex-wrap gap-2">
            {logoFile && <button type="button" onClick={uploadLogo} disabled={logoBusy} className="flex items-center gap-2 rounded-lg bg-[#f7dd4c] px-4 py-2.5 font-bold text-[#382054] disabled:opacity-60">{logoBusy ? <LoaderCircle className="animate-spin" /> : <Upload className="size-4" />}{logoBusy ? "Uploading..." : "Upload logo"}</button>}
            {(logoUrl || logoFile) && <button type="button" onClick={removeLogo} disabled={logoBusy} className="flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2.5 font-semibold disabled:opacity-60">{logoFile ? <X className="size-4" /> : <Trash2 className="size-4" />}{logoFile ? "Clear selection" : "Remove logo"}</button>}
          </div>
        </section>
        <label className="flex items-center justify-between text-lg"><span>Remove Winners</span><span className={`relative h-7 w-12 rounded-full transition ${settings.remove_winners ? "bg-[#f7dd4c]" : "bg-white/45"}`}><input type="checkbox" checked={settings.remove_winners} onChange={(event) => setSettings({ ...settings, remove_winners: event.target.checked })} className="peer sr-only" /><span className={`absolute top-1 size-5 rounded-full bg-white shadow transition ${settings.remove_winners ? "left-6" : "left-1"}`} /></span></label>
        <label className="grid gap-3 text-lg"><span>Raffle Speed</span><input type="range" min="1" max="5" value={settings.speed} onChange={(event) => setSettings({ ...settings, speed: Number(event.target.value) })} className="accent-[#f7dd4c]" /></label>
        <section><h2 className="mb-4 text-lg">Themes</h2><div className="grid grid-cols-5 gap-5">{RAFFLE_THEMES.map((theme) => <button key={theme.key} type="button" onClick={() => setSettings({ ...settings, theme: theme.key })} aria-label={`${theme.key} theme`} aria-pressed={settings.theme === theme.key} className="aspect-square rounded-full border-4 shadow" style={{ background: theme.background, borderColor: settings.theme === theme.key ? theme.accent : "rgba(255,255,255,.75)" }} />)}</div></section>
        <section><h2 className="mb-4 text-lg">Winners</h2><div className="space-y-2">{history.length === 0 ? <div className="rounded bg-white/80 p-4 text-[#433255]">No confirmed winners yet.</div> : history.map((winner) => <div key={winner.id} className="flex justify-between rounded bg-white/85 px-4 py-3 text-[#433255]"><span className="font-semibold">{winner.name}</span><time className="text-sm">{new Date(winner.won_at).toLocaleString()}</time></div>)}</div>{pagination?.current_page < pagination?.last_page && <button type="button" disabled={loadingHistory} onClick={loadMoreWinners} className="mt-3 w-full rounded bg-white/15 px-4 py-3 font-semibold disabled:opacity-60">{loadingHistory ? "Loading..." : "Load more winners"}</button>}</section>
        <button type="button" disabled={saving} onClick={() => onSave({ names: names.split(/\r?\n/), ...settings })} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#f7dd4c] px-5 py-4 font-bold text-[#382054] disabled:opacity-60">{saving ? <LoaderCircle className="animate-spin" /> : <Save />}{saving ? "Saving..." : "Save Settings"}</button>
      </div>
    </main>
  );
}
