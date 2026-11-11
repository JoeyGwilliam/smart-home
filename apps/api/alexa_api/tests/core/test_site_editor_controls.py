from datetime import UTC, datetime

import pytest

from alexa_api.core.site_editor_client import SiteEditorClient
from alexa_api.core.site_editor_controls import SiteEditorControls
from alexa_api.core.skill_reply import SkillReply
from alexa_api.core.skill_request import SkillRequest
from tests.fake_home_apis import create_fake_site_editor_api

_NOON = datetime(2026, 11, 11, 12, 0, tzinfo=UTC)


def test_passes_capitalised_request_to_site_editor_when_change_is_requested() -> None:
    received_messages: list[str] = []
    controls = SiteEditorControls(SiteEditorClient("http://site-editor", create_fake_site_editor_api(received_messages)))
    request = SkillRequest("RequestSiteChangeIntent", _NOON, slots={"request": "make the clock bigger"})

    reply = controls.responders["RequestSiteChangeIntent"](request)

    assert reply == SkillReply("I've passed that to the site editor. Look at the site editor page to see the change and confirm it.")
    assert received_messages == ["Make the clock bigger"]


def test_says_site_editor_is_busy_when_it_refuses_the_request() -> None:
    received_messages: list[str] = []
    busy_site_editor = create_fake_site_editor_api(received_messages, is_busy=True)
    controls = SiteEditorControls(SiteEditorClient("http://site-editor", busy_site_editor))
    request = SkillRequest("RequestSiteChangeIntent", _NOON, slots={"request": "make the clock bigger"})

    reply = controls.responders["RequestSiteChangeIntent"](request)

    assert reply == SkillReply("The site editor is busy with another change. Try again when it has finished.")
    assert received_messages == []


def test_passes_nothing_on_when_no_request_is_heard() -> None:
    received_messages: list[str] = []
    controls = SiteEditorControls(SiteEditorClient("http://site-editor", create_fake_site_editor_api(received_messages)))

    reply = controls.responders["RequestSiteChangeIntent"](SkillRequest("RequestSiteChangeIntent", _NOON))

    assert reply == SkillReply("Sorry, I didn't catch what you want changed.")
    assert received_messages == []


@pytest.mark.parametrize(
    ("state", "expected_speech"),
    [
        ("idle", "No change is being made to the site."),
        ("working", "Claude is still working on the change."),
        ("building", "The site is being rebuilt."),
        ("discussing", "Claude has answered. Look at the site editor page to read what it said."),
        ("reviewing", "The change is ready to look at. You can confirm or discard it on the site editor page."),
        ("saving", "The change is being saved."),
        ("a state added later", "The site editor is a state added later."),
    ],
)
def test_describes_state_of_change_when_asked_how_it_is_going(state: str, expected_speech: str) -> None:
    controls = SiteEditorControls(SiteEditorClient("http://site-editor", create_fake_site_editor_api([], state=state)))

    reply = controls.responders["SiteChangeProgressIntent"](SkillRequest("SiteChangeProgressIntent", _NOON))

    assert reply == SkillReply(expected_speech)
