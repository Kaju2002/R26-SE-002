"""API behaviour tests for /predict (all network sources are stubbed)."""
import pathlib
import pytest
from fastapi.testclient import TestClient

import app.main as M
import app.employer_verification_model.registration_utils as RU

REAL_CHECK_REGISTRATION = RU.check_registration_status  # the fixture below stubs RU.check_registration_status

GOOD_SITE = {"text": "About us Contact us privacy policy " * 40,
             "signals": {"has_about": 1, "has_contact": 1, "has_privacy_policy": 1, "link_count": 25, "html_len": 9000}}
state = {}


def _reg(name, url=None, progress=None):
    if state.get("regfail"):
        raise RuntimeError("registry unreachable")
    return state.get("reg", {})


@pytest.fixture(autouse=True)
def stub_network(monkeypatch):
    state.clear()
    M._RESULT_CACHE.clear()
    monkeypatch.setenv("RESULT_CACHE_SECONDS", "0")
    # Tests must not depend on the developer's .env: no real Chrome, fixed time budget.
    monkeypatch.setattr(RU, "USE_EROC_SELENIUM", False)
    monkeypatch.setattr(RU, "USE_CSE_SELENIUM", False)
    monkeypatch.setattr(RU, "REG_TIME_BUDGET", 20.0)
    monkeypatch.setattr(M, "check_registration_status", _reg, raising=False)
    monkeypatch.setattr(RU, "check_registration_status", _reg)
    monkeypatch.setattr(M, "check_reputation", lambda n, u, progress=None: state.get("rep", {}))
    monkeypatch.setattr(M, "fetch_website_bundle", lambda u: state.get("site", GOOD_SITE))
    monkeypatch.setattr(M, "search_company_website", lambda n: state.get("found"))


@pytest.fixture
def client():
    return TestClient(M.app, raise_server_exceptions=False)


def post(client, body, **st):
    state.update(st)
    return client.post("/predict", json=body)


def test_empty_request_is_unknown_not_medium(client):
    r = post(client, {})
    assert r.status_code == 200
    j = r.json()
    assert j["prediction"] == "Unknown"
    assert j["risk_level"] == "Unknown" and j["risk_score"] is None


def test_blank_strings_count_as_empty(client):
    j = post(client, {"company_name": "  ", "website_url": "", "email": ""}).json()
    assert j["risk_level"] == "Unknown"


def test_registry_failure_does_not_crash(client):
    r = post(client, {"company_name": "Lanka Craft Pvt Ltd", "website_url": "https://lankacraft.lk"}, regfail=True)
    assert r.status_code == 200
    j = r.json()
    assert j["risk_level"] in ("Low", "Medium", "High")
    assert any("registry" in w.lower() for w in j["data_warnings"])


def test_listed_company_is_low_risk(client):
    j = post(client, {"company_name": "John Keells Holdings PLC", "website_url": "https://www.keells.com"},
             reg={"is_cse_listed": 1, "government_registration_status": "registered", "registration_method": "cse"},
             rep={"has_linkedin": 1, "has_glassdoor": 1, "has_social_facebook": 1, "has_website_reviews": 1,
                  "has_positive_reviews": 1}).json()
    assert j["risk_level"] == "Low" and j["prediction"] == "Legit"


def test_scam_report_is_high_risk(client):
    j = post(client, {"company_name": "Quick Cash Overseas Jobs", "website_url": "http://quickcash-jobs.xyz"},
             rep={"has_scam_report": 1},
             site={"text": "Pay registration fee now", "signals": {"link_count": 1, "html_len": 600}}).json()
    assert j["risk_level"] == "High" and j["prediction"] == "Fake"


@pytest.mark.parametrize("body,st", [
    ({"company_name": "Lanka Craft Pvt Ltd", "website_url": "https://lankacraft.lk"}, dict(rep={"has_linkedin": 1})),
    ({"company_name": "Acme Staffing", "website_url": "https://www.topjobs.lk/employer/acme"}, {}),
    ({"company_name": "Quick Cash Overseas Jobs", "website_url": "http://quickcash-jobs.xyz"}, dict(rep={"has_scam_report": 1})),
])
def test_label_always_matches_band(client, body, st):
    j = post(client, body, **st).json()
    expected = {"Low": "Legit", "Medium": "Uncertain", "High": "Fake"}[j["risk_level"]]
    assert j["prediction"] == expected


def test_response_has_score_breakdown(client):
    j = post(client, {"company_name": "Lanka Craft Pvt Ltd", "website_url": "https://lankacraft.lk"}).json()
    assert set(j["score_breakdown"]) == {"ml_score", "registration_score", "reputation_score", "website_score"}


def test_no_api_key_stored_in_source():
    src = pathlib.Path(RU.__file__).read_text()
    assert "Cse123Api" not in src


# ---------------- user-facing result block ----------------
def test_medium_result_is_provisional_and_says_not_fake(client):
    j = post(client, {"company_name": "Lanka Craft Pvt Ltd", "website_url": "https://lankacraft.lk"},
             rep={"has_linkedin": 1, "has_social_facebook": 1}).json()
    u = j["user_result"]
    assert u["band"] == "Medium" and u["provisional"] is True
    assert "not mean" in u["summary"].lower()
    assert any("registration number" in s for s in u["next_steps"])
    assert [c["name"] for c in u["checks"]] == ["Official registration", "Reviews and scam reports", "Website"]


def test_high_result_has_stop_advice_and_scam_check(client):
    j = post(client, {"company_name": "Quick Cash Overseas Jobs", "website_url": "http://quickcash-jobs.xyz"},
             rep={"has_scam_report": 1},
             site={"text": "Pay registration fee now", "signals": {"link_count": 1, "html_len": 600}}).json()
    u = j["user_result"]
    assert u["band"] == "High" and u["color"] == "red" and not u["provisional"]
    assert next(c for c in u["checks"] if c["name"].startswith("Reviews"))["status"] == "concern"
    assert any("Do not pay" in s for s in u["next_steps"])


def test_registry_outage_is_shown_as_unavailable_not_failed(client):
    j = post(client, {"company_name": "Lanka Craft Pvt Ltd", "website_url": "https://lankacraft.lk"}, regfail=True).json()
    reg = j["user_result"]["checks"][0]
    assert reg["status"] == "unavailable" and j["user_result"]["notices"]


def test_empty_request_user_result_is_grey(client):
    u = post(client, {}).json()["user_result"]
    assert u["band"] == "Unknown" and u["color"] == "grey" and u["score"] is None and u["checks"] == []


# ---------------- employer with no evidence (unreadable site, nothing found) ----------------
def test_unreadable_website_is_not_reported_as_good():
    from app.user_result import build_user_result
    u = build_user_result("Medium", 48, {"website": ["Website uses HTTPS"], "reputation": []}, {},
                          {"scrape_failed": 1}, "not_found", [], confidence="low")
    web = next(c for c in u["checks"] if c["name"] == "Website")
    assert web["status"] == "unavailable"
    assert u["thin_evidence"] is True
    assert "almost no information" in u["headline"]
    assert any("less reliable" in n for n in u["notices"])


def test_small_company_with_reviews_is_not_thin():
    from app.user_result import build_user_result
    u = build_user_result("Medium", 61, {"reputation": ["Found on LinkedIn"], "website": ["About page found"]},
                          {}, {"scrape_failed": 0}, "unverified", [])
    assert u["thin_evidence"] is False and "could not confirm" in u["headline"].lower()


# ---------------- search-engine fallback must not "register" unknown names ----------------
def test_ddgs_fallback_ignores_unrelated_results():
    junk = [{"title": "Annual report 2023", "body": "Listed companies and market data", "href": "https://www.cse.lk/x"}]
    assert RU._ddgs_results_name_match(junk, "ABCD") is False                    # short name: never accepted
    assert RU._ddgs_results_name_match(junk, "Lanka Craft Pvt Ltd") is False      # result does not mention it


def test_ddgs_fallback_accepts_real_name_match():
    hit = [{"title": "John Keells Holdings PLC - Company profile", "body": "Listed on the CSE", "href": "https://www.cse.lk/y"}]
    assert RU._ddgs_results_name_match(hit, "John Keells Holdings PLC") is True
    assert RU._ddgs_results_name_match(hit, "John Keells Holdings PLC", "cse.lk") is True
    assert RU._ddgs_results_name_match(hit, "John Keells Holdings PLC", "boi.lk") is False


def test_ddgs_fallback_end_to_end_unrelated_hits_do_not_register(monkeypatch):
    import sys, types
    class FakeDDGS:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def text(self, q, max_results=3):
            return [{"title": "Unrelated page", "body": "nothing relevant", "href": "https://www.cse.lk/z"}]
    mod = types.ModuleType("duckduckgo_search"); mod.DDGS = FakeDDGS
    monkeypatch.setitem(sys.modules, "duckduckgo_search", mod)
    monkeypatch.setitem(sys.modules, "ddgs", mod)
    r = REAL_CHECK_REGISTRATION("ABCD", "https://abcd.com")
    assert not r.get("is_cse_listed") and not r.get("is_boi_registered") and not r.get("is_cbsl_licensed")
    assert r.get("government_registration_status") != "registered"


# ---------------- High band without any fraud evidence (real but unverifiable small site) ----------------
def test_high_without_fraud_signals_is_not_called_fraud():
    from app.user_result import build_user_result
    feats = {"has_scam_report": 0, "has_payment_risk": 0, "has_urgency_language": 0, "has_suspicious_tld": 0,
             "has_negative_reviews": 0, "is_http_only": 0, "scam_score": 0, "scrape_failed": 0}
    u = build_user_result("High", 39, {"website": ["Website uses HTTPS"], "reputation": []}, {}, feats, "unverified", [])
    assert u["band"] == "Medium" and u["underlying_band"] == "High" and u["high_reason"] == "no_evidence"
    assert u["color"] == "orange" and u["label"] == "Could not verify"
    assert "fraud" not in u["headline"].lower() and "warning signs were found" not in u["summary"].lower()


def test_high_with_fraud_signal_keeps_fraud_wording():
    from app.user_result import build_user_result
    u = build_user_result("High", 20, {}, {"has_scam_report": 1}, {"has_payment_risk": 1}, "not_found", [])
    assert u["band"] == "High" and u["high_reason"] == "fraud_signals" and u["label"] == "High fraud risk"


def test_raw_verdict_and_recommendation_match_user_result(client):
    j = post(client, {"company_name": "Quick Cash Overseas Jobs", "website_url": "http://quickcash-jobs.xyz"},
             rep={"has_scam_report": 1},
             site={"text": "Pay registration fee now", "signals": {"link_count": 1, "html_len": 600}}).json()
    assert j["verdict"] == j["user_result"]["headline"]
    assert j["recommendation"] == j["user_result"]["summary"]


def test_search_only_registration_is_not_official(monkeypatch):
    """Even when a search result names the company, a search snippet alone is not an official register."""
    import sys, types
    class FakeDDGS:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def text(self, q, max_results=3):
            # only the last-resort fallback searches boi.lk, so only it "finds" the name (as in the real Softsora run)
            if "site:boi.lk" in q:
                return [{"title": "Softsora Pvt Ltd - profile", "body": "Softsora Pvt Ltd", "href": "https://www.boi.lk/z"}]
            return []
    mod = types.ModuleType("duckduckgo_search"); mod.DDGS = FakeDDGS
    monkeypatch.setitem(sys.modules, "duckduckgo_search", mod)
    monkeypatch.setitem(sys.modules, "ddgs", mod)
    r = REAL_CHECK_REGISTRATION("Softsora Pvt Ltd", "https://softsora.com")
    assert r.get("government_registration_status") != "registered"
    assert not r.get("is_boi_registered") and not r.get("is_government_registered")
    assert r.get("search_only_registration_hint") == 1
    assert any(x["source"] == "DDGS:BOI" and x["status"] == "unverified" for x in r["registration_trace"])


def test_http_only_site_is_explained_in_plain_words():
    from app.user_result import build_user_result
    u = build_user_result("Medium", 48, {"website": ["Contact page found", "Website has weak security signals"],
                                         "reputation": []}, {}, {"is_http_only": 1, "scrape_failed": 0}, "unverified", [])
    web = next(c for c in u["checks"] if c["name"] == "Website")
    assert web["status"] == "concern" and "HTTPS" in web["detail"] and "Contact page" not in web["detail"]


def test_result_from_the_companys_own_site_is_not_a_registry_match(monkeypatch):
    """Search engines sometimes ignore site:. A page on softsora.com is not evidence from cbsl.gov.lk."""
    import sys, types
    class FakeDDGS:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def text(self, q, max_results=3):
            return [{"title": "SoftSora | Software company", "body": "SoftSora builds software",
                     "href": "https://softsora.com/about"}]
    mod = types.ModuleType("duckduckgo_search"); mod.DDGS = FakeDDGS
    monkeypatch.setitem(sys.modules, "duckduckgo_search", mod)
    monkeypatch.setitem(sys.modules, "ddgs", mod)
    r = REAL_CHECK_REGISTRATION("SoftSora", "https://softsora.com")
    assert r.get("government_registration_status") != "registered"
    assert not any(r.get(k) for k in ("is_cse_listed", "is_boi_registered", "is_cbsl_licensed", "is_drc_registered"))


# ---------------- speed limits ----------------
def _fake_ddgs(monkeypatch, delay=0.0, fail=False):
    import sys, time, types
    calls = []
    class FakeDDGS:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def text(self, q, max_results=3):
            calls.append(q)
            time.sleep(delay)
            if fail:
                raise RuntimeError("search engine unreachable")
            return []
    mod = types.ModuleType("duckduckgo_search"); mod.DDGS = FakeDDGS
    monkeypatch.setitem(sys.modules, "duckduckgo_search", mod)
    monkeypatch.setitem(sys.modules, "ddgs", mod)
    return calls


def test_registry_search_stops_when_time_budget_is_spent(monkeypatch):
    import time
    calls = _fake_ddgs(monkeypatch, delay=0.2)
    monkeypatch.setattr(RU, "REG_TIME_BUDGET", 0.5)
    t0 = time.time()
    REAL_CHECK_REGISTRATION("Lanka Craft Pvt Ltd Budget Test A", "https://example.org")
    assert time.time() - t0 < 6          # without a budget this makes dozens of 0.2s searches
    assert len(calls) <= 8


def test_registry_search_gives_up_when_search_engine_is_down(monkeypatch):
    calls = _fake_ddgs(monkeypatch, fail=True)
    monkeypatch.setattr(RU, "REG_TIME_BUDGET", 60)
    REAL_CHECK_REGISTRATION("Lanka Craft Pvt Ltd Budget Test B", "https://example.org")
    assert len(calls) <= RU.REG_SEARCH_MAX_FAILURES + 2   # stops after a few failures in a row


def test_same_search_is_not_repeated_in_different_case(monkeypatch):
    calls = _fake_ddgs(monkeypatch)
    monkeypatch.setattr(RU, "REG_TIME_BUDGET", 60)
    RU._budget_start()
    RU._search_official_registry("SoftSora", ["cbsl.gov.lk"])
    assert [c.lower() for c in calls].count('"softsora" site:cbsl.gov.lk') == 1


def test_slow_source_does_not_block_the_answer(client, monkeypatch):
    import time
    monkeypatch.setattr(M, "CHECK_TIMEOUT", 0.5)
    monkeypatch.setattr(M, "check_reputation", lambda n, u, progress=None: (time.sleep(3), {})[1])
    t0 = time.time()
    j = post(client, {"company_name": "Lanka Craft Pvt Ltd", "website_url": "https://lankacraft.lk"}).json()
    assert time.time() - t0 < 2.5
    assert j["risk_level"] in ("Low", "Medium", "High")
    assert any("too long" in w for w in j["data_warnings"])


def test_registry_timeout_keeps_partial_result(monkeypatch):
    """A registry check cut short by the time limit must keep what it already found."""
    import time as _t
    import app.main as M

    def slow_check(name, url=None, progress=None):
        progress["results"] = {
            "is_cse_listed": 0, "is_boi_registered": 0, "is_cbsl_licensed": 0, "is_drc_registered": 1,
            "is_ircsl_registered": 0, "is_slaasmb_registered": 0, "registration_sources": ["drc_record"],
            "registration_trace": [], "reg_name": "Example (Pvt) Ltd",
        }
        _t.sleep(3)  # the slow step (e.g. Selenium) that never finishes in time
        return {}

    monkeypatch.setattr(RU, "check_registration_status", slow_check)
    monkeypatch.setattr(M, "CHECK_TIMEOUT", 1.0)
    from fastapi.testclient import TestClient
    r = TestClient(M.app).post("/predict", json={"company_name": "Example", "email": "", "website_url": ""})
    assert r.status_code == 200
    body = r.json()
    assert any("partly checked" in w for w in body["data_warnings"])
    assert "registry_unavailable" not in body["features_used"]
    assert "registry_partial" not in body["features_used"]
    assert body["features_used"]["is_registered"] == 1


def test_partial_with_nothing_found_is_unavailable():
    from app.employer_verification_model.registration_utils import partial_registration_result
    out = partial_registration_result({"results": {"registration_trace": [], "registration_sources": []}})
    assert out["registry_unavailable"] == 1 and out["registry_partial"] == 1


def test_generic_words_do_not_match_other_company(monkeypatch):
    """'Hutch Sri Lanka' must not match 'Distilleries Company of Sri Lanka PLC' just because of 'Sri Lanka'."""
    monkeypatch.setattr(RU, "_get_cse_listings", lambda timeout: [
        {"name": "DISTILLERIES COMPANY OF SRI LANKA PLC", "symbol": "DIST.N0000"},
        {"name": "SRI LANKA TELECOM PLC", "symbol": "SLT.N0000"},
    ])
    assert not RU._check_cse_with_api("Hutch Sri Lanka")["is_registered"]
    assert RU._check_cse_with_api("Sri Lanka Telecom")["is_registered"]
    assert RU._check_cse_with_api("Distilleries Company of Sri Lanka PLC")["is_registered"]
    assert not RU._text_mentions_company("Distilleries Company of Sri Lanka PLC", "Hutch Sri Lanka")


def test_reputation_timeout_keeps_partial_result(monkeypatch):
    """If the reputation check runs out of time, what it found (e.g. LinkedIn) must be kept."""
    import time as _t

    def slow_rep(name, url=None, progress=None):
        progress["found"] = {"has_linkedin": 1}
        _t.sleep(3)
        return {}

    monkeypatch.setattr(M, "check_reputation", slow_rep)
    monkeypatch.setattr(M, "CHECK_TIMEOUT", 1.0)
    r = TestClient(M.app).post("/predict", json={"company_name": "Example", "email": "", "website_url": ""})
    body = r.json()
    assert body["features_used"].get("has_linkedin") == 1
    assert any("only partly checked" in w for w in body["data_warnings"])


def test_registered_medium_does_not_say_could_not_confirm(client):
    j = post(client, {"company_name": "Example Telecom Pvt Ltd", "website_url": "https://example.lk"},
             reg={"is_slaasmb_registered": 1, "is_government_registered": 1,
                  "government_registration_status": "registered", "registration_method": "slaasmb_sbe_list"}).json()
    ur = j["user_result"]
    if ur["band"] == "Medium":
        assert ur["checks"][0]["status"] == "good"
        assert "Registered" in ur["headline"] and "could not confirm" not in ur["headline"].lower()


def test_hutch_aliases():
    from app.employer_verification_model.company_aliases import resolve_lookup_names
    assert any("Hutchison" in n for n in resolve_lookup_names("Hutch", "https://hutch.lk/"))
    assert any("Hutchison" in n for n in resolve_lookup_names("Hutch Sri Lanka", "https://hutch.lk/"))


def test_discover_legal_name_from_footer():
    from app.employer_verification_model.legal_name_discovery import discover_legal_names
    text = "Home About Contact © 2026 Hutchison Telecommunications Lanka (Pvt) Ltd. All rights reserved."
    assert discover_legal_names(text, "Hutch", "https://hutch.lk/") == ["Hutchison Telecommunications Lanka (Pvt) Ltd"]
    # unrelated company names in the page are ignored
    assert discover_legal_names("Powered by Acme Hosting (Pvt) Ltd", "Hutch", "https://hutch.lk/") == []
    assert discover_legal_names("", "Hutch", "https://hutch.lk/") == []


def test_footer_name_is_a_claim_not_registered(client, monkeypatch):
    """A fake site copying a real legal name must NOT be shown as registered."""
    monkeypatch.setattr(RU, "quick_registry_lookup",
                        lambda n: {"register": "SLAASMB", "reg_name": "Hutchison Telecommunications Lanka (Pvt) Ltd"})
    state["site"] = {"text": "About Contact (c) 2026 Hutchison Telecommunications Lanka (Pvt) Ltd",
                     "signals": {"has_about": 1, "has_contact": 1, "has_privacy_policy": 1, "link_count": 25, "html_len": 9000}}
    j = post(client, {"company_name": "Hutch", "website_url": "https://hutch-jobs-apply.xyz"}).json()
    assert j["features_used"]["is_registered"] == 0
    assert j["registration_status"] != "registered"
    assert "registration_via_website_name" not in j["features_used"]
    assert j["risk_level"] != "Low" or j["user_result"]["checks"][0]["status"] != "good"
    chk = j["user_result"]["checks"][0]
    assert chk["status"] == "neutral" and "could not confirm" in chk["detail"].lower()


def test_eroc_skipped_when_another_register_already_confirmed(monkeypatch):
    import sys, types
    import app.employer_verification_model.slaasmb_lookup as SL
    calls = []
    monkeypatch.setattr(SL, "lookup_slaasmb_sbe", lambda n: {"is_slaasmb_registered": 1, "reg_name": "Example (Pvt) Ltd",
                                                          "slaasmb_sbe_name": "Example (Pvt) Ltd"})
    monkeypatch.setattr(RU, "check_eroc_registration", lambda *a, **k: calls.append(1) or {"is_registered": False})
    monkeypatch.setattr(RU, "_check_cse_with_api", lambda *a, **k: {"is_registered": False})

    class FakeDDGS:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def text(self, q, max_results=3): return []
    mod = types.ModuleType("duckduckgo_search"); mod.DDGS = FakeDDGS
    monkeypatch.setitem(sys.modules, "duckduckgo_search", mod)
    monkeypatch.setitem(sys.modules, "ddgs", mod)
    r = REAL_CHECK_REGISTRATION("Example Pvt Ltd", "https://example.lk")
    assert r.get("is_slaasmb_registered") == 1
    assert calls == []  # the slow eROC step was not run


def test_linkedin_page_must_belong_to_the_company():
    from app.employer_verification_model.review_aggregator import _classify_search_hit as c, _brand_hints
    assert _brand_hints("https://hutch.lk/") == ["hutch"]
    legal = "Hutchison Telecommunications Lanka (Pvt) Ltd"
    # the Sri Lankan page is accepted, whichever name was typed
    for name in (legal, "Hutch", "Hutch Sri Lanka"):
        assert c("https://lk.linkedin.com/company/hutch-sri-lanka", "Hutch Sri Lanka - LinkedIn", "", name, ["hutch"]) == "has_linkedin"
    # other companies that share the brand word are not
    for href, title in (("https://www.linkedin.com/company/hutch-games-ltd/", "Hutch - LinkedIn"),
                        ("https://www.linkedin.com/company/shophutch", "Hutch - LinkedIn"),
                        ("https://in.linkedin.com/company/hutch-india", "Hutch India Private Limited - LinkedIn"),
                        ("https://uk.linkedin.com/company/the-hutch-company-limited", "The Hutch Company Ltd - LinkedIn")):
        assert c(href, title, "", "Hutch", ["hutch"]) is None
    # personal profiles and posts never count as the company page
    assert c("https://lk.linkedin.com/in/some-person", "Some Person - CEO, HutchSri Lanka", "", "Hutch", ["hutch"]) is None
    assert c("https://www.linkedin.com/posts/hutch-sri-lanka_activity-1", "HUTCH CEO on digital inclusion", "", "Hutch", ["hutch"]) is None
    # a global company with a two-word name needs no Sri Lankan marker; unrelated pages still fail
    assert c("https://www.linkedin.com/company/thomson-reuters", "Thomson Reuters - LinkedIn", "", "Thomson Reuters", ["thomsonreuters"]) == "has_linkedin"
    assert c("https://www.linkedin.com/company/acme-corp", "Acme Corp", "", "Softsora", ["softsora"]) is None
    # exact brand address
    assert c("https://www.linkedin.com/company/softsora", "SoftSora", "", "SofSora", ["softsora"]) == "has_linkedin"


def _fake_search_module(monkeypatch, results_for):
    import sys, types

    class FakeDDGS:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def text(self, q, max_results=5): return results_for(q)
    mod = types.ModuleType("ddgs"); mod.DDGS = FakeDDGS
    monkeypatch.setitem(sys.modules, "ddgs", mod)
    monkeypatch.setitem(sys.modules, "duckduckgo_search", mod)


def test_linkedin_found_through_brand_search_with_legal_name(monkeypatch):
    """Legal name typed, LinkedIn page titled with the brand: found through the brand-word search."""
    import app.employer_verification_model.review_aggregator as RA

    def results(q):
        if q.lower().startswith("hutch sri lanka linkedin"):
            return [{"title": "Hutch Sri Lanka - LinkedIn", "href": "https://lk.linkedin.com/company/hutch-sri-lanka", "body": ""},
                    {"title": "Some Person - CEO", "href": "https://lk.linkedin.com/in/some-person", "body": "HUTCH"}]
        if "site:linkedin.com/company" in q:
            return [{"title": "Hutch - LinkedIn", "href": "https://www.linkedin.com/company/hutch-games-ltd/", "body": ""}]
        return []
    _fake_search_module(monkeypatch, results)
    found, _p, _n = RA._search_reviews_by_name("Hutchison Telecommunications Lanka (Pvt) Ltd", None, {}, ["hutch"])
    assert found["has_linkedin"] == 1


def test_linkedin_not_credited_for_other_companies_with_same_brand(monkeypatch):
    import app.employer_verification_model.review_aggregator as RA
    _fake_search_module(monkeypatch, lambda q: [
        {"title": "Hutch - LinkedIn", "href": "https://www.linkedin.com/company/hutch-games-ltd/", "body": ""},
        {"title": "Hutch India Private Limited - LinkedIn", "href": "https://in.linkedin.com/company/hutch-india", "body": ""}])
    found, _p, _n = RA._search_reviews_by_name("Hutch", None, {}, ["hutch"])
    assert found["has_linkedin"] == 0


# ---- matching must not rest on generic words / one weak keyword ----
def test_slaasmb_generic_words_do_not_match(monkeypatch):
    import app.employer_verification_model.slaasmb_lookup as SL
    monkeypatch.setattr(SL, "get_slaasmb_sbe_names",
                        lambda **k: ["Tropikal Life International (PVT) Ltd", "Hutchison Telecommunications Lanka (PVT) Ltd"])
    # shares only "life international" with a registered company -> must NOT count as registered
    assert SL.lookup_slaasmb_sbe("Best Life International (Pvt) Ltd") == {}
    assert SL.lookup_slaasmb_sbe("Global International") == {}   # only generic words
    # the real company and its legal-suffix variants still match
    assert SL.lookup_slaasmb_sbe("Tropikal Life International")["slaasmb_sbe_name"].startswith("Tropikal")
    assert SL.lookup_slaasmb_sbe("Hutchison Telecommunications Lanka")["slaasmb_sbe_name"].startswith("Hutchison")


def test_single_scam_keyword_is_not_fraud_evidence():
    from app.user_result import has_fraud_signals
    assert not has_fraud_signals({"scam_score": 1}, {})
    assert has_fraud_signals({"scam_score": 2}, {})
    assert has_fraud_signals({"has_payment_risk": 1}, {})


def test_http_only_site_is_a_warning_not_fraud_evidence():
    from app.user_result import has_fraud_signals
    assert not has_fraud_signals({"is_http_only": 1, "scam_score": 0}, {})


def test_slaasmb_register_may_add_a_prefix_but_not_change_the_brand(monkeypatch):
    import app.employer_verification_model.slaasmb_lookup as SL
    monkeypatch.setattr(SL, "get_slaasmb_sbe_names",
                        lambda **k: ["CHEC Port City Colombo (Pvt) Ltd", "Tropikal Life International (PVT) Ltd"])
    assert SL.lookup_slaasmb_sbe("Port City Colombo")["slaasmb_sbe_name"].startswith("CHEC")
    assert SL.lookup_slaasmb_sbe("Best Life International") == {}
    assert SL.lookup_slaasmb_sbe("Life International") == {}


# ---- eROC result-card parsing (name search page) ----
EROC_HTML = """
<div class="box"><div class="row"><span>CHEC PORT CITY COLOMBO</span><span>PV95439</span></div>
<div class="row"><span>PORT CITY COLOMBO</span><span class="badge">Under Incorporation</span></div></div>
<div class="alert">THIS NAME ALREADY EXISTS AND CANNOT BE RESERVED, PLEASE ADD A WORD AND TRY AGAIN !!</div>
"""


def test_eroc_parse_cards():
    from app.employer_verification_model.registration_utils import parse_eroc_results
    cards = parse_eroc_results(EROC_HTML)
    assert {"name": "CHEC PORT CITY COLOMBO", "reg_no": "PV95439", "status": None} in cards
    assert any(c["name"] == "PORT CITY COLOMBO" and c["status"] == "Under Incorporation" and not c["reg_no"] for c in cards)
    assert len(cards) == 2


def test_eroc_match_registered_and_reserved():
    from app.employer_verification_model.registration_utils import parse_eroc_results, match_eroc_results
    cards = parse_eroc_results(EROC_HTML)
    reg, res = match_eroc_results("Port City Colombo", cards)
    assert reg["reg_no"] == "PV95439"
    assert res["status"] == "Under Incorporation"


def test_eroc_under_incorporation_alone_is_not_registered():
    from app.employer_verification_model.registration_utils import match_eroc_results
    cards = [{"name": "ACME FUTURE LIFE", "reg_no": None, "status": "Under Incorporation"}]
    reg, res = match_eroc_results("Acme Future Life", cards)
    assert reg is None and res is not None


def test_eroc_different_company_not_matched():
    from app.employer_verification_model.registration_utils import match_eroc_results
    cards = [{"name": "TROPIKAL LIFE INTERNATIONAL", "reg_no": "PV1234", "status": None}]
    assert match_eroc_results("Best Life International", cards) == (None, None)
    cards = [{"name": "APPLE FITNESS", "reg_no": "PV9999", "status": None}]
    assert match_eroc_results("Apple", cards) == (None, None)


# ---- eROC name-search service ----
class _FakeResp:
    def __init__(self, payload):
        self._p = payload
    def raise_for_status(self):
        pass
    def json(self):
        return self._p


def _eroc_payload(rows):
    return {"availableData": {"available": False, "data": rows}, "notHasData": {"available": False, "data": []}}


def test_eroc_api_registered(monkeypatch):
    from app.employer_verification_model import registration_utils as r
    monkeypatch.setattr(r, "EROC_API_TOKEN", "x")
    rows = [{"name": "CHEC PORT CITY COLOMBO", "registration_no": "PV95439"}, {"name": "PORT CITY COLOMBO", "registration_no": None}]
    monkeypatch.setattr(r.requests, "post", lambda *a, **k: _FakeResp(_eroc_payload(rows)))
    out = r.check_eroc_registration("Port City Colombo")
    assert out["is_registered"] and out["reg_number"] == "PV95439"


def test_eroc_api_only_under_incorporation(monkeypatch):
    from app.employer_verification_model import registration_utils as r
    monkeypatch.setattr(r, "EROC_API_TOKEN", "x")
    rows = [{"name": "NEW IDEAS LANKA", "registration_no": None}]
    monkeypatch.setattr(r.requests, "post", lambda *a, **k: _FakeResp(_eroc_payload(rows)))
    out = r.check_eroc_registration("New Ideas Lanka")
    assert not out["is_registered"] and out.get("under_incorporation")


def test_eroc_api_rejected_token_is_an_error_not_a_miss(monkeypatch):
    from app.employer_verification_model import registration_utils as r
    monkeypatch.setattr(r, "EROC_API_TOKEN", "bad")
    monkeypatch.setattr(r.requests, "post", lambda *a, **k: _FakeResp({"error": "Error decoding authentication request."}))
    out = r.check_eroc_registration("Port City Colombo")
    assert not out["is_registered"] and "rejected" in out["api_error"]


def test_eroc_api_wrong_company_not_matched(monkeypatch):
    from app.employer_verification_model import registration_utils as r
    monkeypatch.setattr(r, "EROC_API_TOKEN", "x")
    rows = [{"name": "TROPIKAL LIFE INTERNATIONAL", "registration_no": "PV1"}]
    monkeypatch.setattr(r.requests, "post", lambda *a, **k: _FakeResp(_eroc_payload(rows)))
    assert not r.check_eroc_registration("Best Life International")["is_registered"]


import pytest as _pytest


@_pytest.fixture(autouse=True)
def _no_live_eroc(monkeypatch):
    """Tests must not call the real eROC service or a browser, even when .env has EROC_API_TOKEN set."""
    from app.employer_verification_model import registration_utils as _r
    monkeypatch.setattr(_r, "EROC_API_TOKEN", "")
    monkeypatch.setattr(_r, "USE_EROC_SELENIUM", False)


def test_negative_reviews_alone_are_not_fraud_signals():
    from app.user_result import has_fraud_signals
    assert not has_fraud_signals({"has_negative_reviews": 1, "has_positive_reviews": 1}, {"has_negative_reviews": 1})
    assert has_fraud_signals({"has_payment_risk": 1}, {})
    assert has_fraud_signals({}, {"has_scam_report": 1})


def test_eroc_queries_use_brand_word_not_longest_word():
    from app.employer_verification_model.registration_utils import _eroc_api_queries
    qs = _eroc_api_queries("Pelwatte Sugar Industries")
    assert qs[0] == "pelwatte sugar industries" and "pelwatte" in qs and "industries" not in qs


def test_cbsl_search_hit_ignored_for_non_finance_company(monkeypatch):
    """A cbsl.gov.lk page that merely mentions a sugar company is not a CBSL licence (real Pelwatte run)."""
    def fake(name, domains):
        return {"source": domains[0]} if any("cbsl" in d for d in domains) else {}
    monkeypatch.setattr(RU, "_search_official_registry", fake)
    r = REAL_CHECK_REGISTRATION("Pelwatte Sugar Industries", "https://example.com")
    assert not r.get("is_cbsl_licensed")


def test_cbsl_search_hit_still_counts_for_finance_company(monkeypatch):
    def fake(name, domains):
        return {"source": domains[0]} if any("cbsl" in d for d in domains) else {}
    monkeypatch.setattr(RU, "_search_official_registry", fake)
    r = REAL_CHECK_REGISTRATION("Zeta Finance PLC", "https://example.com")
    assert r.get("is_cbsl_licensed")


# ---- website auto-search must only accept a site that can be the company's own ----
def test_website_fits_rejects_documents_directories_and_unrelated_sites():
    f = M._website_fits_company
    assert not f("https://www.sdb.lk/pyramid-warning.pdf", "Warning", "Fruugo Online pyramid", "Fruugo Online (Pvt) Ltd")
    assert not f("https://www.cbsl.gov.lk/notice", "Notice", "Fruugo", "Fruugo Online (Pvt) Ltd")
    assert not f("https://www.facebook.com/fruugo", "Fruugo", "", "Fruugo Online (Pvt) Ltd")
    assert not f("https://gannaapede.lk/", "Ganna Apede", "Pelwatte", "Pelwatte Sugar Industries")
    assert not f("https://hs-trading.com/", "HS Trading", "UK firm", "HS Trading")


def test_website_fits_accepts_own_site():
    f = M._website_fits_company
    assert f("https://www.dilmahtea.com/", "Dilmah Sri Lanka", "tea from Sri Lanka", "Dilmah")
    assert f("https://maliban.lk/", "Maliban", "", "Maliban Biscuit Manufactories Limited")
    assert f("https://www.aitkenspence.lk/", "Aitken Spence", "", "Aitken Spence PLC")


def test_repeat_check_returns_same_answer_from_cache(monkeypatch):
    monkeypatch.setenv("RESULT_CACHE_SECONDS", "3600")
    calls = {"n": 0}
    def fake(input):
        calls["n"] += 1
        return {"user_result": {"band": "Low", "notices": [], "checks": []}, "risk_score": 80}
    monkeypatch.setattr(M, "_predict_uncached", fake)
    a = M.predict_company(M.CompanyInput(company_name="Dilmah"))
    b = M.predict_company(M.CompanyInput(company_name=" dilmah "))
    assert calls["n"] == 1 and b["cached"] is True and a["risk_score"] == b["risk_score"]


def test_incomplete_answers_are_not_cached(monkeypatch):
    monkeypatch.setenv("RESULT_CACHE_SECONDS", "3600")
    calls = {"n": 0}
    def fake(input):
        calls["n"] += 1
        return {"user_result": {"band": "Medium", "notices": ["registers unreachable"], "checks": []}}
    monkeypatch.setattr(M, "_predict_uncached", fake)
    M.predict_company(M.CompanyInput(company_name="X Co"))
    M.predict_company(M.CompanyInput(company_name="X Co"))
    assert calls["n"] == 2


def test_unrelated_review_pages_are_not_credited_to_a_made_up_company():
    from app.employer_verification_model import review_aggregator as RA
    assert RA._classify_search_hit("https://www.trustpilot.com/review/other-shop.com", "Other Shop reviews",
                                   "Read reviews of Other Shop", "Zqxv Holdings Lanka") is None
    assert RA._classify_search_hit("https://www.trustpilot.com/review/zqxv.lk", "Zqxv Holdings reviews",
                                   "Zqxv Holdings Lanka", "Zqxv Holdings Lanka") == "has_trustpilot"


def test_social_only_website_is_neutral_not_good():
    from app.user_result import _website_check
    r = _website_check({"website": ["Public presence is mainly social media (no separate website)"]}, {})
    assert r["status"] == "neutral"


def test_inferred_website_signals_are_not_shown_as_a_real_website_check():
    from app.user_result import _website_check
    r = _website_check({"website": ["Website signals inferred from model features"]}, {})
    assert r["status"] == "neutral"
