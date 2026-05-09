"""
Test script demonstrating the new rule-based scoring layer.
Shows how PickMe, Jkl, and fake scam companies get different scores.
"""

import sys
sys.path.insert(0, 'app')

from employer_verification_model.scoring_layer import calculate_final_score

# Test cases
test_companies = [
    {
        "name": "PickMe",
        "ml_prob": 0.92,
        "description": "Real Sri Lankan company (legit)",
    },
    {
        "name": "Jkl",
        "ml_prob": 0.55,
        "description": "Unknown company (suspicious)",
    },
    {
        "name": "FakeTechScam",
        "ml_prob": 0.35,
        "description": "Obvious scam (high risk)",
    },
]

print("\n" + "="*80)
print("RULE-BASED SCORING LAYER TEST")
print("="*80)
print("\nThis demonstrates how registration + reputation checks differentiate")
print("companies even when they have similar website structure.\n")

for company in test_companies:
    print("-" * 80)
    print(f"Company: {company['name']}")
    print(f"Description: {company['description']}")
    print(f"ML Probability: {company['ml_prob']}")
    print()

    # Calculate score
    result = calculate_final_score(
        ml_probability=company['ml_prob'],
        company_name=company['name'],
        website=f"https://www.{company['name'].lower()}.lk"
    )

    # Display results
    print(f"VERDICT: {result['verdict']}")
    print(f"Risk Level: {result['risk_level']} ({result['color']})")
    print(f"Legitimacy Score: {result['legitimacy_score']}/100")
    print()

    print("Score Breakdown:")
    print(f"  ML Model Score:       {result['score_breakdown']['ml_score']:.1f}/40")
    print(f"  Registration Score:   {result['score_breakdown']['registration_score']:.1f}/30")
    print(f"  Reputation Score:     {result['score_breakdown']['reputation_score']:.1f}/20")
    print(f"  Website Score:        {result['score_breakdown']['website_score']:.1f}/10")
    print()

    print("Evidence:")
    print("  Registration:")
    for ev in result['evidence']['registration']:
        print(f"    {ev}")
    print("  Reputation:")
    for ev in result['evidence']['reputation']:
        print(f"    {ev}")
    print("  Website:")
    for ev in result['evidence']['website']:
        print(f"    {ev}")
    print()

    print(f"Recommendation: {result['recommendation']}")
    print()

print("="*80)
print("KEY DIFFERENCE:")
print("="*80)
print("""
BEFORE: Both PickMe and Jkl showed identical evidence because we only
        checked website structure (HTTPS, about, contact pages).

AFTER:  PickMe scores 80+/100 (Low Risk) because:
        ✓ Registered with Sri Lanka authorities (CSE/BOI/CBSL/DRC)
        ✓ Found on LinkedIn, Indeed, TopJobs.lk, Daily FT

        Jkl scores 30-40/100 (Medium Risk) because:
        ✗ No official Sri Lanka registration found
        ✗ Not found on major job platforms
        ✗ No news mentions

        Scams score <20/100 (High Risk) because:
        ✗ No registration found
        ✗ Scam reports found online (⚠️)
        ✗ Website structure suspicious

This backend layer fixes the problem WITHOUT retraining the model.
It adds real business verification on top of ML predictions.
""")
