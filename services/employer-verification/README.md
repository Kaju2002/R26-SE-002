IT22251664
Bandara H.M.N.T

# Employer Verification Service

Short description:
- This service performs employer verification checks used by the FraudAware application. It contains scripts, models, and utilities to validate employer details, run checks, and surface verification results.

Quick links:
- Run script: `run.ps1`
- Requirements: `requirements.txt`
- Tests: see `tests/`

Purpose:
- Verify employer identity and legitimacy.
- Provide scoring and detailed reasons for verification outcomes.

Getting started:
- Create and activate a virtual environment.
- Install dependencies: `pip install -r requirements.txt`.
- Run a quick check: `python debug_eroc.py` (example script).

API / Interfaces:
- Describe main entry points (e.g., `main.py`, `app/`, or API endpoints).
- Note any expected input formats and output structures.

Data & Models:
- Location of datasets: `data/`.
- Trained models: `models/` (describe formats, versions, or how to retrain).

Testing:
- Unit tests live in `tests/` — run with `pytest`.


Folder Structure:

```
employer-verification/
│   debug_eroc.py, debug_eroc2.py, ...   # Utility and debug scripts
│   requirements.txt                     # Python dependencies
│   run.ps1                              # PowerShell script to run the service
│   README.md                            # This documentation file
│
├── app/                                 # Main application code
├── data/                                # Datasets and input files
├── docs/                                # Documentation and design notes
├── models/                              # Trained models and model files
├── notebooks/                           # Jupyter notebooks for experiments and analysis
├── tests/                               # Unit and integration tests
```

Folder Explanations:
- **app/**: Contains the core logic and modules for employer verification.
- **data/**: Stores datasets, sample inputs, and any data files used for processing or testing.
- **docs/**: Documentation, design documents, and reference materials.
- **models/**: Machine learning or rule-based models used for verification.
- **notebooks/**: Jupyter notebooks for prototyping, data exploration, and model development.
- **tests/**: Automated tests to ensure code quality and correctness.
- **debug_eroc.py, debug_eroc2.py, etc.**: Scripts for debugging and manual checks.
- **requirements.txt**: List of required Python packages.
- **run.ps1**: Script to set up and run the service on Windows.

TODO / Your notes:
- 
- 
- 

--
Add your details in the top three lines (Owner / Contact / Date) and update sections as needed.
