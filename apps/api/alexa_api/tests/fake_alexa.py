import base64
import json
from datetime import UTC, datetime, timedelta
from functools import cache
from typing import Any

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID


class FakeAlexa:
    """ Stands in for Amazon's side of a skill: it builds requests as Alexa does, and signs them as Amazon does.

    It has its own certificate authority in place of the ones that browsers trust, so a verifier only accepts its
    requests if it is given `trusted_roots` and `download_certificate_chain`.

    Attributes:
        skill_id:
            The id of the skill that requests are for, unless a request says otherwise.
        certificate_chain_url:
            Where the certificate chain claims to be, which is an address that Amazon would use.
        trusted_roots:
            The certificate authority that issued the signing certificate.
        downloaded_urls:
            Every URL that the certificate chain has been downloaded from, in order.
    """

    skill_id = "amzn1.ask.skill.this-skill"
    certificate_chain_url = "https://s3.amazonaws.com/echo.api/echo-api-cert.pem"

    def __init__(
            self,
            certificate_domain: str = "echo-api.amazon.com",
            certificate_expires_at: datetime | None = None,
    ) -> None:
        """ Creates Amazon's side, with a new signing certificate.

        Args:
            certificate_domain:
                The name that the signing certificate is issued to. Amazon's is `echo-api.amazon.com`.
            certificate_expires_at:
                When the signing certificate stops being valid. Defaults to a day from now.
        """
        authority_key = _generate_key("authority")
        self._signing_key = _generate_key("signing")
        now = datetime.now(UTC)
        authority_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Fake Certificate Authority")])
        authority_certificate = (
            x509.CertificateBuilder()
            .subject_name(authority_name)
            .issuer_name(authority_name)
            .public_key(authority_key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now - timedelta(days=30))
            .not_valid_after(now + timedelta(days=30))
            .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
            .add_extension(_describe_key_usage(signs_certificates=True), critical=True)
            .add_extension(x509.SubjectKeyIdentifier.from_public_key(authority_key.public_key()), critical=False)
            .sign(authority_key, hashes.SHA256())
        )
        signing_certificate = (
            x509.CertificateBuilder()
            .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, certificate_domain)]))
            .issuer_name(authority_name)
            .public_key(self._signing_key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now - timedelta(days=30))
            .not_valid_after(certificate_expires_at or now + timedelta(days=1))
            .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
            .add_extension(_describe_key_usage(signs_certificates=False), critical=True)
            .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
            .add_extension(x509.SubjectAlternativeName([x509.DNSName(certificate_domain)]), critical=False)
            .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(authority_key.public_key()), critical=False)
            .sign(authority_key, hashes.SHA256())
        )
        self.trusted_roots = [authority_certificate]
        self.downloaded_urls: list[str] = []
        self._pem_chain = signing_certificate.public_bytes(serialization.Encoding.PEM)

    def download_certificate_chain(self, certificate_chain_url: str) -> bytes:
        """ Gives the certificate chain, whatever the URL, and records that it was downloaded.

        Args:
            certificate_chain_url:
                Where the chain was asked for.

        Returns:
            The signing certificate, in PEM format.
        """
        self.downloaded_urls.append(certificate_chain_url)
        return self._pem_chain

    def create_request_body(
            self,
            request: dict[str, Any] | None = None,
            conversation_memory: dict[str, str] | None = None,
            sent_at: datetime | None = None,
            skill_id: str | None = None,
    ) -> bytes:
        """ Builds the body of a request, as Alexa sends it.

        Args:
            request:
                The body's `request` object, without its timestamp. Defaults to a person opening the skill.
            conversation_memory:
                The session attributes from the skill's previous reply. Defaults to none.
            sent_at:
                The request's timestamp. Defaults to now.
            skill_id:
                The skill that the request is for. Defaults to `skill_id`.

        Returns:
            The body, as JSON.
        """
        timestamp = (sent_at or datetime.now(UTC)).isoformat().replace("+00:00", "Z")
        body = {
            "version": "1.0",
            "session": {"new": conversation_memory is None, "attributes": conversation_memory},
            "context": {"System": {"application": {"applicationId": skill_id or self.skill_id}}},
            "request": (request or {"type": "LaunchRequest"}) | {"timestamp": timestamp, "locale": "en-GB"},
        }
        return json.dumps(body).encode()

    def sign(self, body: bytes) -> str:
        """ Signs a request body, as Amazon does.

        Args:
            body:
                The body to sign.

        Returns:
            The value for the request's `Signature-256` header.
        """
        return base64.b64encode(self._signing_key.sign(body, padding.PKCS1v15(), hashes.SHA256())).decode()

    def create_headers(self, body: bytes) -> dict[str, str]:
        """ Builds the headers that make a request genuine.

        Args:
            body:
                The body that the request will carry.

        Returns:
            The headers.
        """
        return {"SignatureCertChainUrl": self.certificate_chain_url, "Signature-256": self.sign(body)}


@cache
def _generate_key(purpose: str) -> rsa.RSAPrivateKey:
    # Generating a key is slow, and nothing depends on each test having its own, so each purpose's key is made once.
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _describe_key_usage(signs_certificates: bool) -> x509.KeyUsage:
    return x509.KeyUsage(
        digital_signature=True,
        key_cert_sign=signs_certificates,
        crl_sign=signs_certificates,
        content_commitment=False,
        key_encipherment=False,
        data_encipherment=False,
        key_agreement=False,
        encipher_only=False,
        decipher_only=False,
    )
