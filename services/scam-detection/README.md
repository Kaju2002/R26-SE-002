# Scam Detection Service

## Overview
This service provides fraud and scam detection capabilities for job-related communications.

## Data Cleaning

To run the data cleaning pipeline:

```bash
cd services/scam-detection && python notebooks/01_data_cleaning.py
```

This command will execute the data cleaning notebook and process the raw data.

## Directory Structure
- `app/` - Application code
- `data/` - Data files (raw and cleaned)
- `notebooks/` - Jupyter notebooks and scripts
- `tests/` - Test files

py -m pip install -r requirements.txtS