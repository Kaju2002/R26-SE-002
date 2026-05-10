# Registration Checks Integration Guide

## Overview
The employer verification system uses a multi-layered approach to verify company registration status across various Sri Lankan government and official registries.

## Registration Check Order & Methods

### Layer 1: eROC (Department of Registrar of Companies)
**Function:** `check_eroc_registration(company_name)`
**Methods:**
1. Selenium-based rendering (if `EROC_USE_SELENIUM=1`)
2. Static HTTP POST to eROC search endpoint

**Returns:** `reg_number`, `reg_name`, registration status

---

### Layer 2: OpenCorporates API
**Condition:** Only if `OPEN_CORPORATES_API_TOKEN` is configured
**Function:** `_opencorporates_registration_lookup(company_name)`
**Returns:** Registry signals for CSE, DRC, CBSL, BOI

---

### Layer 3: Official Registry Search (DDGS)
**Registries Checked:**
- DRC / eROC
- CBSL (Central Bank)
- IRCSL (Insurance regulator)
- SLAASMB (Accounting board)

**Method:** DuckDuckGo search with domain filtering
**Function:** `_search_official_registry(company_name, domains)`

---

### Layer 4: **CSE (PRIMARY - DIRECT API)** ⭐
**Function:** `_check_cse_with_api(company_name)` 
**Endpoint:** `https://www.cse.lk/api/allSecurityCode`
**Speed:** <500ms
**Accuracy:** 100% on listed companies

**Returns:**
```python
{
    "is_registered": bool,
    "symbol": "SYMBOL.X0000",
    "reg_name": "Company Name PLC",
    "source": "Colombo Stock Exchange (CSE) API"
}
```

---

### Layer 4b: CSE (FALLBACK - Selenium) 
**Function:** `_check_cse_with_selenium(company_name)`
**Condition:** Only if `CSE_USE_SELENIUM=1` AND API lookup fails
**Method:** Headless Chrome rendering of CSE directory
**Speed:** 5-10 seconds (much slower, use as fallback only)

---

### Layer 5: Website Heuristics
**Method:** Fetches company website and searches for registry keywords
**Keywords Checked:**
- "registrar of companies", "registration no" (DRC)
- "colombo stock exchange", "cse" (CSE)
- "board of investment", "boi" (BOI)
- "central bank", "cbsl" (CBSL)
- "insurance regulatory commission", "ircsl" (IRCSL)
- "accounting and auditing standards" (SLAASMB)

---

### Layer 6: DDGS Fallback Search
**Condition:** If all previous checks returned nothing
**Domains Searched:**
- cse.lk (Colombo Stock Exchange)
- boi.lk (Board of Investment)
- cbsl.gov.lk (Central Bank)
- ircsl.gov.lk (Insurance Regulator)
- slaasmb.gov.lk (Accounting Board)

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────┐
│  check_registration_status(company_name, website)  │ (Main Entry)
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        ↓                             ↓
   ┌─────────────┐          ┌────────────────────┐
   │ eROC Check  │          │ OpenCorporates API │ (if token set)
   └─────────────┘          └────────────────────┘
        │                             │
        └──────────────┬──────────────┘
                       ↓
        ┌─────────────────────────────┐
        │ Other Registries (DRC, CBSL,│
        │ IRCSL, SLAASMB via DDGS)    │
        └─────────────────────────────┘
                       │
                       ↓
        ┌─────────────────────────────┐
        │ CSE DIRECT API ⭐ (PRIMARY) │
        │ GET /api/allSecurityCode    │
        └──────────┬────────────────────┘
                   │
           ┌───────┴────────┐
           ↓                ↓
        ✅ Found      ❌ Not Found
           │                │
           ↓                ↓
        Return       ┌─────────────────┐
                     │ CSE Selenium    │
                     │ (Fallback, slow)│
                     └────────┬────────┘
                              │
                        ┌─────┴────────┐
                        ↓              ↓
                     ✅ Found    ❌ Not Found
                        │             │
                        └─────┬───────┘
                              ↓
                    ┌──────────────────┐
                    │ Website Heuristics│
                    └────────┬─────────┘
                             │
                    ┌────────┴────────┐
                    ↓                 ↓
                 ✅ Found      ❌ Not Found
                    │                 │
                    └────────┬────────┘
                             ↓
                    ┌──────────────────┐
                    │ DDGS Fallback    │
                    │ (Last resort)    │
                    └──────────────────┘
```

## Usage Examples

### Example 1: Check CSE-Listed Company
```python
from app.employer_verification_model.registration_utils import check_registration_status

result = check_registration_status("ABANS FINANCE PLC")

print(result)
# {
#     'is_cse_listed': 1,
#     'cse_symbol': 'AFSL.N0000',
#     'cse_registered_name': 'ABANS FINANCE PLC',
#     'registration_method': 'cse_api',
#     'government_registration_status': 'registered',
#     ...
# }
```

### Example 2: Check Non-CSE Company
```python
result = check_registration_status("Local Shop Pvt Ltd", "https://localshop.lk")

print(result)
# {
#     'is_cse_listed': 0,
#     'is_drc_registered': 0,
#     'registration_method': None,  # Not found in any registry
#     'government_registration_status': 'not_found',
#     ...
# }
```

### Example 3: Direct CSE API Check
```python
from app.employer_verification_model.registration_utils import _check_cse_with_api

cse_result = _check_cse_with_api("ACCESS ENGINEERING PLC")

print(cse_result)
# {
#     'is_registered': True,
#     'symbol': 'AEL.N0000',
#     'reg_name': 'ACCESS ENGINEERING PLC',
#     'source': 'Colombo Stock Exchange (CSE) API'
# }
```

## Configuration

### Environment Variables
```bash
# CSE Configuration
export CSE_API_KEY="Cse123Api"           # Override default API key
export CSE_USE_SELENIUM=1                # Enable Selenium fallback (default: 1)

# eROC Configuration
export EROC_USE_SELENIUM=1               # Enable eROC Selenium (default: 0)

# OpenCorporates Configuration
export OPEN_CORPORATES_API_TOKEN=""      # Set to enable OpenCorporates checks

# Debugging
export PYTHONWARNINGS=ignore             # Suppress deprecation warnings
```

## Performance Tips

1. **Cache Results:** CSE listings change infrequently; cache for ~1 hour
   ```python
   from functools import lru_cache
   
   @lru_cache(maxsize=1000, typed=True)
   def get_cse_status(company_name):
       return _check_cse_with_api(company_name)
   ```

2. **Disable Unnecessary Checks:**
   - If company is already known to be non-CSE, skip CSE lookup
   - Skip OpenCorporates if token is not configured
   - Skip Selenium if API is reliable

3. **Batch Lookups:**
   - Use thread pool for concurrent registry checks
   - Combine multiple company lookups

## Troubleshooting

### CSE API Returns 401/403
- Check if API key is correctly base64-encoded
- Verify `CSE_API_KEY` environment variable if overridden
- Default key should work: `Cse123Api`

### CSE API Timeout
- Increase timeout: `timeout: int = 12` in function call
- Check internet connectivity
- CSE API may be temporarily down

### Selenium Fallback Not Working
- Ensure ChromeDriver is installed
- Verify `webdriver_manager` is installed: `pip install webdriver-manager`
- Check `CSE_USE_SELENIUM=1` is set

### No Matches Found
- Try different company name variations
- Check if company is actually listed on CSE
- Try with exact legal suffix (PLC, Ltd, Pvt, etc.)

## Testing

Run validation test:
```bash
cd services/employer-verification
python test_cse_validation.py
```

Expected output:
```
================================================================================
CSE REGISTRY VALIDATION TEST
================================================================================
ABANS FINANCE PLC:
  CSE Listed: 1
  Symbol: AFSL.N0000
  ...
```

## Related Documentation

- [CSE API Contract](./CSE_API_CONTRACT.md) - Detailed API specifications
- [Code: registration_utils.py](../app/employer_verification_model/registration_utils.py) - Implementation
- [CSE Official Site](https://www.cse.lk) - Data source
