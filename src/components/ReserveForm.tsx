"use client";

import { useActionState, useState } from "react";
import { reserveBag } from "@/app/actions/orders";
import { useI18n } from "@/i18n/client";

type Props = { bagId: string; price: number; maxQuantity: number };

export function ReserveForm({ bagId, price, maxQuantity }: Props) {
  const [state, action, pending] = useActionState(reserveBag, undefined);
  const [quantity, setQuantity] = useState(1);
  const { dict, f } = useI18n();
  const t = dict.bag;

  const stepButton =
    "grid size-10 place-items-center rounded-lg text-xl font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="bagId" value={bagId} />
      <input type="hidden" name="quantity" value={quantity} />

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-stone-700">{t.quantity}</span>
        <div className="flex items-center gap-1 rounded-xl border border-stone-300 bg-white p-1">
          <button
            type="button"
            className={stepButton}
            onClick={() => setQuantity((q) => q - 1)}
            disabled={quantity <= 1}
            aria-label={t.oneLess}
          >
            −
          </button>
          <output className="w-8 text-center text-lg font-semibold" aria-live="polite">
            {quantity}
          </output>
          <button
            type="button"
            className={stepButton}
            onClick={() => setQuantity((q) => q + 1)}
            disabled={quantity >= maxQuantity}
            aria-label={t.oneMore}
          >
            +
          </button>
        </div>
      </div>

      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-between rounded-xl bg-brand px-5 py-3.5 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
      >
        <span>{pending ? t.reserving : t.reserve}</span>
        <span>{f.price(price * quantity)}</span>
      </button>
      <p className="text-center text-xs text-stone-500">{t.payAtStore}</p>
    </form>
  );
}
