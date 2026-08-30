"""Quick local benchmark after v4/v4e model upload."""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
sys.path.insert(0, ROOT)

from app.model_loader import load_model, load_phase1_model, is_model_loaded, is_phase1_loaded
from app.predictor import combine, run_phase1, run_phase2

CASES = [
    ("fee_registration", "We have only one position remaining, and several candidates are waiting. Send your personal details and a $100 registration fee today to reserve your position before it is given to someone else.", True),
    ("pay_50", "Pay a $50 registration fee within 2 hours to confirm your seat.", True),
    ("normal_interview", "Hi, thanks for applying. Are you available for a 30-minute interview tomorrow at 3pm? We can meet on Google Meet.", False),
    ("no_fee_explicit", "Please bring your updated CV and portfolio link to the interview. No payment is required at any stage.", False),
    ("slot_fee", "Last seat left. Pay 10000 LKR now to keep your slot or we will give it to another candidate.", True),
    ("otp", "Send your OTP and bank details immediately or your onboarding will be cancelled within 1 hour.", True),
    ("legit_tricky", "Your application has been received and will be reviewed together with the other submissions.", False),
    ("selected_no_fee", "Congratulations! You are selected for the final round. Please confirm your availability.", False),
    ("urgency_legit", "Please reply by Friday if you are still interested in the role.", False),
    ("fomo_formal", "We have only one position remaining and several candidates are waiting for your response.", True),
    ("fee_formal", "Send your personal details and a registration fee today to reserve your position.", True),
    ("short_hi", "Hello", False),
    ("social_proof", "500 candidates already joined this hiring program. Pay now to secure your spot.", True),
    ("sunk_cost", "You already completed two rounds. Do not lose this opportunity now.", True),
]

P1_GATE = 0.45


def notebook_style(text: str) -> dict:
    p1 = run_phase1(text)
    is_scam = p1 is not None and p1 > P1_GATE
    tactics = []
    if is_scam:
        p2 = run_phase2(text)
        tactics = [t["key"] for t in p2["tactics_detected"]]
    return {"is_scam": is_scam, "phase1_prob": p1, "tactics": tactics}


def main():
    load_model()
    load_phase1_model()
    print("Phase 1 loaded:", is_phase1_loaded())
    print("Phase 2 loaded:", is_model_loaded())
    print()

    current_hits = notebook_hits = 0
    rows = []
    for case_id, text, expected in CASES:
        p1 = run_phase1(text)
        p2 = run_phase2(text)
        current = combine(p1, p2)
        notebook = notebook_style(text)
        cur_ok = current["is_scam"] == expected
        nb_ok = notebook["is_scam"] == expected
        current_hits += int(cur_ok)
        notebook_hits += int(nb_ok)
        rows.append({
            "id": case_id,
            "expected": expected,
            "current_is_scam": current["is_scam"],
            "current_ok": cur_ok,
            "current_p1": current.get("phase1_prob"),
            "current_stage": current.get("decision_stage"),
            "current_tactics": [t["key"] for t in current.get("tactics", [])],
            "notebook_is_scam": notebook["is_scam"],
            "notebook_ok": nb_ok,
        })

    print(json.dumps(rows, indent=2))
    print()
    print(f"CURRENT combine(): {current_hits}/{len(CASES)}")
    print(f"NOTEBOOK P1 gate ({P1_GATE}): {notebook_hits}/{len(CASES)}")


if __name__ == "__main__":
    main()
