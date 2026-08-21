# FraudAware Dashboard — Future & Pending Work

Single reference for **admin** and **recruiter/company** portals: what exists, what’s a sidebar placeholder, and planned product ideas (shortlist, interviews, AI).

Last updated: 2026-08-21

---

## Portals overview

| Portal | Base path | Shell |
|--------|-----------|--------|
| Super admin | `/admin` | `AdminShell` + `AdminTopNav` |
| Recruiter | `/recruiter` | `EmployerShell` + `EmployerTopNav` |
| Company | `/company` | Same employer shell (shared UI) |

Brand: navy `#202871`, Poppins, soft panels `#F7F8FE` / `#EEF0F8`.

---

## Super Admin

### Sidebar (current)

| Tab | Route | Status |
|-----|--------|--------|
| Dashboard | `/admin/dashboard` | Live (basic overview) |
| Users | `/admin/users` | Live (mock data) |
| Verification | `/admin/verification` | Live (mock data) |
| Jobs | `/admin/jobs` | Live (mock moderation, mock data) |
| Reports | `/admin/reports` | **Coming soon** placeholder |
| Audit log | `/admin/audit` | **Coming soon** placeholder |
| Settings | `/admin/settings` | **Coming soon** placeholder |
| Support | `/admin/support` | **Coming soon** placeholder |

### Pending — wire real data

- [ ] **Users** — real user-management API (list, suspend, ban, restore)
- [ ] **Verification** — real company legitimacy queue (approve / reject)
- [ ] **Jobs moderation** — real flagged/fake jobs, force-close
- [ ] **Dashboard KPIs** — live counts (users, pending verifications, flagged jobs, tickets)

### Pending — placeholder pages (build later)

#### Reports / Flags (`/admin/reports`)
- Flagged jobs, profiles, messages
- Reporter + reason codes
- Triage: new → reviewing → resolved
- Escalate or dismiss with notes

#### Audit log (`/admin/audit`)
- Log admin actions: suspend, ban, approve, reject, force-close
- Actor, target, timestamp, before/after
- Filter by admin, action, date; export for compliance

#### Settings (`/admin/settings`)
- Feature flags for portals/modules
- Moderation thresholds / auto-flag rules
- Email/notification defaults
- Maintenance mode / announcements

#### Support tickets (`/admin/support`)
- Open / in progress / closed
- Assign admin, priority
- Reply threads + internal notes
- Link to user, job, or report

---

## Recruiter & Company

Same sidebar and features for both portals (`EmployerShell`).

### Sidebar (current)

| Tab | Route example | Status |
|-----|----------------|--------|
| Dashboard | `/recruiter/dashboard` | Live (welcome + links; **polish last**) |
| Jobs | `/recruiter/jobs` | Live (list + post/edit) |
| Applicants | `/recruiter/applicants` | Live (pipeline: all jobs, stages, bulk) |
| Interviews | `/recruiter/interviews` | Live (agenda + schedule via Nylas calendar / Meet / Teams) |
| InChat | `/recruiter/inchat` | Live |
| Email | `/recruiter/email` | Live (Nylas connect) |
| Templates | `/recruiter/templates` | **Coming soon** placeholder |
| Analytics | `/recruiter/analytics` | **Coming soon** placeholder |
| Team | `/recruiter/team` | **Coming soon** placeholder |
| Billing | `/recruiter/billing` | **Coming soon** placeholder |
| Profile | `/recruiter/profile` | Live (view + edit account/company + mailbox) |

Company uses the same paths under `/company/...`.

### Done recently (keep as baseline)

- [x] Modern shell: sticky sidebar, collapse, top nav (Apps, search, avatar)
- [x] Jobs list + post job form styling
- [x] Applicants hiring pipeline: all jobs, stage chips, bulk Accept/Reject, drawer
- [x] Profile: banner, edit profile, mailbox tab
- [x] Placeholder routes for Interviews, Templates, Analytics, Team, Billing

### Pending — core polish

- [ ] **Dashboard home** (intentionally last) — KPIs: jobs, applicants by stage, mailbox, interviews this week, quick actions
- [ ] Post Job: clear “Back to Job List”, reset form on cancel/nav
- [ ] Applicants: richer pipeline stages beyond pending/accepted/rejected
  - **Phase 1 started:** statuses `applied → screened → shortlisted → interview → offered → hired → rejected` (legacy `sent`/`pending`/`accepted` still valid in DB)
- [ ] InChat / Email visual consistency with Jobs & Applicants
- [ ] Top-nav search on Users (`?q=`) wired into admin Users page filters

### Pending — placeholder pages (build later)

#### Interviews (`/interviews`)
- [x] **P1:** Interview entity + agenda UI + schedule from Applicants
- [x] Nylas calendar event + Google Meet / Microsoft Teams autocreate
- [x] Invite email + application status → `interview`
- [x] P2: Week/month calendar + drag reschedule (Nylas event update)
- [x] P3: T−24h / T−1h reminders (Email SMTP + in-app push + InChat); test mode T−5m / T−2m
- [ ] P4: Candidate self-booking links

#### Templates (`/templates`)
- Screening, interview invite, reject, offer templates
- Variables: name, job title, company
- Share across workspace team
- Use from Applicants, Email, InChat

#### Analytics (`/analytics`)
- Job views + apply conversion
- Funnel: applied → shortlisted → interview → hired
- Time-to-fill, response metrics
- Export for stakeholders

#### Team (`/team`)
- Invite by email
- Roles: owner, recruiter, viewer
- Shared jobs / applicants / InChat
- Remove or suspend members

#### Billing (`/billing`)
- Current plan + usage limits
- Upgrade / change plan
- Invoices + payment history
- Billing contact / tax details

---

## Product idea: Shortlisting & interviews at scale

**Goal:** Handle hundreds/thousands of CVs without opening every file, while staying fair and explainable (fits FraudAware).

### Principle

> Not “AI hires alone.”  
> **Filter → rank (ATS-lite) → AI assists → human shortlists → interview calendar.**

### Pipeline stages (target)

```
Applied → Screened → Shortlisted → Interview → Offer / Rejected
```

| Stage | Meaning |
|--------|---------|
| Applied | Application + CV received |
| Screened | Passed hard filters (or light review) |
| Shortlisted | Human (or assisted) chose for outreach |
| Interview | Scheduled in Interviews |
| Offer / Rejected | Final outcome + template message |

Today’s statuses (`pending` / `accepted` / `rejected`) should evolve toward these stages.

**Phase 1 (in progress / shipped UI+API):** recruiters can set  
`applied | screened | shortlisted | interview | offered | hired | rejected`.  
Legacy `sent` / `pending` map to Applied; `accepted` maps to Shortlisted in the dashboard UI.

### Layer A — Hard filters (rules)

Fast, cheap, no LLM required:

- Must-have skills / keywords from job
- Location / remote
- Experience min/max
- Education only if required
- Incomplete applications (no CV) → park or reject

Cuts 1000 → hundreds.

### Layer B — Match score (build ourselves)

Score each applicant vs job posting:

- Skill overlap %
- Role/title similarity
- Years of experience
- Optional motivation quality
- Application recency

Store `matchScore` + `matchReasons`. Sort Applicants by match. Recruiter works **top N**, not all 1000.

This is the **ATS-lite core** — own the data; don’t buy a full ATS yet.

### Layer C — AI assist (optional helper)

- 5-bullet CV summary
- “Why match / why not” vs job
- Suggested interview questions
- Draft invite / reject emails

**Human always confirms** Shortlist / Reject.

### Layer D — Human shortlist

- Bulk: Shortlist top 20 / Reject below score threshold (with confirm)
- Drawer: resume + summary + move stage
- Shortlisted → **Schedule interview** → Interviews calendar

### Interviews module (ties in)

1. Pick shortlisted applicant  
2. Pick slot  
3. Send invite (Email / InChat template)  
4. Status → Interview  
5. After call → next stage or Reject  

### Suggested build order

1. Richer application stages + bulk (started)
2. Match score from job skills vs CV text + sort
3. AI CV summary in applicant drawer
4. Interviews scheduling + calendar
5. Team review + Analytics funnel

### What we are *not* doing first

- Full Kanban ATS drag-and-drop (optional later)
- AI as sole auto-rejecter
- Buying an external ATS platform

---

## Suggested overall priority

1. Recruiter **Applicants** stages + match score  
2. Wire **admin** Users / Verification / Jobs to real APIs  
3. **Interviews** + Templates  
4. **Analytics** (or fold key charts into Dashboard)  
5. Admin **Reports / Audit / Settings / Support** data  
6. Recruiter **Team** + **Billing**  
7. **Dashboard home** redesign for both portals (last)

---

## Key files (quick find)

| Area | Path |
|------|------|
| Employer shell / nav | `components/employer/EmployerShell.tsx`, `EmployerTopNav.tsx` |
| Admin shell / nav | `components/admin/AdminShell.tsx`, `AdminTopNav.tsx` |
| Applicants pipeline | `components/employer/EmployerApplicantsPage.tsx` |
| Profile | `components/employer/EmployerProfilePage.tsx` |
| Employer placeholders | `components/employer/EmployerPlaceholderPage.tsx` |
| Admin placeholders | `components/admin/AdminPlaceholderPage.tsx` |
| Auth middleware | `middleware.ts` |

---

## Notes

- Placeholder pages show “Coming soon” + planned bullets until APIs exist.
- Company portal shares recruiter employer features; don’t duplicate admin tools there.
- When implementing a section, update this file (checkboxes + status column).
