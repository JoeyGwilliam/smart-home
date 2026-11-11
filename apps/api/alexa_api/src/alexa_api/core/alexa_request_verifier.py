import base64
import binascii
import json
import posixpath
from collections.abc import Callable, Sequence
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

import certifi
import httpx
from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.x509.verification import PolicyBuilder, Store, VerificationError

# The name that Amazon's signing certificate must be issued to.
_ALEXA_CERTIFICATE_DOMAIN = "echo-api.amazon.com"

# How far a request's timestamp may be from now, which is Amazon's limit. It stops a recorded request being sent again.
_MAXIMUM_REQUEST_AGE = timedelta(seconds=150)

_DOWNLOAD_TIMEOUT_SECONDS = 4


class UnverifiedRequestError(Exception):
    """ A request couldn't be shown to be a genuine request from Alexa for this skill. """


class AlexaRequestVerifier:
    """ Tells genuine requests from Alexa for one skill apart from everything else that reaches a public address.

    A request is genuine if Amazon signed its exact body, recently, for this skill. Checking the skill matters as
    much as the signature: Amazon signs requests for every skill, so without it anyone could point a skill of their
    own at this address.
    """

    def __init__(
            self,
            skill_id: str,
            trusted_roots: Sequence[x509.Certificate] | None = None,
            download_certificate_chain: Callable[[str], bytes] | None = None,
    ) -> None:
        """ Creates a verifier for one skill.

        Args:
            skill_id:
                The id that Amazon gave the skill, such as `amzn1.ask.skill.1234`. Requests for other skills are
                not genuine.
            trusted_roots:
                The certificate authorities that the signing certificate may trace back to. Defaults to the
                authorities that browsers trust. Only tests need to set this.
            download_certificate_chain:
                Fetches the PEM certificate chain at a URL. Defaults to downloading it. Only tests need to set this.
        """
        self._skill_id = skill_id
        self._trusted_roots = Store(trusted_roots or _load_browser_trusted_roots())
        self._download_certificate_chain = download_certificate_chain or _download_certificate_chain
        # Amazon signs every request with the same certificate for months, so each chain is downloaded once.
        # Only chains that passed verification are kept, so made-up URLs can't fill this.
        self._verified_chains_by_url: dict[str, bytes] = {}

    def verify(self, certificate_chain_url: str, signature: str, body: bytes) -> None:
        """ Checks that a request is a genuine request from Alexa for this skill.

        Args:
            certificate_chain_url:
                The request's `SignatureCertChainUrl` header.
            signature:
                The request's `Signature-256` header.
            body:
                The request's body, exactly as it was received.

        Raises:
            UnverifiedRequestError: If the request isn't genuine. The message says which check failed.
        """
        try:
            signing_certificate = self._fetch_signing_certificate(certificate_chain_url)
            signing_certificate.public_key().verify(base64.b64decode(signature, validate=True), body, padding.PKCS1v15(), hashes.SHA256())
            # The body is only read once it is known to be Amazon's, so that nothing else is ever parsed.
            request = json.loads(body)
            skill_id = request["context"]["System"]["application"]["applicationId"]
            sent_at = datetime.fromisoformat(request["request"]["timestamp"])
            request_age = abs(datetime.now(UTC) - sent_at)
        except UnverifiedRequestError:
            raise
        except (httpx.HTTPError, VerificationError, InvalidSignature, binascii.Error, ValueError, LookupError, TypeError, AttributeError) as error:
            # Senders control every input here, so there are many ways for a check to fail, and they all mean the
            # same thing to the caller: don't act on this request.
            raise UnverifiedRequestError(f"The request couldn't be verified: {error!r}") from error

        if skill_id != self._skill_id:
            raise UnverifiedRequestError(f"The request is for another skill: {skill_id}")
        if request_age > _MAXIMUM_REQUEST_AGE:
            raise UnverifiedRequestError(f"The request's timestamp is too far from now: {sent_at}")

    def _fetch_signing_certificate(self, certificate_chain_url: str) -> x509.Certificate:
        # The URL comes from the sender, so it must be shown to be Amazon's before anything is fetched from it.
        # These are the checks that Amazon specifies.
        url = urlsplit(certificate_chain_url)
        is_amazon_url = (
            url.scheme.lower() == "https"
            and (url.hostname or "").lower() == "s3.amazonaws.com"
            and (url.port or 443) == 443
            and posixpath.normpath(url.path).startswith("/echo.api/")
        )
        if not is_amazon_url:
            raise UnverifiedRequestError(f"The certificate chain URL isn't Amazon's: {certificate_chain_url}")

        pem_chain = self._verified_chains_by_url.get(certificate_chain_url) or self._download_certificate_chain(certificate_chain_url)
        signing_certificate, *intermediate_certificates = x509.load_pem_x509_certificates(pem_chain)
        # A kept chain is verified again each time, because its certificates expire.
        verifier = PolicyBuilder().store(self._trusted_roots).build_server_verifier(x509.DNSName(_ALEXA_CERTIFICATE_DOMAIN))
        verifier.verify(signing_certificate, intermediate_certificates)

        self._verified_chains_by_url[certificate_chain_url] = pem_chain
        return signing_certificate


def _load_browser_trusted_roots() -> list[x509.Certificate]:
    end_marker = "-----END CERTIFICATE-----"
    roots = []
    for pem_certificate in certifi.contents().split(end_marker)[:-1]:
        try:
            roots.append(x509.load_pem_x509_certificate((pem_certificate + end_marker).encode()))
        except ValueError:
            # The list holds a few old authorities that the cryptography library refuses, or will come to refuse, to
            # load. Skipping one only matters if Amazon's certificate traces back to it, in which case requests are
            # refused and the log says why.
            continue
    return roots


def _download_certificate_chain(certificate_chain_url: str) -> bytes:
    return httpx.get(certificate_chain_url, timeout=_DOWNLOAD_TIMEOUT_SECONDS).raise_for_status().content
