# app/case_state.py
# The checklist for one conversation: job post, company and recruiter messages.
# Checks can be completed in any order; the result is shown when none is left to do.

from typing import Dict, List

from pydantic import BaseModel, Field

from app.schemas import CheckResult, CheckSource, CheckStatus
from app.verdict import CHECK_ORDER

FINISHED_STATUSES = ("done", "skipped", "not_applicable")


def _empty_checks() -> Dict[str, CheckResult]:
    return {source: CheckResult(source=source) for source in CHECK_ORDER}


class CaseState(BaseModel):
    checks: Dict[str, CheckResult] = Field(default_factory=_empty_checks)

    def get(self, source: CheckSource) -> CheckResult:
        return self.checks[source]

    def set(self, result: CheckResult) -> None:
        self.checks[result.source] = result

    def mark(self, source: CheckSource, status: CheckStatus) -> None:
        self.checks[source] = CheckResult(source=source, status=status)

    def remaining(self) -> List[CheckSource]:
        """Checks still to do, in the order the assistant asks for them."""
        return [s for s in CHECK_ORDER if self.checks[s].status not in FINISHED_STATUSES]

    def is_complete(self) -> bool:
        return not self.remaining()

    def as_list(self) -> List[CheckResult]:
        return [self.checks[s] for s in CHECK_ORDER]
