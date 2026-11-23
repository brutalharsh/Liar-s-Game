"use client";

import { useState } from "react";
import { SectionTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { MuteIcon, SoundIcon } from "@/components/ui/icons";
import {
  useSettingsStore,
  VOICE_THEMES,
  voicePreset,
} from "@/store/settings";
import { useToasts } from "@/store/ui";

/**
 * SOUND — the carried-over W1 controls, reorganized: voice theme (TTS
 * presets + preview), SFX volume, captions and the emote mute-all. All of it
 * stays client-local — audio choice never crosses the wire, so this section
 * works in every session state (even barred accounts keep their knobs).
 */
export function SoundSection() {
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
    <div className="flex flex-col gap-8">
      {/* voice theme */}
      <section aria-label="Voice theme">
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
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md font-body text-xs text-ink-dim">
            Preview: “Two Aces. Trust me.” — claims, LIAR calls and kill stings all use this voice.
          </p>
          <Button variant="outline" onClick={testVoice}>
            TEST VOICE
          </Button>
        </div>
        {settings.captions && speaking && (
          <p
            className="mt-2 rounded-btn border-l-4 border-lamp bg-lamp/10 px-3 py-1 font-body text-sm italic text-lamp"
            role="status"
          >
            “Two Aces. Trust me.”
          </p>
        )}
        <p className="mt-2 font-body text-[10px] text-ink-dim">
          Browser SpeechSynthesis, tuned per theme. TTS is client-local; audio never crosses the
          wire, captions always available.
        </p>
      </section>

      {/* sfx volume */}
      <section aria-label="Sound effects volume">
        <SectionTitle kicker="the juice">Sound effects volume</SectionTitle>
        <div className="flex min-h-16 items-center gap-3 rounded-card border-2 border-wood-mid/70 bg-wood/70 p-4">
          <span aria-hidden className="text-ink-dim">
            <MuteIcon size={18} />
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.sfxVolume}
            onChange={(e) => settings.setSfxVolume(Number(e.target.value))}
            aria-label="Sound effects volume"
            className="h-12 w-full accent-brass"
          />
          <span aria-hidden className="text-ink-dim">
            <SoundIcon size={18} />
          </span>
          <span className="w-10 text-right font-display text-lg text-brass">{settings.sfxVolume}</span>
        </div>
        <p className="mt-1 font-body text-[10px] text-ink-dim">
          Card flicks, cylinder clicks, the bang, the eerie silence after a blank — full SFX arrive
          with the motion pass; the volume you set now carries over.
        </p>
      </section>

      {/* table talk toggles */}
      <section aria-label="Table talk">
        <SectionTitle kicker="table talk">Captions & emotes</SectionTitle>
        <div className="flex flex-col gap-3">
          <div className="flex min-h-16 items-center justify-between gap-4 rounded-card border-2 border-wood-mid/70 bg-wood/70 p-4">
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
          <div className="flex min-h-16 items-center justify-between gap-4 rounded-card border-2 border-wood-mid/70 bg-wood/70 p-4">
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
        </div>
      </section>
    </div>
  );
}
