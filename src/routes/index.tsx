import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, Clock, MapPin, ArrowUp, Music2, Pause, Play, VolumeX } from "lucide-react";
import corner from "@/assets/floral-corner.png";
import spray from "@/assets/floral-spray.png";

const TITLE = "Aqiqah of Shaik Muhammad Rayyan — Invitation";
const DESC =
  "Join us for the Joyous Aqiqah Celebration of Shaik Muhammad Rayyan, Sunday, October 18th, 2026 at Karishma Banquets, Hyderabad.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      // Download the song together with the page, so it is already buffered
      // and starts the instant a guest taps Open Invitation.
      {
        rel: "preload",
        as: "audio",
        type: "audio/mpeg",
        href: SONG_SOURCES[0] ?? "",
      },
    ],
  }),
  component: Index,
});

const EVENT = Date.parse("2026-10-18T19:00:00+05:30");
const VENUE = {
  name: "Karishma Banquets",
  lat: 17.3974594,
  lng: 78.4206871,
  link: "https://maps.app.goo.gl/GJ7NmbzB2Ag9nNPu7?g_st=aw",
  directions: "https://www.google.com/maps/dir/?api=1&destination=17.3974594,78.4206871",
};
const PUBLIC_MAP_EMBED =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3807.412497871617!2d78.4181121759325!3d17.397459383492723!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bcb970022a7b24d%3A0x52d7779e44dee7b0!2sKarishma%20banquet!5e0!3m2!1sen!2sin!4v1710000000000!5m2!1sen!2sin";
const MAP_EMBED = PUBLIC_MAP_EMBED;
const ease = [0.22, 1, 0.36, 1] as const;

// The song is supplied by the family. Drop the recording into public/audio/ and
// the player finds it — any of these names, any common audio format. If you have
// a direct link to the recording instead, paste it into SONG_URL and it wins.
// Until one of them exists the player stays honest: it reports the missing audio
// instead of pretending to play.
const SONG_URL = "";
const SONG_NAMES = ["rahmatun-lil-alameen-v2", "bismillah"];
const SONG_EXTS = ["mp3", "m4a", "ogg", "wav"];
// The first 7 seconds are already cut out of the file itself, so play from 0.
const SONG_START_SECONDS = 0;
const SONG_SOURCES = SONG_URL
  ? [SONG_URL]
  : SONG_NAMES.flatMap((n) => SONG_EXTS.map((e) => `/audio/${n}.${e}`));

type SongState = "idle" | "playing" | "paused" | "missing";

let songEl: HTMLAudioElement | null = null;
let songIdx = 0;
function song(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!songEl) {
    songEl = new Audio(SONG_SOURCES[0] ?? "");
    songEl.loop = true;
    songEl.preload = "auto";
    songEl.volume = 0.7;
    // Ask for the start offset before anything has loaded: the browser then
    // begins playback at the 5-second mark the very first moment it can,
    // with no separate seek round-trip after the tap.
    try {
      songEl.currentTime = SONG_START_SECONDS;
    } catch {
      /* metadata not known yet — the listeners below still seek */
    }
    const seekToStart = () => {
      if (songEl && songEl.currentTime < SONG_START_SECONDS) {
        songEl.currentTime = SONG_START_SECONDS;
      }
    };
    songEl.addEventListener("loadedmetadata", seekToStart);
    songEl.addEventListener("canplay", seekToStart);
    songEl.addEventListener("play", seekToStart);
    // When the song loops back around it restarts at 0 — snap it back to the
    // start offset so the intro is never heard again.
    songEl.addEventListener("timeupdate", () => {
      if (songEl && !songEl.paused && songEl.currentTime < SONG_START_SECONDS - 0.05) {
        songEl.currentTime = SONG_START_SECONDS;
      }
    });
    // Exposed so the start offset can be verified in the browser.
    (window as unknown as { __song?: HTMLAudioElement }).__song = songEl;
  }
  return songEl;
}
// A missing file shouldn't end it: try the next spelling, and only give up once
// every candidate has come back empty.
function nextSource(el: HTMLAudioElement): boolean {
  songIdx += 1;
  const next = SONG_SOURCES[songIdx];
  if (!next) return false;
  el.src = next;
  return true;
}

function useSong() {
  const [state, setState] = useState<SongState>("idle");
  const [muted, setMuted] = useState(false);
  const latest = useRef<SongState>("idle");
  const wanted = useRef(false);

  useEffect(() => {
    latest.current = state;
  }, [state]);

  useEffect(() => {
    const el = song();
    if (!el) return;
    const onPlay = () => setState("playing");
    const onPause = () => setState((s) => (s === "missing" ? "missing" : "paused"));
    const onError = () => {
      if (nextSource(el)) {
        if (wanted.current) el.play().catch(() => {});
        return;
      }
      setState("missing");
    };
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("error", onError);
    };
  }, []);

  const play = useCallback(() => {
    if (latest.current === "missing") return;
    const el = song();
    if (!el) return;
    wanted.current = true;
    // Snap to the start offset on every press, so a guest never hears the
    // intro even if the file only finished loading now or had looped to 0.
    try {
      if (el.currentTime < SONG_START_SECONDS) el.currentTime = SONG_START_SECONDS;
    } catch {
      /* not seekable yet — playback still begins right away */
    }
    const p = el.play();
    if (p) p.catch(() => setState((s) => (s === "missing" ? "missing" : "paused")));
  }, []);

  const toggle = useCallback(() => {
    const el = song();
    if (!el || latest.current === "missing") return;
    if (el.paused) {
      wanted.current = true;
      play();
    } else {
      wanted.current = false;
      el.pause();
    }
  }, [play]);

  const toggleMute = useCallback(() => {
    const el = song();
    if (!el) return;
    setMuted((m) => {
      el.muted = !m;
      return !m;
    });
  }, []);

  return { state, muted, play, toggle, toggleMute };
}

function Index() {
  const [opened, setOpened] = useState(false);
  const music = useSong();

  const open = useCallback(() => {
    music.play();
    window.setTimeout(() => setOpened(true), 2900);
  }, [music]);

  return (
    <MotionConfig reducedMotion="user">
      <main className="paper min-h-[100svh]">
        <AnimatePresence mode="wait">
          {!opened ? <Envelope key="env" onOpen={open} /> : <Invitation key="inv" />}
        </AnimatePresence>
        {opened && (
          <MusicControl
            state={music.state}
            muted={music.muted}
            onToggle={music.toggle}
            onMute={music.toggleMute}
          />
        )}
      </main>
    </MotionConfig>
  );
}

function Envelope({ onOpen }: { onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const tap = () => {
    if (open) return;
    setOpen(true);
    onOpen();
  };
  return (
    <motion.section
      exit={{ opacity: 0, scale: 1.08, transition: { duration: 0.8, ease } }}
      className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6"
    >
      <img
        src={corner}
        alt=""
        width={1024}
        height={1024}
        className="pointer-events-none absolute -right-10 -top-10 w-56 opacity-80"
      />
      <img
        src={corner}
        alt=""
        width={1024}
        height={1024}
        className="pointer-events-none absolute -bottom-10 -left-10 w-56 rotate-180 opacity-80"
      />

      <motion.button
        onClick={tap}
        aria-label="Open invitation"
        initial={{ opacity: 0, y: 20 }}
        animate={open ? { scale: 1.06, y: 30 } : { opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease }}
        whileTap={{ scale: 0.98 }}
        className="relative aspect-[4/3] w-[min(86vw,380px)] [perspective:1200px]"
      >
        {/* back */}
        <div className="absolute inset-0 rounded-sm bg-champagne" />
        {/* card emerging */}
        <motion.div
          initial={{ y: 0, opacity: 0 }}
          animate={open ? { y: "-55%", opacity: 1 } : { y: 0, opacity: 0 }}
          transition={{ delay: 1, duration: 1.4, ease }}
          className="absolute inset-x-[7%] top-[8%] bottom-[8%] flex flex-col items-center justify-center bg-ivory shadow-sm"
        >
          <span className="font-script text-3xl text-botanical">Rayyan</span>
          <span className="mt-1 h-px w-12 bg-gold" />
        </motion.div>
        {/* front pocket */}
        <div
          className="absolute inset-0 bg-cream"
          style={{ clipPath: "polygon(0 35%, 50% 68%, 100% 35%, 100% 100%, 0 100%)" }}
        />
        <div
          className="absolute inset-0 border border-gold/40"
          style={{ clipPath: "polygon(0 35%, 50% 68%, 100% 35%, 100% 100%, 0 100%)" }}
        />
        <img
          src={spray}
          alt=""
          width={1536}
          height={640}
          className="absolute bottom-2 left-1/2 w-3/4 -translate-x-1/2 opacity-90"
        />
        {/* flap */}
        <motion.div
          animate={open ? { rotateX: 180, zIndex: 0 } : { rotateX: 0, zIndex: 10 }}
          transition={{ duration: 1.2, ease }}
          style={{ transformOrigin: "top", clipPath: "polygon(0 0, 100% 0, 50% 62%)" }}
          className="absolute inset-x-0 top-0 h-full bg-champagne"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-cream to-champagne" />
        </motion.div>
        {/* seal */}
        <motion.div
          animate={open ? { opacity: 0, scale: 0.6 } : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="absolute left-1/2 top-[62%] z-20 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gold shadow-md ring-4 ring-gold/30"
        >
          <span className="font-script text-2xl text-ivory">R</span>
        </motion.div>
      </motion.button>

      <motion.div animate={{ opacity: open ? 0 : 1 }} className="mt-10 text-center">
        <p className="font-script text-4xl text-botanical">You're Invited</p>
        <motion.button
          onClick={tap}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.9, ease }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="mt-6 inline-flex min-h-[54px] items-center justify-center gap-3 border border-gold bg-botanical px-9 py-4 font-display text-xs uppercase tracking-[0.3em] text-ivory shadow-sm transition-colors hover:bg-cocoa"
        >
          <span className="h-px w-5 bg-gold" />
          Open Invitation
          <span className="h-px w-5 bg-gold" />
        </motion.button>
      </motion.div>

      <button
        onClick={tap}
        className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] font-display text-[11px] uppercase tracking-[0.3em] text-cocoa/60 hover:text-cocoa"
      >
        Skip Intro
      </button>
    </motion.section>
  );
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.9, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Divider() {
  return (
    <div className="mx-auto my-6 flex items-center justify-center gap-3 text-gold">
      <span className="h-px w-14 bg-gradient-to-r from-transparent to-gold" />
      <svg width="14" height="14" viewBox="0 0 14 14" className="fill-current">
        <path d="M7 0l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
      </svg>
      <span className="h-px w-14 bg-gradient-to-l from-transparent to-gold" />
    </div>
  );
}

function Corners() {
  return (
    <>
      <motion.img
        animate={{ rotate: [0, 1.5, 0] }}
        transition={{ repeat: Infinity, duration: 8 }}
        src={corner}
        alt=""
        width={1024}
        height={1024}
        className="pointer-events-none absolute -right-6 -top-6 w-32 sm:w-40"
      />
      <motion.img
        animate={{ rotate: [180, 181.5, 180] }}
        transition={{ repeat: Infinity, duration: 9 }}
        src={corner}
        alt=""
        width={1024}
        height={1024}
        className="pointer-events-none absolute -bottom-6 -left-6 w-32 sm:w-40"
      />
    </>
  );
}

function Invitation() {
  const top = useRef<HTMLDivElement>(null);
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.2, ease }}
      className="mx-auto w-full max-w-md px-4 py-8 sm:py-14"
    >
      <article
        ref={top}
        className="ornate-border relative overflow-hidden bg-ivory px-7 py-16 text-center"
      >
        <Corners />
        <Reveal>
          <p dir="rtl" lang="ar" className="font-arabic text-3xl leading-[2] text-botanical">
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </p>
        </Reveal>
        <Divider />
        <Reveal delay={0.1}>
          <p className="font-display text-base font-semibold uppercase leading-relaxed tracking-[0.18em] text-botanical text-balance">
            Mr &amp; Mrs Abdul Reyaz and Raafia Shaik
          </p>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mt-4 font-body italic tracking-wide text-cocoa">
            Invite u to join us for a
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <h1 className="mt-4 font-display text-4xl font-medium leading-tight text-botanical">
            Joyous Aqiqah Celebration
          </h1>
        </Reveal>
        <Reveal delay={0.4}>
          <p className="mt-3 font-script text-3xl text-sage">In honor of our Little Prince</p>
        </Reveal>

        <Reveal delay={0.5} className="relative my-10">
          <motion.span
            aria-hidden
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8, duration: 1.6 }}
            className="pointer-events-none absolute inset-x-[-2rem] top-1/2 h-44 -translate-y-1/2"
            style={{
              background:
                "radial-gradient(ellipse at center, color-mix(in oklab, var(--gold) 26%, transparent), transparent 70%)",
            }}
          />
          <img
            src={spray}
            alt=""
            width={1536}
            height={640}
            loading="lazy"
            className="mx-auto -mb-6 w-64 opacity-90"
          />
          <motion.h2
            initial={{ opacity: 0, y: 26, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, delay: 0.7, ease }}
            className="relative font-display text-[2.6rem] font-semibold leading-[1.1] text-cocoa text-balance"
          >
            Shaik Muhammad Rayyan
          </motion.h2>
          <motion.span
            aria-hidden
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 1.5, ease }}
            className="relative mx-auto mt-4 block h-px w-28 origin-center bg-gold"
          />
          <Divider />
        </Reveal>

        <Reveal>
          <div className="flex items-center justify-center gap-2 text-gold">
            <CalendarDays size={16} strokeWidth={1.25} />
          </div>
          <p className="mt-2 font-display text-xl font-semibold uppercase tracking-[0.15em] text-botanical">
            Sunday, October 18th, 2026
          </p>
          <p className="mt-2 flex items-center justify-center gap-2 font-display text-sm uppercase tracking-[0.3em] text-cocoa">
            <Clock size={14} strokeWidth={1.25} className="text-gold" /> From 7 PM Onwards
          </p>
          <Countdown />
        </Reveal>
        <Divider />

        <Reveal>
          <MapPin size={18} strokeWidth={1.25} className="mx-auto text-gold" />
          <p className="mt-2 font-display text-xs uppercase tracking-[0.4em] text-sage">Venue</p>
          <h3 className="mt-2 font-display text-3xl font-medium text-botanical">{VENUE.name}</h3>
          <p className="mt-2 leading-relaxed text-cocoa">
            Al Hasanath Colony, Tolichowki,
            <br />
            Hyderabad, Telangana.
          </p>
          <div className="mt-6 overflow-hidden rounded-sm border border-gold/40 shadow-sm">
            <iframe
              title={`Map to ${VENUE.name}, Tolichowki, Hyderabad`}
              src={MAP_EMBED}
              loading="lazy"
              tabIndex={-1}
              className="h-60 w-full border-0"
            />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <motion.a
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              href={VENUE.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block border border-gold px-7 py-3 font-display text-xs uppercase tracking-[0.3em] text-botanical transition-colors hover:bg-botanical hover:text-ivory"
            >
              View Location
            </motion.a>
            <a
              href={VENUE.directions}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display text-[11px] uppercase tracking-[0.3em] text-cocoa/70 underline decoration-gold decoration-1 underline-offset-4 hover:text-botanical"
            >
              Get Directions
            </a>
          </div>
        </Reveal>
      </article>

      <section className="ornate-border relative mt-8 bg-ivory px-7 py-14 text-center">
        <Reveal>
          <p className="font-display text-sm font-semibold uppercase leading-relaxed tracking-[0.25em] text-botanical">
            Best Compliments from Grand Parents
          </p>
          <Divider />
          <ul className="grid gap-4 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-5">
            <li>Abdul Rasheed Saheb</li>
            <li>Hidayatunnisa Begum</li>
            <li>Shaik Subani Saheb</li>
            <li>Shaik Shakeela Begum</li>
          </ul>
        </Reveal>
      </section>

      <section className="relative mt-8 overflow-hidden bg-cream px-7 pb-[max(3.5rem,env(safe-area-inset-bottom))] pt-14 text-center">
        <Reveal>
          <img
            src={spray}
            alt=""
            width={1536}
            height={640}
            loading="lazy"
            className="mx-auto w-60"
          />
          <p className="mt-2 font-display text-xl italic leading-relaxed text-cocoa">
            We look forward to celebrating this special occasion with you.
          </p>
          <p className="mt-6 font-script text-3xl text-sage">With love and duas</p>
          <p className="mt-1 font-display text-lg uppercase tracking-[0.15em] text-botanical">
            Shaik Muhammad Rayyan's Family
          </p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => top.current?.scrollIntoView({ behavior: "smooth" })}
            className="mt-8 inline-flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.3em] text-cocoa/70 hover:text-botanical"
          >
            <ArrowUp size={12} /> Back to Invitation
          </motion.button>
        </Reveal>
      </section>
    </motion.div>
  );
}

function MusicControl({
  state,
  muted,
  onToggle,
  onMute,
}: {
  state: SongState;
  muted: boolean;
  onToggle: () => void;
  onMute: () => void;
}) {
  const missing = state === "missing";
  const playing = state === "playing";
  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 flex items-end gap-2">
      {missing && (
        <span className="max-w-[10rem] rounded-sm border border-gold/40 bg-ivory/95 px-3 py-2 text-[10px] uppercase leading-relaxed tracking-[0.16em] text-cocoa/80 shadow-sm">
          Song file not added yet
        </span>
      )}
      <div className="flex items-center gap-1 rounded-full border border-gold/50 bg-ivory/95 p-1 shadow-md">
        <button
          onClick={onToggle}
          aria-label={playing ? "Pause the song" : "Play the song"}
          aria-pressed={playing}
          className="grid h-11 w-11 place-items-center rounded-full text-botanical transition-colors hover:bg-champagne/60"
        >
          {playing ? <Pause size={18} strokeWidth={1.5} /> : <Play size={18} strokeWidth={1.5} />}
        </button>
        <button
          onClick={onMute}
          disabled={missing}
          aria-label={muted ? "Unmute the song" : "Mute the song"}
          aria-pressed={muted}
          className="grid h-9 w-9 place-items-center rounded-full text-cocoa/70 transition-colors hover:bg-champagne/60 disabled:opacity-40"
        >
          {muted ? <VolumeX size={16} strokeWidth={1.5} /> : <Music2 size={16} strokeWidth={1.5} />}
        </button>
      </div>
    </div>
  );
}

function Countdown() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <div className="mt-6 h-12" />;
  const diff = EVENT - now;
  if (diff <= 0)
    return (
      <p className="mt-6 font-script text-2xl text-sage">
        Alhamdulillah, the celebration has taken place
      </p>
    );
  const parts = [
    [Math.floor(diff / 864e5), "Days"],
    [Math.floor(diff / 36e5) % 24, "Hours"],
    [Math.floor(diff / 6e4) % 60, "Mins"],
    [Math.floor(diff / 1e3) % 60, "Secs"],
  ] as const;
  return (
    <div className="mt-6 flex justify-center gap-5">
      {parts.map(([v, l]) => (
        <div key={l}>
          <div className="font-display text-2xl tabular-nums text-botanical">
            {String(v).padStart(2, "0")}
          </div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-sage">{l}</div>
        </div>
      ))}
    </div>
  );
}
