'use client';

import { useState } from 'react';
import {
  MessageCircle,
  BadgeCheck,
  ThumbsUp,
  IndianRupee,
  Send,
  HelpCircle,
  Plus,
  Sparkles,
  DollarSign,
} from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui/primitives';
import { DEMO_OWNER_QUESTIONS } from '@/lib/demoData';
import { formatINR } from '@/lib/utils';
import type { OwnerQuestion, OwnerAnswer } from '@/lib/types';

export function AskOwner({
  productId,
  productName,
}: {
  productId: string;
  productName?: string;
}) {
  const [questions, setQuestions] = useState<OwnerQuestion[]>(() => {
    return DEMO_OWNER_QUESTIONS.filter((q) => q.productId === productId);
  });
  const [newQuestionText, setNewQuestionText] = useState('');
  const [selectedFee, setSelectedFee] = useState<number>(29);
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');

  // Total consultation fees earned by owners on this product
  const totalEarned = questions.reduce(
    (acc, q) => acc + q.answers.reduce((sub, a) => sub + (a.earnedAmount ?? 0), 0),
    0,
  );

  function handleAskSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newQuestionText.trim()) return;

    const newQ: OwnerQuestion = {
      id: `q-${Date.now()}`,
      productId,
      askerName: 'you_buyer',
      question: newQuestionText.trim(),
      fee: selectedFee,
      isAnswered: false,
      answers: [],
      createdAt: new Date().toISOString().split('T')[0],
    };

    setQuestions([newQ, ...questions]);
    setNewQuestionText('');
  }

  function handleAnswerSubmit(questionId: string) {
    if (!answerText.trim()) return;

    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        const feeReward = q.fee ?? 0;
        const newAns: OwnerAnswer = {
          id: `a-${Date.now()}`,
          questionId,
          ownerName: 'you_verified',
          ownerBadge: 'Verified Owner · GST Invoice',
          isVerifiedOwner: true,
          answer: answerText.trim(),
          helpfulCount: 1,
          earnedAmount: feeReward,
          createdAt: new Date().toISOString().split('T')[0],
        };
        return {
          ...q,
          isAnswered: true,
          answers: [...q.answers, newAns],
        };
      }),
    );

    setAnsweringQuestionId(null);
    setAnswerText('');
  }

  function handleHelpful(questionId: string, answerId: string) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        return {
          ...q,
          answers: q.answers.map((a) =>
            a.id === answerId ? { ...a, helpfulCount: a.helpfulCount + 1 } : a,
          ),
        };
      }),
    );
  }

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-button border border-[var(--border-subtle)] bg-bg-surface p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-emerald">
              Direct Owner Consultations
            </span>
            <Badge color="var(--brand-emerald)" bg="var(--brand-emerald-glow)">
              ₹ Earn Real Money
            </Badge>
          </div>
          <h3 className="mt-1 text-base font-extrabold text-content-primary">
            Ask a Verified Owner
          </h3>
          <p className="text-xs text-content-muted">
            Got specific questions before spending money? Ask real owners who have used it for months. Verified owners earn micro-fees for answering.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-button bg-bg-elevated px-3 py-1.5 text-right">
            <div className="text-[10px] text-content-muted">Owners Earned Here</div>
            <div className="font-mono text-sm font-bold text-brand-emerald">
              ₹{totalEarned} UPI
            </div>
          </div>
        </div>
      </div>

      {/* Ask Question Box */}
      <Card className="p-4 border-brand-sky/30">
        <h4 className="text-xs font-bold uppercase tracking-wider text-content-secondary mb-2 flex items-center gap-1.5">
          <MessageCircle size={14} className="text-brand-sky" /> Ask Real Owners of this Model
        </h4>

        <form onSubmit={handleAskSubmit} className="space-y-3">
          <textarea
            rows={2}
            value={newQuestionText}
            onChange={(e) => setNewQuestionText(e.target.value)}
            placeholder="e.g. Does this heat up in summer sunlight with Google Maps? How is the speaker loudness in traffic?"
            className="w-full rounded border border-[var(--border-subtle)] bg-bg-elevated p-2.5 text-xs text-content-primary placeholder:text-content-muted focus:border-brand-emerald focus:outline-none"
            required
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-content-muted">Priority Consultation:</span>
              <button
                type="button"
                onClick={() => setSelectedFee(0)}
                className={`rounded-pill px-2.5 py-1 text-[11px] font-semibold border ${
                  selectedFee === 0
                    ? 'border-brand-sky bg-brand-sky/20 text-brand-sky'
                    : 'border-[var(--border-subtle)] bg-bg-surface text-content-muted'
                }`}
              >
                Free
              </button>
              <button
                type="button"
                onClick={() => setSelectedFee(29)}
                className={`rounded-pill px-2.5 py-1 text-[11px] font-semibold border ${
                  selectedFee === 29
                    ? 'border-brand-emerald bg-brand-emerald/20 text-brand-emerald'
                    : 'border-[var(--border-subtle)] bg-bg-surface text-content-muted'
                }`}
              >
                ₹29 (Fast reply)
              </button>
              <button
                type="button"
                onClick={() => setSelectedFee(49)}
                className={`rounded-pill px-2.5 py-1 text-[11px] font-semibold border ${
                  selectedFee === 49
                    ? 'border-brand-amber bg-brand-amber/20 text-brand-amber'
                    : 'border-[var(--border-subtle)] bg-bg-surface text-content-muted'
                }`}
              >
                ₹49 (Deep telemetry)
              </button>
            </div>

            <Button type="submit" className="bg-brand-emerald text-[#04110b] font-bold px-3 py-1.5 text-xs">
              <Send size={13} /> Ask Question
            </Button>
          </div>
        </form>
      </Card>

      {/* Questions List */}
      <div className="space-y-3">
        {questions.length === 0 ? (
          <Card className="p-6 text-center text-xs text-content-muted">
            No questions asked yet for this device. Be the first to ask verified owners!
          </Card>
        ) : (
          questions.map((q) => (
            <Card key={q.id} className="p-4 space-y-3">
              {/* Question Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-[11px] text-content-muted">
                    <span>Asked by @{q.askerName}</span>
                    <span>·</span>
                    <span>{q.createdAt}</span>
                  </div>
                  <h4 className="mt-1 text-sm font-bold text-content-primary leading-snug">
                    {q.question}
                  </h4>
                </div>

                <div className="shrink-0">
                  {q.fee && q.fee > 0 ? (
                    <Badge color="var(--brand-emerald)" bg="var(--brand-emerald-glow)">
                      ₹{q.fee} Consultation
                    </Badge>
                  ) : (
                    <Badge>Free Q&A</Badge>
                  )}
                </div>
              </div>

              {/* Answers */}
              <div className="space-y-2.5 border-t border-[var(--border-subtle)] pt-2.5">
                {q.answers.length === 0 ? (
                  <div className="rounded bg-bg-surface p-3 text-xs text-content-muted flex items-center justify-between">
                    <span>Awaiting answers from verified owners...</span>
                    {answeringQuestionId !== q.id && (
                      <Button
                        variant="outline"
                        onClick={() => setAnsweringQuestionId(q.id)}
                        className="px-2.5 py-1 text-[11px] text-brand-emerald border-brand-emerald/40"
                      >
                        Answer (+₹{q.fee ?? 20})
                      </Button>
                    )}
                  </div>
                ) : (
                  q.answers.map((ans) => (
                    <div
                      key={ans.id}
                      className="rounded-button border border-[var(--border-subtle)] bg-bg-surface p-3 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold text-content-primary">
                          <span>@{ans.ownerName}</span>
                          <span className="inline-flex items-center gap-1 rounded-pill bg-brand-emerald px-2 py-0.5 text-[11px] font-bold text-[#04110b] shadow-sm">
                            <BadgeCheck size={12} /> {ans.ownerBadge}
                          </span>
                        </div>

                        {ans.earnedAmount && ans.earnedAmount > 0 && (
                          <span className="font-mono text-[10px] text-brand-emerald font-bold">
                            +₹{ans.earnedAmount} Paid
                          </span>
                        )}
                      </div>

                      <p className="text-content-secondary leading-relaxed">{ans.answer}</p>

                      <div className="flex items-center justify-between pt-1 text-[11px] text-content-muted">
                        <span>{ans.createdAt}</span>
                        <button
                          onClick={() => handleHelpful(q.id, ans.id)}
                          className="flex items-center gap-1 rounded px-2 py-0.5 bg-bg-elevated hover:text-content-primary"
                        >
                          <ThumbsUp size={11} className="text-brand-sky" /> Helpful ({ans.helpfulCount})
                        </button>
                      </div>
                    </div>
                  ))
                )}

                {/* Inline Answering Box */}
                {answeringQuestionId === q.id && (
                  <div className="mt-2 space-y-2 rounded border border-brand-emerald/40 bg-bg-elevated p-3 animate-slide-up">
                    <div className="text-xs font-bold text-brand-emerald">
                      Answer as Verified Owner (Earn ₹{q.fee ?? 20} into your wallet)
                    </div>
                    <textarea
                      rows={2}
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      placeholder="Share your genuine real-world experience as an owner..."
                      className="w-full rounded border border-[var(--border-subtle)] bg-bg-surface p-2 text-xs text-content-primary focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => setAnsweringQuestionId(null)}
                        className="px-2.5 py-1 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => handleAnswerSubmit(q.id)}
                        className="bg-brand-emerald text-[#04110b] font-bold px-3 py-1 text-xs"
                      >
                        Post Answer & Claim ₹{q.fee ?? 20}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
