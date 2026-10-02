"use client";

// Last resort: shown if even the main layout fails. It replaces the whole page
// (so it has its own <html>), and can't use the translations or styles that
// failed to load, so it's plain and in all three languages.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ru">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#faf6f1",
        fontFamily: "system-ui, sans-serif", color: "#1c1917", textAlign: "center" }}>
        <main style={{ padding: 24, maxWidth: 380 }}>
          <h1 style={{ fontSize: 22 }}>Что-то пошло не так · Бірдеңе дұрыс болмады · Something went wrong</h1>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 16, background: "#c2553a", color: "#fff", border: 0, borderRadius: 12,
              padding: "12px 24px", fontSize: 16, fontWeight: 600 }}
          >
            Повторить · Қайталау · Try again
          </button>
        </main>
      </body>
    </html>
  );
}
