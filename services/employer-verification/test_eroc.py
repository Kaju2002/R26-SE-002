import json
from app.employer_verification_model.registration_utils import check_eroc_registration

result = check_eroc_registration("PickMe")
print("eROC Lookup Result for 'PickMe':")
print(json.dumps(result, indent=2))
print()

# Also test the full check_registration_status
from app.employer_verification_model.registration_utils import check_registration_status
result2 = check_registration_status("PickMe", "https://pickme.lk/")
print("Full check_registration_status Result:")
print(json.dumps(result2, indent=2, default=str))
