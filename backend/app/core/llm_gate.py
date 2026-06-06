"""
Per-request gate for the LLM fallback.

The LLM (Anthropic) fallback is a PAID-tier feature. Rather than thread an
`allow_llm` flag through every engine function (reconcile → _normalise →
detect_columns → _llm_match, plus the PDF extractor), we use a contextvar that
flows automatically through the async call stack.

Set it once at each request/job entry point from the company's plan:
    set_llm_allowed(plan_allows_llm(company.plan))

The engine's LLM call sites check llm_allowed() and no-op when it's False.
"""

import contextvars

# Default True so internal scripts/tests keep full behavior unless gated.
_llm_allowed: contextvars.ContextVar[bool] = contextvars.ContextVar("llm_allowed", default=True)

# Which plans unlock the AI extraction fallback.
PAID_PLANS = {"pro", "enterprise"}


def plan_allows_llm(plan: str | None) -> bool:
    return (plan or "free").lower() in PAID_PLANS


def set_llm_allowed(value: bool) -> None:
    _llm_allowed.set(value)


def llm_allowed() -> bool:
    return _llm_allowed.get()
