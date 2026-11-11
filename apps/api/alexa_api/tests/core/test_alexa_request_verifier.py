from datetime import UTC, datetime, timedelta

import pytest

from alexa_api.core.alexa_request_verifier import AlexaRequestVerifier, UnverifiedRequestError
from tests.fake_alexa import FakeAlexa


def _create_verifier(alexa: FakeAlexa) -> AlexaRequestVerifier:
    return AlexaRequestVerifier(alexa.skill_id, alexa.trusted_roots, alexa.download_certificate_chain)


def test_accepts_request_when_amazon_signed_it_just_now_for_this_skill() -> None:
    alexa = FakeAlexa()
    verifier = _create_verifier(alexa)
    body = alexa.create_request_body()

    verifier.verify(alexa.certificate_chain_url, alexa.sign(body), body)


def test_refuses_request_when_body_was_changed_after_signing() -> None:
    alexa = FakeAlexa()
    verifier = _create_verifier(alexa)
    signed_body = alexa.create_request_body({"type": "LaunchRequest"})
    changed_body = alexa.create_request_body({"type": "SessionEndedRequest"})

    with pytest.raises(UnverifiedRequestError):
        verifier.verify(alexa.certificate_chain_url, alexa.sign(signed_body), changed_body)


@pytest.mark.parametrize("signature", ["", "not base64!", "bm90IGEgc2lnbmF0dXJl"])
def test_refuses_request_when_signature_is_not_a_signature_of_the_body(signature: str) -> None:
    alexa = FakeAlexa()
    verifier = _create_verifier(alexa)
    body = alexa.create_request_body()

    with pytest.raises(UnverifiedRequestError):
        verifier.verify(alexa.certificate_chain_url, signature, body)


def test_refuses_request_when_it_is_for_another_skill() -> None:
    alexa = FakeAlexa()
    verifier = _create_verifier(alexa)
    body = alexa.create_request_body(skill_id="amzn1.ask.skill.someone-elses-skill")

    with pytest.raises(UnverifiedRequestError, match="another skill"):
        verifier.verify(alexa.certificate_chain_url, alexa.sign(body), body)


@pytest.mark.parametrize("seconds_from_now", [-151, 151])
def test_refuses_request_when_timestamp_is_more_than_150_seconds_from_now(seconds_from_now: int) -> None:
    alexa = FakeAlexa()
    verifier = _create_verifier(alexa)
    body = alexa.create_request_body(sent_at=datetime.now(UTC) + timedelta(seconds=seconds_from_now))

    with pytest.raises(UnverifiedRequestError, match="timestamp"):
        verifier.verify(alexa.certificate_chain_url, alexa.sign(body), body)


def test_accepts_request_when_timestamp_is_two_minutes_old() -> None:
    alexa = FakeAlexa()
    verifier = _create_verifier(alexa)
    body = alexa.create_request_body(sent_at=datetime.now(UTC) - timedelta(seconds=120))

    verifier.verify(alexa.certificate_chain_url, alexa.sign(body), body)


@pytest.mark.parametrize(
    "url_that_is_not_amazons",
    [
        "",
        "http://s3.amazonaws.com/echo.api/echo-api-cert.pem",
        "https://attacker.example/echo.api/echo-api-cert.pem",
        "https://s3.amazonaws.com.attacker.example/echo.api/echo-api-cert.pem",
        "https://s3.amazonaws.com:8443/echo.api/echo-api-cert.pem",
        "https://s3.amazonaws.com/attackers-bucket/echo-api-cert.pem",
        "https://s3.amazonaws.com/echo.api/../attackers-bucket/echo-api-cert.pem",
        "https://s3.amazonaws.com/ECHO.API/echo-api-cert.pem",
    ],
)
def test_refuses_request_without_downloading_when_certificate_chain_url_is_not_amazons(
        url_that_is_not_amazons: str,
) -> None:
    alexa = FakeAlexa()
    verifier = _create_verifier(alexa)
    body = alexa.create_request_body()

    with pytest.raises(UnverifiedRequestError):
        verifier.verify(url_that_is_not_amazons, alexa.sign(body), body)

    assert alexa.downloaded_urls == []


@pytest.mark.parametrize(
    "equivalent_amazon_url",
    [
        "https://s3.amazonaws.com:443/echo.api/echo-api-cert.pem",
        "HTTPS://S3.AMAZONAWS.COM/echo.api/echo-api-cert.pem",
        "https://s3.amazonaws.com/echo.api/../echo.api/echo-api-cert.pem",
    ],
)
def test_accepts_request_when_certificate_chain_url_is_amazons_written_another_way(equivalent_amazon_url: str) -> None:
    alexa = FakeAlexa()
    verifier = _create_verifier(alexa)
    body = alexa.create_request_body()

    verifier.verify(equivalent_amazon_url, alexa.sign(body), body)


def test_refuses_request_when_certificate_is_issued_to_another_name() -> None:
    alexa = FakeAlexa(certificate_domain="attacker.example")
    verifier = _create_verifier(alexa)
    body = alexa.create_request_body()

    with pytest.raises(UnverifiedRequestError):
        verifier.verify(alexa.certificate_chain_url, alexa.sign(body), body)


def test_refuses_request_when_certificate_has_expired() -> None:
    alexa = FakeAlexa(certificate_expires_at=datetime.now(UTC) - timedelta(days=1))
    verifier = _create_verifier(alexa)
    body = alexa.create_request_body()

    with pytest.raises(UnverifiedRequestError):
        verifier.verify(alexa.certificate_chain_url, alexa.sign(body), body)


def test_refuses_request_when_certificate_authority_is_not_trusted() -> None:
    alexa = FakeAlexa()
    verifier_with_browser_trusted_roots = AlexaRequestVerifier(
        alexa.skill_id,
        download_certificate_chain=alexa.download_certificate_chain,
    )
    body = alexa.create_request_body()

    with pytest.raises(UnverifiedRequestError):
        verifier_with_browser_trusted_roots.verify(alexa.certificate_chain_url, alexa.sign(body), body)


def test_refuses_request_when_certificate_chain_is_not_certificates() -> None:
    alexa = FakeAlexa()
    verifier = AlexaRequestVerifier(alexa.skill_id, alexa.trusted_roots, lambda url: b"<html>Not found</html>")
    body = alexa.create_request_body()

    with pytest.raises(UnverifiedRequestError):
        verifier.verify(alexa.certificate_chain_url, alexa.sign(body), body)


def test_refuses_request_when_signed_body_is_not_an_alexa_request() -> None:
    alexa = FakeAlexa()
    verifier = _create_verifier(alexa)
    body = b'["not", "an", "alexa", "request"]'

    with pytest.raises(UnverifiedRequestError):
        verifier.verify(alexa.certificate_chain_url, alexa.sign(body), body)


def test_downloads_certificate_chain_once_when_verifying_several_requests() -> None:
    alexa = FakeAlexa()
    verifier = _create_verifier(alexa)
    first_body = alexa.create_request_body({"type": "LaunchRequest"})
    second_body = alexa.create_request_body({"type": "SessionEndedRequest"})

    verifier.verify(alexa.certificate_chain_url, alexa.sign(first_body), first_body)
    verifier.verify(alexa.certificate_chain_url, alexa.sign(second_body), second_body)

    assert alexa.downloaded_urls == [alexa.certificate_chain_url]
