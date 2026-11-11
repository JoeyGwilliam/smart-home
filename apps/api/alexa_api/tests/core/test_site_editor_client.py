import pytest

from alexa_api.core.home_api import HomeApiUnavailableError
from alexa_api.core.site_editor_client import SiteEditorBusyError, SiteEditorClient
from tests.fake_home_apis import create_failing_api, create_fake_site_editor_api


def test_sends_request_as_message_when_requesting_change() -> None:
    received_messages: list[str] = []
    client = SiteEditorClient("http://site-editor", create_fake_site_editor_api(received_messages))

    client.request_change("Make the clock bigger")

    assert received_messages == ["Make the clock bigger"]


def test_raises_busy_error_when_site_editor_refuses_message() -> None:
    received_messages: list[str] = []
    client = SiteEditorClient("http://site-editor", create_fake_site_editor_api(received_messages, is_busy=True))

    with pytest.raises(SiteEditorBusyError):
        client.request_change("Make the clock bigger")

    assert received_messages == []


def test_gives_state_of_change_when_getting_change_state() -> None:
    client = SiteEditorClient("http://site-editor", create_fake_site_editor_api([], state="reviewing"))

    state = client.get_change_state()

    assert state == "reviewing"


@pytest.mark.parametrize("status_code", [None, 422, 500])
def test_raises_unavailable_error_when_site_editor_api_fails(status_code: int | None) -> None:
    client = SiteEditorClient("http://site-editor", create_failing_api(status_code))

    with pytest.raises(HomeApiUnavailableError):
        client.request_change("Make the clock bigger")
