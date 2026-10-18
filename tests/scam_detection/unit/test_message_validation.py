"""Messages that are not a recruiter chat must be refused before the model runs."""

from tests.service_imports import import_module

validation = import_module("scam-detection", "app.message_validation")


def test_a_real_recruiter_message_is_allowed():
    text = "Please pay the registration fee of Rs 2500 today so we can confirm your job interview on WhatsApp."
    assert validation.rejection_reason(text) is None


def test_a_short_or_unrelated_message_is_refused():
    assert validation.rejection_reason("Pay the fee today") == validation.NOT_A_MESSAGE
    assert (
        validation.rejection_reason("My cat is sleeping on the sofa near the window this afternoon.")
        == validation.NOT_A_MESSAGE
    )
    assert validation.rejection_reason("a cat on a sofa") == validation.NOT_A_MESSAGE
