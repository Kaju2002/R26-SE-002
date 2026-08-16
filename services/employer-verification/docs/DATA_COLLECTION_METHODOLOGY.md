# Employer Data Collection Methodology

This service should use an evidence-first workflow for employer legitimacy data.

## Collection goal

The dataset should distinguish legitimate employers from fraudulent, impersonated, or unverifiable employers using multiple independent signals:

- registry status
- website quality and domain signals
- reputation signals
- social-media identity consistency
- source-backed fraud evidence

Registry absence alone must not be treated as proof of fraud.

## Recommended dataset split

Keep collection artifacts separate before merging into the final model dataset:

- `legitimate_employers.csv`
- `fraudulent_employers.csv`
- `employer_evidence.csv`
- `unverified_cases.csv`

## Core fields to track

### Identity

- `sample_id`
- `company_name`
- `normalized_company_name`
- `industry`
- `country`
- `city`
- `business_type`

### Job evidence

- `job_title`
- `job_description`
- `job_source`
- `job_url`
- `job_post_date`

### Company identity

- `official_website`
- `facebook_url`
- `instagram_url`
- `linkedin_url`
- `youtube_url`
- `email`
- `phone`
- `address`

### Registry evidence

- `cse_match`
- `eroc_match`
- `other_registry_match`
- `registry_source`
- `registry_evidence_url`
- `registry_check_date`

### Website signals

- `has_https`
- `is_http_only`
- `has_about`
- `has_contact`
- `has_privacy_policy`
- `has_terms`
- `domain_length`
- `subdomain_count`
- `has_payment_risk`
- `has_urgency_language`
- `content_score`
- `scam_score`

### Reputation signals

- `has_glassdoor`
- `has_indeed`
- `has_trustpilot`
- `reputation_score`

### Social-media evidence

- `has_facebook`
- `has_instagram`
- `has_youtube`
- `has_linkedin`
- `social_identity_consistent`
- `social_contact_consistent`
- `social_website_consistent`

### Fraud labels

- `fraud_type`
- `source_type`
- `evidence_level`
- `ground_truth_reason`
- `ground_truth_source`
- `label`
- `verification_status`

Recommended `fraud_type` values:

- `Not Fraudulent`
- `Fake Employer`
- `Fake Recruitment Agency`
- `Fake Social Media Employer`
- `Fake Website`
- `Company Impersonation`
- `Payment Scam`
- `Overseas Recruitment Scam`
- `Work From Home Scam`
- `Unverifiable Employer`
- `Other`

Recommended `source_type` values:

- `Official Warning`
- `Police Report`
- `Government Report`
- `News Report`
- `Scam Report`
- `Social Media`
- `Manual Verification`
- `Synthetic`

## Collection workflow

Use the same sequence for every candidate case:

1. Capture the original source.
2. Identify the claimed employer and job poster.
3. Check the official website.
4. Check CSE.
5. Check eROC and other registry sources.
6. Check social-media identity consistency.
7. Check reputation sources.
8. Look for impersonation or payment-scam signals.
9. Assign fraud type and evidence level.
10. Store the evidence bundle and then add the row to the dataset.

## Evidence rule

Use only high- or medium-confidence cases as confirmed fraudulent ground truth.

Suggested rule of thumb:

- High confidence: official warning, confirmed scam report, or multiple independent confirmations.
- Medium confidence: two or more strong suspicious indicators plus registry and identity checks.
- Low confidence: registry not found or missing web presence alone. Keep these cases separate.

## Registry interpretation rule

Treat registry checks as evidence signals, not binary truth on their own.

- CSE match or eROC match: strong positive evidence.
- Registry not found: incomplete evidence, not automatic fraud.
- Real company with fake job post: mark as impersonation or job fraud, not necessarily fraudulent employer.

## Practical target order

1. Clean and relabel the current dataset.
2. Separate synthetic fraud from real-world fraud.
3. Expand official registry checks.
4. Collect official scam warnings and reported cases.
5. Collect fake recruitment agency and social-media scam cases.
6. Collect legitimate SMEs and local businesses for balance.
7. Retrain the scoring model and rerun weight sensitivity analysis.

## Evidence folders

For each fraud case, keep an evidence bundle such as:

- source document or screenshot
- website capture
- registry notes
- verification notes

Use a folder identifier like `FRAUD_001` and store that identifier in the dataset row.
