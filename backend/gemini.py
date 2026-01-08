from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, Optional

import requests


TRANSIENT_STATUS_CODES = {429, 500, 502, 503, 504}


@dataclass(frozen=True)
class GeminiRateLimit(Exception):
    retry_after_seconds: float


def _parse_retry_delay_seconds(error_body: str) -> Optional[float]:
    try:
        data = json.loads(error_body)
        details = (data.get("error") or {}).get("details") or []
        for d in details:
            if isinstance(d, dict) and d.get("@type", "").endswith("RetryInfo"):
                delay = d.get("retryDelay")
                if isinstance(delay, str):
                    m = re.match(r"^(\d+(?:\.\d+)?)s$", delay.strip())
                    if m:
                        return float(m.group(1))
    except Exception:
        return None
    return None


def _pick_model() -> str:
    explicit = (os.getenv("GEMINI_MODEL") or "").strip()
    if explicit:
        return explicit

    csv = (os.getenv("GEMINI_MODELS") or "").strip()
    if csv:
        models = [m.strip() for m in csv.split(",") if m.strip()]
        if models:
            return models[0]

    return "models/gemini-2.5-flash"


def build_prompt(*, model_output: Dict[str, Any], rag_context: str) -> str:
    fault = model_output.get("primary_defect")
    confidence = model_output.get("confidence")
    return (
        "You are an expert solar PV operations assistant with deep knowledge of fault detection, maintenance procedures, and safety protocols.\n"
        "Your task is to provide DETAILED, COMPREHENSIVE, and ACTIONABLE guidance based on AI predictions and company maintenance knowledge.\n"
        "Be thorough and specific in all sections - do not provide brief or abbreviated responses.\n\n"
        "═════════════════════════════════════════════════════════════════\n"
        "ML MODEL DETECTION RESULT:\n"
        "═════════════════════════════════════════════════════════════════\n"
        f"Detected Issue: {fault}\n"
        f"Confidence Level: {confidence:.2%}\n\n"
        "═════════════════════════════════════════════════════════════════\n"
        "RETRIEVED MAINTENANCE KNOWLEDGE & PROCEDURES:\n"
        "═════════════════════════════════════════════════════════════════\n"
        f"{rag_context}\n\n"
        "═════════════════════════════════════════════════════════════════\n"
        "COMPREHENSIVE RESPONSE REQUIRED:\n"
        "═════════════════════════════════════════════════════════════════\n\n"
        "Please provide a thorough, well-structured response with ALL of the following sections.\n"
        "Each section should be DETAILED and COMPREHENSIVE:\n\n"
        "1️⃣ WHAT IS THIS FAULT? (Explanation in Simple Language)\n"
        "   ► Clearly describe what the detected fault means\n"
        "   ► Explain the immediate and long-term impact on panel performance\n"
        "   ► Detail any safety concerns or electrical hazards\n"
        "   ► Discuss why this fault occurs and under what conditions\n\n"
        "2️⃣ WHAT SHOULD BE DONE IMMEDIATELY? (Recommended Action)\n"
        "   ► Specify the exact first step to take\n"
        "   ► Reference the specific SOP procedures from the knowledge base above\n"
        "   ► List all required safety precautions and PPE\n"
        "   ► State who needs to be notified\n\n"
        "3️⃣ HOW TO FIX IT? (Detailed Maintenance Procedure)\n"
        "   ► Provide step-by-step instructions following the relevant SOP\n"
        "   ► Include preparation steps before work begins\n"
        "   ► Detail the exact method, tools, and materials needed\n"
        "   ► Explain post-action verification steps\n"
        "   ► Include any documentation or logging requirements\n\n"
        "4️⃣ HOW URGENT IS THIS? (Urgency Assessment & Timeline)\n"
        "   ► Assess urgency level: CRITICAL / HIGH / MEDIUM / LOW\n"
        "   ► Explain the reasoning behind this urgency level\n"
        "   ► Recommend action timeline (hours, days, weeks)\n"
        "   ► Suggest preventive measures to avoid recurrence\n"
        "   ► Recommend follow-up inspection schedule\n\n"
        "Provide comprehensive, detailed content for each section. Do not abbreviate or skip any details.\n"
    )


def generate_recommendation(*, model_output: Dict[str, Any], rag_context: str, max_output_tokens: int = 2500) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not configured. Please set environment variable.")

    model = _pick_model()
    url = f"https://generativelanguage.googleapis.com/v1beta/{model}:generateContent?key={api_key}"

    prompt = build_prompt(model_output=model_output, rag_context=rag_context)
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.6, "maxOutputTokens": int(max_output_tokens)},
    }

    resp = requests.post(url, json=payload, timeout=120)

    if resp.status_code == 429:
        retry = None
        if resp.headers.get("Retry-After"):
            try:
                retry = float(resp.headers["Retry-After"])
            except Exception:
                retry = None
        if retry is None:
            retry = _parse_retry_delay_seconds(resp.text)
        if retry is None:
            retry = 10.0
        raise GeminiRateLimit(retry_after_seconds=retry)

    if resp.status_code != 200:
        raise RuntimeError(f"Gemini API error {resp.status_code}: {resp.text}")

    data = resp.json()
    candidates = data.get("candidates") or []
    if not candidates:
        return ""

    content = candidates[0].get("content") or {}
    parts = content.get("parts") or []
    texts = [p.get("text", "") for p in parts if isinstance(p, dict)]
    raw_text = "".join(texts).strip()
    
    # Post-process the response to ensure proper markdown formatting
    # Replace numbered sections with markdown headers
    formatted = raw_text
    formatted = formatted.replace("### ", "## ")  # Standardize headers
    formatted = formatted.replace("## 1", "## 1️⃣")  # Add emojis to sections
    formatted = formatted.replace("## 2", "## 2️⃣")
    formatted = formatted.replace("## 3", "## 3️⃣")
    formatted = formatted.replace("## 4", "## 4️⃣")
    
    # Ensure proper line breaks
    formatted = formatted.replace("---", "\n\n---\n\n")
    formatted = formatted.replace("\n\n\n", "\n\n")
    
    return formatted
