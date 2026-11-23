"use client";

import { useState } from "react";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import {
  useSettingsStore,
  VOICE_THEMES,
  voicePreset,
  type VoiceThemeId,
} from "@/store/settings";
import { useToasts } from "@/store/ui";

/**
 * Settings (STR/02 v1): voice theme + TTS preview ("Two Aces. Trust me."),
 * sfx volume, captions, reduced motion, emote mute-all.
 */
export function SettingsView() {
  const settings = useSettingsStore();
  const push = useToasts();
  const [speaking, setSpeaking] = useState(false);

  const testVoice = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      push({ title: "Speech synthesis not available here", tone: "bad" });
      return;
    }
    const preset = voicePreset(settings.voiceTheme);
    const utter = new SpeechSynthesisUtterance("Two Aces. Trust me.");
    utter.pitch = preset.pitch;
    utter.rate = preset.rate;
    utter.onend = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
    push({ title: `Testing ${preset.label} voice`, tone: "info" });
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 py-8">
      <section className="text-center">
        <h1 className="font-display text-4xl text-ivory md:text-5xl">Settings</h1>
        <p className="mt-2 font-body text-sm text-ink-dim">Tune the table to your taste.</p>
      </section>

      {/* voice theme */}
      <Panel className="p-5">
        <SectionTitle kicker="spoken lines">Voice theme</SectionTitle>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4" role="radiogroup" aria-label="Voice theme">
          {VOICE_THEMES.map((theme) => {
            const active = settings.voiceTheme === theme.id;
            return (
              <button
                key={theme.id}
                role="radio"
                aria-checked={active}
                onClick={() => settings.setVoiceTheme(theme.id)}
                className={`flex min-h-20 flex-col items-start gap-1 rounded-card border-2 p-3 text-left ${
                  active ? "border-brass bg-brass/10" : "border-wood-mid bg-wood-deep/50 hover:border-brass"
                }`}
              >
                <span className="font-display text-base text-ivory">{theme.label}</span>
                <span className="font-body text-[10px] text-ink-dim">{theme.desc}</span>
                <span className="font-body text-[9px] text-lamp">
                  pitch {theme.pitch} · rate {theme.rate}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="font-body text-xs text-ink-dim">
            Preview: “Two Aces. Trust me.” — claims, LIAR calls and kill stings all use this voice.
          </p>
          <Button variant="outline" onClick={testVoice}>
            {speaking ? "▮▮ SPEAKING…" : "🔈 TEST VOICE"}
          </Button>
        </div>
        {settings.captions && speaking && (
          <p className="mt-2 rounded-btn border-l-4 border-lamp bg-lamp/10 px-3 py-1 font-body text-sm italic text-lamp">
            “Two Aces. Trust me.”
          </p>
        )}
        <p className="mt-2 font-body text-[10px] text-ink-dim">
          Browser SpeechSynthesis, tuned per theme. TTS is client-local; audio never crosses the
          wire, captions always available.
        </p>
      </Panel>

      {/* sfx volume */}
      <Panel className="p-5">
        <SectionTitle kicker="the juice">Sound effects volume</SectionTitle>
        <div className="flex items-center gap-3">
          <span aria-hidden>🔇</span>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.sfxVolume}
            onChange={(e) => settings.setSfxVolume(Number(e.target.value))}
            aria-label="Sound effects volume"
            className="h-12 w-full accent-brass"
          />
          <span aria-hidden>🔊</span>
          <span className="w-10 text-right font-display text-lg text-brass">{settings.sfxVolume}</span>
        </div>
        <p className="mt-1 font-body text-[10px] text-ink-dim">
          Card flicks, cylinder clicks, the bang, the eerie silence after a blank — full SFX
          arrive with the motion pass; the volume you set now carries over.
        </p>
      </Panel>

      {/* toggles */}
      <Panel className="flex flex-col gap-4 p-5">
        <SectionTitle kicker="comfort">Table talk & motion</SectionTitle>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-base text-ivory">Captions</p>
            <p className="font-body text-xs text-ink-dim">Text of every spoken line, always available.</p>
          </div>
          <Switch
            id="captions"
            checked={settings.captions}
            onChange={settings.setCaptions}
            label="Captions"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-base text-ivory">Reduced motion</p>
            <p className="font-body text-xs text-ink-dim">
              Screen shake becomes a vignette flash, cards crossfade, confetti becomes candlelight.
              Overrides the system preference when on.
            </p>
          </div>
          <Switch
            id="reduced-motion"
            checked={settings.reducedMotion}
            onChange={settings.setReducedMotion}
            label="Reduced motion"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-base text-ivory">Mute all emotes</p>
            <p className="font-body text-xs text-ink-dim">
              Silence every bubble, yours and theirs — it IS the table talk, so use sparingly.
            </p>
          </div>
          <Switch
            id="emote-mute"
            checked={settings.emoteMuted}
            onChange={settings.setEmoteMuted}
            label="Mute all emotes"
          />
        </div>
      </Panel>

      <Panel tone="deep" className="p-5 text-center">
        <p className="font-display text-lg text-ivory">Liar's Game</p>
        <p className="mt-1 font-body text-xs text-ink-dim">
          v0.1.0 — mock-first build. Installable PWA: use your browser's "Add to Home Screen".
          Your guest identity, wallet and settings live in this browser's storage until accounts
          arrive.
        </p>
      </Panel>
    </div>
  );
}
