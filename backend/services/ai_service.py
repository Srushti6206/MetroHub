"""Optional LLM adapter. Credentials stay on the backend. Output is untrusted and validated by the caller."""
import json
import logging
import urllib.error
import urllib.request

log = logging.getLogger("pmh.ai")


class AIError(Exception):
    pass


def llm_enabled(cfg) -> bool:
    return cfg.get("AI_PROVIDER") == "openai" and bool(cfg.get("OPENAI_API_KEY")) and bool(cfg.get("OPENAI_MODEL"))


SYSTEM = (
    "You are MetroMate, a commuter food assistant for a DEMO app. You may ONLY recommend products from the "
    "provided eligible_products list, by id. Do not invent products. Do not state prices, totals, discounts, opening "
    "hours, stock levels or train times in your reply; the app shows verified prices itself. Pick items from a SINGLE "
    "shop_id so the user collects in one stop. Respect the user's diet and budget. Reply with JSON only: "
    '{"reply": "<one or two friendly sentences, no prices>", "product_ids": ["<id>", ...]}. '
    "If nothing fits or you need more info, return an empty product_ids and ask one short question in reply."
)


def ask_llm(cfg, message, history, constraints, eligible) -> dict:
    """Returns {"reply": str, "product_ids": [str]} or raises AIError. Never raises provider internals."""
    payload = {
        "model": cfg["OPENAI_MODEL"],
        "messages": [
            {"role": "system", "content": SYSTEM},
            *[{"role": h["role"], "content": h["content"][:300]} for h in history[-6:]],
            {"role": "user", "content": json.dumps({"message": message, "constraints": constraints,
                                                     "eligible_products": eligible}, ensure_ascii=False)},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions", data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {cfg['OPENAI_API_KEY']}"})
    try:
        with urllib.request.urlopen(req, timeout=cfg.get("AI_TIMEOUT_SECONDS", 12)) as r:
            body = json.loads(r.read().decode())
        out = json.loads(body["choices"][0]["message"]["content"])
    except urllib.error.HTTPError as e:
        log.warning("LLM HTTP error %s", e.code)  # never log headers/keys
        raise AIError("rate_limited" if e.code == 429 else f"provider_http_{e.code}")
    except (urllib.error.URLError, TimeoutError, OSError):
        raise AIError("provider_unreachable_or_timeout")
    except (KeyError, IndexError, ValueError, TypeError):
        raise AIError("invalid_response")
    if not isinstance(out, dict) or not isinstance(out.get("reply"), str) or not isinstance(out.get("product_ids"), list):
        raise AIError("invalid_response_shape")
    return {"reply": out["reply"][:600], "product_ids": [x for x in out["product_ids"] if isinstance(x, str)][:8]}
