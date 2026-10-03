"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { rateOrder, reportProblem } from "@/app/actions/feedback";
import { useI18n } from "@/i18n/client";
import { PROBLEM_KINDS } from "@/lib/feedback";

type Props = {
  orderId: string;
  review: { rating: number } | null;
  report: { status: string } | null;
  canRate: boolean;
  canReport: boolean;
};

// Under a past order in My orders: "How did it go? ★★★★★" and "Report a problem".
export function OrderFeedback({ orderId, review, report, canRate, canReport }: Props) {
  const { dict, fill } = useI18n();
  const t = dict.feedback;
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [reporting, setReporting] = useState(false);

  return (
    <div className="mt-3 space-y-3 border-t border-stone-100 pt-3 text-sm">
      {review ? (
        <p className="text-stone-600">
          {t.yourRating} <Stars value={review.rating} />
        </p>
      ) : (
        canRate && (
          <form action={rateOrder}>
            <input type="hidden" name="orderId" value={orderId} />
            <fieldset>
              <legend className="font-medium text-stone-800">{t.rateTitle}</legend>
              {/* Five radio buttons drawn as stars. */}
              <div className="mt-1 flex" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="cursor-pointer p-0.5 text-3xl leading-none" onMouseEnter={() => setHover(n)}>
                    <input type="radio" name="rating" value={n} required className="sr-only" onChange={() => setRating(n)} />
                    <span aria-hidden className={(hover || rating) >= n ? "text-amber-400" : "text-stone-300"}>
                      ★
                    </span>
                    <span className="sr-only">{fill(t.star, { n })}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {rating > 0 && (
              <div className="mt-2 space-y-2">
                <label className="block">
                  <span className="text-stone-600">{t.commentLabel}</span>
                  <textarea name="comment" rows={2} maxLength={1000} placeholder={t.commentPlaceholder}
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand-light" />
                </label>
                <Submit label={t.send} />
              </div>
            )}
          </form>
        )
      )}

      {report ? (
        <p className={report.status === "REFUNDED" ? "font-medium text-brand-dark" : "text-stone-600"}>
          {report.status === "OPEN" ? t.reportOpen : report.status === "REFUNDED" ? t.reportRefunded : t.reportClosed}
        </p>
      ) : (
        canReport &&
        (reporting ? (
          <form action={reportProblem} className="space-y-2 rounded-xl bg-stone-50 p-3">
            <input type="hidden" name="orderId" value={orderId} />
            <fieldset className="space-y-1">
              <legend className="font-medium text-stone-800">{t.reportTitle}</legend>
              {PROBLEM_KINDS.map((kind, i) => (
                <label key={kind} className="flex items-center gap-2">
                  <input type="radio" name="kind" value={kind} defaultChecked={i === 0} className="accent-brand" />
                  {t.kinds[kind]}
                </label>
              ))}
            </fieldset>
            <label className="block">
              <span className="text-stone-600">{t.reportText}</span>
              <textarea name="text" rows={3} required minLength={3} maxLength={2000}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand-light" />
            </label>
            <div className="flex gap-2">
              <Submit label={t.reportSend} />
              <button type="button" onClick={() => setReporting(false)}
                className="rounded-lg px-4 py-2 font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-white">
                {t.cancel}
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setReporting(true)}
            className="font-medium text-stone-500 underline underline-offset-2 hover:text-red-700">
            {t.reportLink}
          </button>
        ))
      )}
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-400" aria-label={`${value} / 5`}>
      {"★".repeat(value)}
      <span className="text-stone-300">{"★".repeat(5 - value)}</span>
    </span>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
      {label}
    </button>
  );
}
