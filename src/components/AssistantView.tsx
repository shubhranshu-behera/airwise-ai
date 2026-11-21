import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Cpu,
  Mic,
  MicOff,
  Send,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { AqiStandard, ChatMessage, CityLocation, LanguageCode } from '../types';

interface AssistantViewProps {
  city: CityLocation;
  standard: AqiStandard;
  language: LanguageCode;
  onChangeLanguage: (lang: LanguageCode) => void;
  pendingPrompt?: string | null;
  onConsumePendingPrompt?: () => void;
  compact?: boolean;
}

const SAMPLE_PROMPTS: Record<LanguageCode, string[]> = {
  en: [
    'Can my child play outside tomorrow morning?',
    'What HEPA purifier CADR do I need for my bedroom tonight?',
    'Compare metro vs cycling for a 10 km commute today.',
    'Explain today’s pollution trend, smog risk, and best ventilation window.',
  ],
  hi: [
    'क्या मेरा बच्चा कल सुबह बाहर खेल सकता है?',
    'आज 10 km ऑफिस यात्रा के लिए मेट्रो और साइकिल की तुलना करें।',
    'मेरे बेडरूम के लिए एयर प्यूरीफायर और वेंटिलेशन का सही समय बताएं।',
  ],
  or: [
    'ମୋ ପିଲା କାଲି ସକାଳେ ବାହାରେ ଖେଳିପାରିବ କି?',
    'ଆଜିର ବାୟୁ ଗୁଣବତ୍ତା ଅନୁସାରେ ଘର ଭିତର ବାୟୁ କିପରି ସଫା ରଖିବି?',
    'ଆଜି ଅଫିସ୍ ଯିବା ପାଇଁ ସବୁଠୁ କମ୍ ପ୍ରଦୂଷଣ ଯାତ୍ରା ବିକଳ୍ପ କଣ?',
  ],
};

export function AssistantView({
  city,
  standard,
  language,
  onChangeLanguage,
  pendingPrompt,
  onConsumePendingPrompt,
  compact = false,
}: AssistantViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api
      .getChatHistory()
      .then((res) => setMessages(res.messages))
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    if (pendingPrompt) {
      handleSend(pendingPrompt);
      onConsumePendingPrompt?.();
    }
  }, [pendingPrompt]);

  async function handleSend(customPrompt?: string) {
    const text = (customPrompt ?? input).trim();
    if (!text || sending) return;

    setError(null);
    if (!customPrompt) setInput('');

    const optimisticUser: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: text,
      language,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setSending(true);

    try {
      const res = await api.sendAiChat({ prompt: text, city, standard, language });
      setMessages((prev) => [...prev, res.message]);
    } catch (err: any) {
      setError(err?.message || 'Unable to reach AIRWISE Multi-Agent AI.');
    } finally {
      setSending(false);
    }
  }

  function toggleVoiceInput() {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setError('Voice input is not supported in this browser.');
      return;
    }
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    const rec = new SpeechRec();
    rec.lang = language === 'hi' ? 'hi-IN' : language === 'or' ? 'or-IN' : 'en-IN';
    rec.interimResults = false;
    rec.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) setInput(transcript);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  function speakText(text: string, lang: LanguageCode) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang === 'hi' ? 'hi-IN' : lang === 'or' ? 'or-IN' : 'en-IN';
    window.speechSynthesis.speak(utter);
  }

  async function handleClear() {
    await api.clearChatHistory().catch(() => {});
    setMessages([]);
  }

  return (
    <div
      className={`flex flex-col rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] overflow-hidden ${
        compact ? 'h-[540px]' : 'h-[calc(100vh-170px)] min-h-[580px]'
      }`}
    >
      {/* Header Toolbar */}
      <div className="px-5 py-3.5 border-b border-[var(--aw-border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--aw-bg-secondary)]">
        <div>
          <h2 className="font-display text-sm font-bold text-[var(--aw-text)]">
            AIRWISE Multi-Agent Air Assistant
          </h2>
          <p className="text-xs text-[var(--aw-text-secondary)]">
            Context: {city.name} · 8 Specialized Agents + CPCB/WHO RAG
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)]">
            {(
              [
                { code: 'en', label: 'EN' },
                { code: 'hi', label: 'हिन्दी' },
                { code: 'or', label: 'ଓଡ଼ିଆ' },
              ] as const
            ).map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => onChangeLanguage(l.code)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  language === l.code
                    ? 'bg-[#00C9A7] text-[#05181C]'
                    : 'text-[var(--aw-text-secondary)] hover:text-[var(--aw-text)]'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              title="Clear conversation history"
              className="p-2 rounded-lg text-[var(--aw-text-secondary)] hover:text-[#EF4444] hover:bg-white/5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation Feed */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {messages.length === 0 && (
          <div className="py-6 space-y-5 max-w-2xl mx-auto">
            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-semibold text-[var(--aw-text)]">
                Ask about air conditions, family safety, indoor air, or clean commutes.
              </h3>
              <p className="text-sm text-[var(--aw-text-secondary)]">
                Every answer orchestrates live telemetry tools, 72-hour forecasting, and grounded CPCB/WHO/EPA
                guidelines in English, Hindi, or Odia.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SAMPLE_PROMPTS[language].map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(q)}
                  className="text-left p-3.5 rounded-lg border border-[var(--aw-border)] bg-[var(--aw-bg)] hover:border-[#00C9A7]/60 text-xs text-[var(--aw-text)] leading-relaxed transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const traceOpen = expandedTraceId === msg.id;

          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[88%] rounded-xl px-4 py-3.5 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-[#00C9A7] text-[#05181C] font-medium'
                    : 'bg-[var(--aw-bg)] border border-[var(--aw-border)] text-[var(--aw-text)]'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Structured Action Plan */}
                {!isUser && msg.structuredActions && msg.structuredActions.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[var(--aw-border)] space-y-2.5">
                    <div className="text-xs font-semibold text-[#00C9A7]">Recommended Actions</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {msg.structuredActions.map((act, i) => (
                        <div key={i} className="p-3 rounded-lg bg-[var(--aw-surface)] border border-[var(--aw-border)]">
                          <div className="text-xs font-semibold text-[var(--aw-text)]">{act.title}</div>
                          <div className="font-mono-num text-[11px] text-[#39BDF8] mt-0.5">{act.timing}</div>
                          <p className="text-xs text-[var(--aw-text-secondary)] mt-1">{act.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Uncertainty & Grounding Note */}
                {!isUser && msg.uncertaintyNote && (
                  <p className="mt-3 pt-2.5 border-t border-[var(--aw-border)] text-[11px] text-[var(--aw-text-secondary)]">
                    {msg.uncertaintyNote}
                  </p>
                )}

                {/* Trace + Citations + Read Aloud Footer */}
                {!isUser && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--aw-text-secondary)]">
                    <div className="flex flex-wrap items-center gap-3">
                      {msg.agentsUsed && msg.agentsUsed.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedTraceId(traceOpen ? null : msg.id)}
                          className="inline-flex items-center gap-1 text-[#39BDF8] hover:underline cursor-pointer"
                        >
                          <Cpu className="w-3.5 h-3.5" />
                          <span>
                            {msg.agentsUsed.length} Agents · {msg.citations?.length || 0} RAG Citations
                          </span>
                          {traceOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => speakText(msg.content, msg.language)}
                      aria-label="Read response aloud"
                      className="inline-flex items-center gap-1 hover:text-[var(--aw-text)] cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Listen</span>
                    </button>
                  </div>
                )}

                {/* Expandable Multi-Agent Execution Trace & RAG Sources */}
                {!isUser && traceOpen && (
                  <div className="mt-3 pt-3 border-t border-[var(--aw-border)] space-y-3 text-xs">
                    {msg.agentsUsed && msg.agentsUsed.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="font-semibold text-[var(--aw-text)]">Orchestrator Execution Trace</div>
                        {msg.agentsUsed.map((step, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-[var(--aw-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                          >
                            <div>
                              <span className="font-semibold text-[#00C9A7]">{step.agentName}</span>
                              <span className="text-[var(--aw-text-secondary)]"> — {step.summary}</span>
                            </div>
                            <span className="font-mono-num text-[11px] text-[var(--aw-text-secondary)] shrink-0">
                              {step.toolsInvoked.join(', ')} ({step.durationMs}ms)
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {msg.citations && msg.citations.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="font-semibold text-[var(--aw-text)] inline-flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-[#39BDF8]" />
                          Retrieved Environmental Knowledge (RAG)
                        </div>
                        {msg.citations.map((cit) => (
                          <div key={cit.id} className="p-2.5 rounded-lg bg-[var(--aw-surface)] space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-[var(--aw-text)]">{cit.title}</span>
                              <span className="font-mono-num text-[11px] text-[#39BDF8]">
                                match {(cit.similarity * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="text-[11px] text-[var(--aw-text-secondary)]">{cit.source}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {sending && (
          <div className="flex items-start">
            <div className="rounded-xl px-4 py-3 bg-[var(--aw-bg)] border border-[var(--aw-border)] text-xs text-[var(--aw-text-secondary)]">
              Orchestrating specialized environmental agents and retrieving live telemetry...
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-xs text-[#FCA5A5]">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3.5 border-t border-[var(--aw-border)] bg-[var(--aw-bg-secondary)] flex items-center gap-2"
      >
        <button
          type="button"
          onClick={toggleVoiceInput}
          title="Voice input"
          className={`p-2.5 rounded-lg border transition-colors cursor-pointer ${
            listening
              ? 'border-[#EF4444] bg-[#EF4444]/20 text-[#EF4444]'
              : 'border-[var(--aw-border)] bg-[var(--aw-bg)] text-[var(--aw-text-secondary)] hover:text-[var(--aw-text)]'
          }`}
        >
          {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            language === 'hi'
              ? 'वायु गुणवत्ता, बच्चों के बाहर खेलने या यात्रा के बारे में पूछें...'
              : language === 'or'
                ? 'ବାୟୁ ଗୁଣବତ୍ତା, ଘର ଭିତର ବାୟୁ କିମ୍ବା ଯାତ୍ରା ବିଷୟରେ ପଚାରନ୍ତୁ...'
                : 'Ask about outdoor play, indoor purifiers, cleaner commutes, or smog risk...'
          }
          className="flex-1 px-3.5 py-2.5 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)] focus:outline-none focus:border-[#00C9A7]"
        />

        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#00C9A7] text-[#05181C] text-xs font-semibold hover:bg-[#19DDBB] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Send className="w-3.5 h-3.5" />
          Send
        </button>
      </form>
    </div>
  );
}
