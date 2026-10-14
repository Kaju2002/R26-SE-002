"""Builds the block that the mobile app and the admin page show to a person
checking an employer. Everything a screen needs is in one object, so the
frontends do not have to interpret raw scores or feature lists."""
from __future__ import annotations

from typing import Dict, List, Optional

SCALE_NOTE = ("Score guide: 70-100 low risk, 45-69 could not be confirmed, below 45 high risk. "
              "A low score with no warning signs means we could not verify the employer, not that it is fraud.")
DISCLAIMER = (
    "This is an automated check based on public sources. It is a guide, not proof. "
    "Never pay a fee to get a job."
)

BANDS = {
    "Low": dict(
        label="Likely legitimate", color="green",
        headline="This employer looks legitimate",
        summary="We found positive evidence for this employer and no strong warning signs.",
        next_steps=[
            "Apply through the employer's official channels.",
            "Never pay a fee to get a job, even if the employer looks genuine.",
        ],
    ),
    "Medium": dict(
        label="Could not be confirmed", color="orange",
        headline="We could not confirm this employer",
        summary=(
            "This does not mean the employer is fake. Many genuine small companies are "
            "missing from online registers. Check before you share anything."
        ),
        next_steps=[
            "Ask the employer for its company registration number and check it with the Registrar of Companies.",
            "Look for the company on LinkedIn or topjobs.lk, or call its office number.",
            "Do not pay any fee or share ID or bank details until you have confirmed the employer.",
        ],
    ),
    "High": dict(
        label="High fraud risk", color="red",
        headline="This employer shows strong signs of fraud",
        summary="Several warning signs were found. We advise you not to continue with this employer.",
        next_steps=[
            "Do not pay any fee, share ID or bank details, or send documents.",
            "Do not continue the conversation outside the job platform.",
            "Report the post to the job platform and to Sri Lanka CERT.",
        ],
    ),
    "Unknown": dict(
        label="Not enough information", color="grey",
        headline="Not enough information to check this employer",
        summary="Enter at least a company name or a website.",
        next_steps=["Enter the company name and website shown in the job post, then check again."],
    ),
}


FRAUD_FLAGS = ("has_scam_report", "has_payment_risk", "has_urgency_language", "has_suspicious_tld")
# Not fraud flags on their own:
#  - has_negative_reviews: a single negative-sounding snippet is normal for any large company (mixed reviews).
#    Real scam reports set has_scam_report, which needs scam wording to clearly dominate.
# Not a fraud flag: a legitimate site that is still on plain HTTP. It is shown as a concern in the
# Website check instead ("does not use HTTPS"), but it is not proof of fraud on its own.


def has_fraud_signals(features: dict, rep: dict) -> bool:
    """True when something actively points to fraud (not merely missing evidence)."""
    if any(int((features or {}).get(f) or 0) for f in FRAUD_FLAGS):
        return True
    if int((rep or {}).get("has_scam_report") or 0):
        return True
    try:
        # A single job-scam phrase on an ordinary website (a shop's "limited time" banner, say)
        # is not evidence by itself; two or more different phrases are.
        return float((features or {}).get("scam_score") or 0) >= 2
    except (TypeError, ValueError):
        return False


def _registration_check(status: Optional[str], evidence: dict, registry_unavailable: bool) -> dict:
    name = "Official registration"
    if registry_unavailable:
        return dict(name=name, status="unavailable",
                    detail="The registers could not be reached this time, so registration was not checked.")
    if status == "registered":
        found = evidence.get("registration") or []
        detail = ("; ".join(found) + ".") if found else "Found in an official register."
        reg_name, reg_no = evidence.get("reg_name"), evidence.get("reg_number")
        if reg_name:
            detail += f" Registered name: {reg_name}" + (f" (No. {reg_no})." if reg_no else ".")
        return dict(name=name, status="good", detail=detail)
    if status == "unverified" and evidence.get("website_legal_name"):
        w = evidence["website_legal_name"]
        return dict(name=name, status="neutral",
                    detail=(f"The website names \"{w['name']}\", which appears in the {w['register']} register. "
                            "We could not confirm that the website really belongs to that company, so please check."))
    if status == "unverified":
        return dict(name=name, status="neutral",
                    detail="Not found in the registers we checked. This is common for small private companies.")
    return dict(name=name, status="concern",
                detail="No official registration was found in this check.")


def _reputation_check(evidence: dict, rep: dict) -> dict:
    name = "Reviews and scam reports"
    items: List[str] = evidence.get("reputation") or []
    if int(rep.get("has_scam_report") or 0):
        return dict(name=name, status="concern", detail="Scam reports about this employer were found online.")
    if items:
        return dict(name=name, status="good", detail="; ".join(items[:3]) + ".")
    return dict(name=name, status="neutral", detail="No reviews or reports about this employer were found.")


def _website_check(evidence: dict, features: dict) -> dict:
    name = "Website"
    items: List[str] = evidence.get("website") or []
    if int(features.get("scrape_failed") or 0):
        return dict(name=name, status="unavailable",
                    detail="The website could not be opened or read, so it could not be checked.")
    weak = any("weak" in s.lower() or "could not" in s.lower() for s in items)
    risky = int(features.get("has_payment_risk") or 0) or int(features.get("has_suspicious_tld") or 0)
    if risky:
        return dict(name=name, status="concern",
                    detail="The website asks for payments or uses a suspicious address.")
    if int(features.get("is_http_only") or 0):
        return dict(name=name, status="concern",
                    detail="The website does not use HTTPS, so anything you enter there is not protected.")
    if weak:
        weak_items = [x for x in items if "weak" in x.lower() or "could not" in x.lower()]
        return dict(name=name, status="concern", detail="; ".join(weak_items[:2]) + ".")
    if items and all("inferred" in x.lower() for x in items):
        return dict(name=name, status="neutral", detail="No website was found or it could not be read.")
    if any("no separate website" in x.lower() for x in items):
        return dict(name=name, status="neutral",
                    detail="No separate website was found; the company appears only on social media.")
    if items:
        return dict(name=name, status="good", detail="; ".join(items[:3]) + ".")
    return dict(name=name, status="neutral", detail="No website was found or it could not be read.")


def build_user_result(band: str, score: Optional[float], evidence: dict, rep: dict, features: dict,
                      registration_status: Optional[str], data_warnings: List[str],
                      registry_unavailable: bool = False, confidence: str = "high") -> Dict:
    # Below 45 with no fraud evidence only means "could not verify". It is shown as Medium (amber), never as red fraud.
    underlying_band = band
    unverified = band == "High" and not has_fraud_signals(features, rep)
    if unverified:
        band = "Medium"
    cfg = dict(BANDS[band])
    notices = list(data_warnings or [])
    checks: List[dict] = []
    if band != "Unknown":
        checks = [
            _registration_check(registration_status, evidence, registry_unavailable),
            _reputation_check(evidence, rep),
            _website_check(evidence, features),
        ]
    # Medium with no evidence at all is not the same as "a genuine small company missing from registers".
    thin = (
        band == "Medium" and len(checks) == 3
        and checks[0]["status"] in ("concern", "neutral", "unavailable")
        and checks[1]["status"] == "neutral"
        and checks[2]["status"] in ("unavailable", "neutral")
        and checks[2]["status"] != "good"
    )
    if thin:
        cfg["headline"] = "We found almost no information about this employer"
        cfg["summary"] = (
            "No official registration, no reviews and no readable website were found. We cannot say the "
            "employer is fake, but treat this as a warning sign and verify it independently before sharing anything."
        )
    # Officially registered but not enough other evidence for "Low": say so, instead of "could not confirm".
    if band == "Medium" and checks and checks[0]["status"] == "good":
        cfg["label"] = "Registered, not fully confirmed"
        cfg["headline"] = "Registered, but we found little else to confirm this employer"
        cfg["summary"] = (
            "This employer appears in an official register and we found no warning signs, but we found too few "
            "other signs (reviews, professional profiles) to be sure. Check the job offer itself before sharing anything."
        )
        cfg["next_steps"] = [
            "Make sure the job offer really comes from this company: contact it using the details on its official website.",
            "Look for the company on LinkedIn or topjobs.lk.",
            "Do not pay any fee or share ID or bank details until you have confirmed the offer.",
        ]
    high_reason = None
    if underlying_band == "High":
        high_reason = "no_evidence" if unverified else "fraud_signals"
    if unverified and not thin and not (checks and checks[0]["status"] == "good"):
        cfg.update(
            label="Could not verify",
            headline="We could not verify this employer",
            summary=(
                "We found no fraud warnings such as scam reports or payment requests, but we also found too "
                "little evidence to confirm this employer. This does not mean it is fake: many genuine companies "
                "are missing from online registers. Verify it before you share anything."
            ),
            next_steps=[
                "Ask for the company registration number and check it with the Registrar of Companies.",
                "Call the office number or visit the company before sharing anything.",
                "Do not pay any fee or share ID or bank details until you have verified the employer.",
            ],
        )
    if confidence == "low":
        notices.append("Little information was available for this check, so the result is less reliable.")
    return {
        "band": band,
        "underlying_band": underlying_band,
        "label": cfg["label"],
        "color": cfg["color"],
        "score": None if score is None else round(float(score)),
        "score_scale": SCALE_NOTE,
        "headline": cfg["headline"],
        "summary": cfg["summary"],
        "provisional": band == "Medium",
        "checks": checks,
        "next_steps": cfg["next_steps"],
        "notices": notices,
        "thin_evidence": thin,
        "high_reason": high_reason,
        "low_confidence": confidence == "low",
        "disclaimer": DISCLAIMER,
    }
